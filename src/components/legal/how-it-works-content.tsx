export function HowItWorksContent() {
  return (
    <div className="grid gap-4 ui-body leading-6">
      <section>
        <h2 className="font-semibold">One home, one phone</h2>
        <p className="mt-1 text-muted-foreground">
          v1 is built for a single household on a single iPhone. Your rooms, chores, and restock list live on this
          device. Sharing across phones is not in this version.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Today is the list</h2>
        <p className="mt-1 text-muted-foreground">
          Today shows what is due now, what is still open, and what to order. Completing a chore records it on this
          phone. Nothing syncs to a server.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Restock is when to buy</h2>
        <p className="mt-1 text-muted-foreground">
          Filters, batteries, and pads get an order-by date. You check out at the store. Paste a product link if you
          want a shortcut back to the listing.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Seasonal lives on Today</h2>
        <p className="mt-1 text-muted-foreground">
          A ZIP sets your climate zone on device. Apple Weather fills the forecast. Seasonal checklists show up on
          Today when they matter for this house, with the full year one tap away.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Forecast lives on Home</h2>
        <p className="mt-1 text-muted-foreground">
          Replacement forecast sits on Home next to your rooms and appliances. Open it when you want the full Budget
          timeline.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">The key travels with iCloud</h2>
        <p className="mt-1 text-muted-foreground">
          Your home moves to your next iPhone with your normal iCloud backup. The passphrase file in Settings is
          extra protection if that restore is not available. Deleting the app removes your home from this iPhone.
          Erase everything also removes the Keychain key.
        </p>
      </section>
    </div>
  );
}
