import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata = { title: "How Cuidala works - Cuidala" };

export default function HowItWorksPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] text-[15px] leading-6">
      <Link href="/" className="text-sm font-medium text-primary">
        ← Back
      </Link>
      <BrandLockup size="sm" />
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">How Cuidala works</h1>

      <section>
        <h2 className="font-semibold">One home, one phone</h2>
        <p className="mt-1 text-muted-foreground">
          v1 is built for a single household on a single iPhone. Your rooms, chores, and restock list live
          on this device. Sharing across phones is a later Pro idea, not this version.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Today is the list</h2>
        <p className="mt-1 text-muted-foreground">
          Today shows what is due now, what is still open, and what to order. Completing a chore records it
          on this phone. Nothing syncs to a server.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Restock is when to buy</h2>
        <p className="mt-1 text-muted-foreground">
          Filters, batteries, and pads get an order-by date. You check out at the store. Paste a product
          link if you want a shortcut back to the listing.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Seasonal follows climate</h2>
        <p className="mt-1 text-muted-foreground">
          A ZIP sets your climate zone on device. Apple Weather fills the forecast. Seasonal checklists show
          up when they matter for this house.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">The key travels with iCloud</h2>
        <p className="mt-1 text-muted-foreground">
          Your home moves to your next iPhone with your normal iCloud backup. The passphrase file in
          Settings is extra protection if that restore is not available.
        </p>
      </section>
    </main>
  );
}
