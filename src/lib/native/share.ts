import { tActive } from "@/i18n";
import { isNative } from "@/lib/native/platform";

export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (isNative()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, dialogTitle: title });
      return "shared";
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return "shared";
    }
  } catch {
    // user cancelled or share unavailable; fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(text);
    window.setTimeout(() => {
      void navigator.clipboard.writeText("").catch(() => {});
    }, 60_000);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Writes a JSON backup to a temp file and opens the iOS share sheet as a file, not text. */
export async function shareBackupFile(
  json: string,
  filename: string,
): Promise<"shared" | "cancelled" | "failed"> {
  if (!isNative()) return "failed";
  const { Directory, Encoding, Filesystem } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  try {
    await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Temporary,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Temporary });
    await Share.share({
      title: tActive("share.backupTitle"),
      files: [uri],
      dialogTitle: tActive("share.backupDialog"),
    });
    return "shared";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return "cancelled";
    return "failed";
  } finally {
    try {
      await Filesystem.deleteFile({ path: filename, directory: Directory.Temporary });
    } catch {
      // already gone
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Shares a rendered picture (a share card) as a file. On iOS it is written to
 * the cache directory, handed to the share sheet and removed; on the web it
 * goes through the Web Share API when files are allowed, else it downloads.
 */
export async function shareImage(
  blob: Blob,
  filename: string,
  title: string,
): Promise<"shared" | "cancelled" | "failed"> {
  if (isNative()) {
    const { Directory, Filesystem } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    try {
      await Filesystem.writeFile({
        path: filename,
        data: await blobToBase64(blob),
        directory: Directory.Cache,
        recursive: true,
      });
      const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
      await Share.share({ title, files: [uri], dialogTitle: title });
      return "shared";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return /cancel/i.test(message) ? "cancelled" : "failed";
    } finally {
      try {
        await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
      } catch {
        // already gone
      }
    }
  }
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  try {
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      return "shared";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/abort|cancel/i.test(message)) return "cancelled";
  }
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "shared";
  } catch {
    return "failed";
  }
}

