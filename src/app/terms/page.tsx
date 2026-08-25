import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata = { title: "Additional terms - Cuidala" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] text-[15px] leading-6">
      <Link href="/" className="text-sm font-medium text-primary">
        ← Back
      </Link>
      <BrandLockup size="sm" />
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">Additional terms</h1>
      <p className="text-sm text-muted-foreground">Effective August 2026</p>
      <p>
        These additional terms apply to Cuidala on the App Store. Apple’s Standard EULA also applies, as
        set in App Store Connect.
      </p>
      <p>
        You must be 18 or older to use Cuidala. Cuidala is for a single household on a single iPhone in
        the United States.
      </p>
      <p>
        Cuidala helps you organise home maintenance. Reminders, seasonal checklists, cost forecasts, and
        replacement estimates are informational only. They are generated from what you enter and from
        national typical figures, 2026. They are not professional advice. Always follow manufacturer
        instructions and local codes, and consult a qualified professional for electrical, gas, structural,
        roof, pest, or safety-related work.
      </p>
      <p>
        Retailer links open third-party websites. Purchases are made with the retailer under its terms; Cuidala
        is not a party to those transactions and receives no commission or data from them.
      </p>
      <p>
        Your data lives on your device. Your home moves to your next iPhone with your normal iCloud backup.
        The passphrase file in Settings is extra protection. Cuidala cannot recover data from a lost device
        or a forgotten backup passphrase.
      </p>
      <p>
        The app is provided “as is” without warranty of any kind. To the extent permitted by law, Cuidala is
        not liable for consequential, incidental, special, or lost-profit damages, and liability is limited
        to the amount you paid for the app.
      </p>
      <p>
        These terms are governed by the laws of the State of Arizona, USA. Venue is in Pima County, Arizona.
        Questions:{" "}
        <a className="text-primary" href="mailto:support@cuidala.app">support@cuidala.app</a>.
      </p>
    </main>
  );
}
