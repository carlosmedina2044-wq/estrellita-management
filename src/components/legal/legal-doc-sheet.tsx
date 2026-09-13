"use client";

import { HowItWorksContent } from "@/components/legal/how-it-works-content";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { TermsContent } from "@/components/legal/terms-content";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import type { MessageKey } from "@/i18n";

export type LegalDocId = "how-it-works" | "privacy" | "terms";

const TITLE_KEYS: Record<LegalDocId, MessageKey> = {
  "how-it-works": "legal.title.how",
  privacy: "legal.title.privacy",
  terms: "legal.title.terms",
};

export function LegalDocSheet({
  doc,
  onOpenChange,
}: {
  doc: LegalDocId | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  return (
    <Sheet open={Boolean(doc)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{doc ? t(TITLE_KEYS[doc]) : ""}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
          {doc === "how-it-works" ? <HowItWorksContent /> : null}
          {doc === "privacy" ? <PrivacyContent /> : null}
          {doc === "terms" ? <TermsContent /> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
