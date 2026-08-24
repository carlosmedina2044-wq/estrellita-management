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
      title: "Cuidala backup",
      files: [uri],
      dialogTitle: "Save your Cuidala backup",
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
