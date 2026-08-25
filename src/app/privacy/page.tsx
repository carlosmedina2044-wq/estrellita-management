import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";

export const metadata = { title: "Privacy policy - Cuidala" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] text-[15px] leading-6">
      <Link href="/" className="text-sm font-medium text-primary">
        ← Back
      </Link>
      <BrandLockup size="sm" />
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">Privacy policy</h1>
      <p className="text-sm text-muted-foreground">Effective August 2026</p>

      <h2 className="mt-2 font-semibold">What Cuidala is</h2>
      <p>
        Cuidala is a household maintenance app. It keeps a list of your rooms, chores, appliances, and the
        consumables you need to reorder, and tells you when to order them. v1 is one home on one iPhone,
        sold on the US App Store.
      </p>

      <h2 className="mt-2 font-semibold">Data stored on your device</h2>
      <p>
        Everything you enter (home name, rooms, chores, notes, appliance details, consumables, completion history,
        your ZIP code, and the settings you choose) is stored only on your iPhone. It is encrypted at rest with a
        key held in the iOS Keychain. That key migrates with encrypted iCloud and Finder backups. Cuidala has no
        user accounts and no servers that receive this data.
      </p>

      <h2 className="mt-2 font-semibold">Data that leaves your device</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Weather.</strong> Forecasts come from Apple WeatherKit on this iPhone. Apple may receive a
          location to return the forecast. ZIP is stored on device to pick a climate zone. Cuidala does not send
          weather or location to its own servers.
        </li>
        <li>
          <strong>Retailer links.</strong> When you tap Order or Find it, the retailer’s website opens in an in-app
          Safari view. What you do there is governed by that retailer’s policy. Cuidala does not place orders,
          see what you buy, or store payment information.
        </li>
      </ul>
      <p>That is the complete list. Cuidala does not use analytics, advertising, or crash-reporting services.</p>

      <h2 className="mt-2 font-semibold">App Store privacy label</h2>
      <p>
        Data Not Collected. WeatherKit requests are handled by Apple, not collected by Cuidala. ZIP and chores
        stay on this iPhone.
      </p>

      <h2 className="mt-2 font-semibold">Permissions</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Location (optional).</strong> Used during setup to pick seasonal tasks and to request Apple Weather. ZIP can be typed instead.</li>
        <li><strong>Notifications (optional).</strong> Local reminders scheduled on your device for restock dates and a weekly digest. Item names can appear on the lock screen.</li>
        <li><strong>Face ID / Touch ID (optional).</strong> Used to lock the app. Biometric data never leaves the Secure Enclave and is not available to Cuidala.</li>
      </ul>

      <h2 className="mt-2 font-semibold">Deleting your data</h2>
      <p>
        Use Settings, then Erase all data on this iPhone, or delete the app. Both remove everything, including
        the encryption key and any scheduled reminders. Because nothing is stored elsewhere, there is nothing else to
        delete.
      </p>

      <h2 className="mt-2 font-semibold">Children</h2>
      <p>Cuidala is not directed at children under 13 and does not knowingly collect information from them. You must be 18 or older.</p>

      <h2 className="mt-2 font-semibold">Changes and contact</h2>
      <p>
        If this policy changes, the new version ships with an app update and the effective date above changes.
        Questions: <a className="text-primary" href="mailto:privacy@cuidala.app">privacy@cuidala.app</a>.
      </p>
    </main>
  );
}
