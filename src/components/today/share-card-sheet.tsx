"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { shareImage, shareText } from "@/lib/native/share";
import { renderShareCard, type ShareCardModel, type ShareCardScene } from "@/lib/share-card";

/**
 * Preview and share a rendered card. The picture is composed when the sheet
 * opens; if that fails for any reason the Share button falls back to the
 * same words as text, so sharing never dead-ends on a broken image.
 */
export function ShareCardSheet({
  open,
  onOpenChange,
  scene,
  model,
  filename,
  fallbackText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scene: ShareCardScene | null;
  model: ShareCardModel | null;
  filename: string;
  fallbackText: string;
}) {
  const { t } = useLocale();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !scene || !model) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void renderShareCard(scene, model)
      .then((result) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(result);
        setBlob(result);
        setUrl(objectUrl);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBlob(null);
      setUrl(null);
    };
  }, [open, scene, model]);

  async function share() {
    setBusy(true);
    try {
      if (blob) {
        const result = await shareImage(blob, filename, model?.headline ?? "Cuidala");
        if (result === "failed") toast.error(t("share.failedList"));
        if (result === "shared") onOpenChange(false);
        return;
      }
      const result = await shareText(model?.headline ?? "Cuidala", fallbackText);
      if (result === "copied") toast.success(t("share.copiedDone"));
      if (result === "failed") toast.error(t("share.failedList"));
      if (result !== "failed") onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{model?.headline ?? ""}</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-4">
          <div className="w-full max-w-[320px] overflow-hidden rounded-2xl bg-secondary" style={{ aspectRatio: "4 / 5" }}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center px-6 text-center ui-caption text-muted-foreground">
                {failed ? t("share.cardFailed") : t("share.cardPreparing")}
              </div>
            )}
          </div>
        </div>
        <SheetFooter className="pt-2">
          <Button className="h-12 w-full" disabled={busy || (!blob && !failed)} onClick={() => void share()}>
            <Share2 className="size-4" />
            {t("share.cardShare")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
