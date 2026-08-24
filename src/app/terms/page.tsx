import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata = { title: "Terms of use — Cuidala" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] text-[15px] leading-6">
      <Link href="/" className="text-sm font-medium text-primary">
        ← Back
      </Link>
      <BrandLockup size="sm" />
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">Terms of use</h1>
      <p className="text-sm text-muted-foreground">Effective August 2026</p>
      <p>
        Cuidala helps you organise home maintenance. Reminders, seasonal checklists, cost forecasts, and
        replacement estimates are general guidance generated from the information you enter and public averages.
        They are not professional advice. Always follow manufacturer instructions and local codes, and consult a
        qualified professional for electrical, gas, structural, or safety-related work.
      </p>
      <p>
        Retailer links open third-party websites. Purchases are made with the retailer under its terms; Cuidala
        is not a party to those transactions and receives no commission or data from them.
      </p>
      <p>
        Your data lives on your device. Keep a device backup if you want to preserve it; Cuidala cannot recover
        data from a lost or erased device.
      </p>
      <p>
        The app is provided “as is” without warranty of any kind. To the extent permitted by law, Cuidala’s
        liability is limited to the amount you paid for the app.
      </p>
      <p>
        These terms are governed by the laws of the State of Arizona, USA. Questions:{" "}
        <a className="text-primary" href="mailto:support@cuidala.app">support@cuidala.app</a>.
      </p>
    </main>
  );
}
