# Tester feedback plan, 2026-09-19

Four things came back from the first outside tester:

1. **"About 20 min to a closed day" made no sense.** Carlos had to explain that it means "finish the two things left and you're done for today". This is the core loop of the app, and the headline that drives it needed a translator.
2. **Seasonal tasks should land in her Google Calendar as tasks.** She wants a checkable task attached to the day, in the calendar she already lives in.
3. **Two AC units, two filter sizes.** The app only lets a house track one HVAC filter, with one size.
4. **Stock is hard to gauge.** She walks the house weekly and can see what is low, but can't say whether toilet paper lasts one month or two. She wants to tell the app "I'm low on milk" and trust it lands on the next haul.

This document is the plan for all four. Workstream A is a prerequisite for the rest: every new screen below is written under its rule.

---

## The rule that runs through everything

**Every sentence the app shows must be one you would say out loud to a friend who has never opened it.**

In practice:

- Use the words on the buttons. Things are **done** or **left**. A day is **all done**. A run is a **streak**.
- Lead with **how many things are left**, because the count is what tells someone they are finished. Minutes are a secondary fact.
- Never use a word the code invented (closed, run, ring, arc, fired, asset, duty, lead time, window, open) unless a button already uses it.
- Do not rotate a clear headline with an unclear one for variety. Vary the flavor line, never the fact.
- Read it aloud once before saving.

---

## Workstream A: Speak plainly

### What went wrong

"Closed day" is the model's word. `DayArcState` in `src/lib/momentum.ts` calls a finished day "closed", and that term leaked into 30 user-facing strings: the Today headline, the evening notification, the first milestone, the care-level drop message, the year view label and legend, the share text, the weekly quest, and two settings descriptions. The same leak happened with "run" (streak), "ring", "living house", "fired" (weather trigger), "asset" (appliance), "duties", "lead time", "window" (season), "open" (not done), and "given to the house".

The open-day headline in `src/lib/today-copy.ts` also rotates daily through three phrasings. Two are plain. One is the jargon line. So one day in three, every new user hits it, and the stat line beneath repeats the same minutes number without ever saying "then you're done".

### Structural fix on Today

- The open-state headline always leads with the count and ends with the done condition. Variety comes from the second clause only.
- The minutes stat line under the headline stays as the only place minutes appear.
- "Closed" disappears from every screen. The concept is "all done" everywhere: Today, year view, milestones, quests, notifications, share text.

### Copy changes

Every English string in `src/i18n/messages/en.json` was read. Chore titles, playbook names and their "why" lines are already plain and need only two touches (listed at the end). The Spanish and Portuguese catalogs translated the jargon faithfully ("cerrar el día", "fechar o dia"), so every key below is redone in all three. The locale test only checks key parity, so text changes are safe.

**1. "Closed day" becomes "all done"**

| Key | Now | Proposed |
|---|---|---|
| today.headlineOne | 1 thing needs you today. | 1 thing left today. Do it and you're done. |
| today.heroOpen1 | {count} things need you today. | {count} things left today. Finish them and you're done. |
| today.heroOpen2 | About {minutes} min to a closed day. | {count} to go. Finish them and today is done. |
| today.heroOpen3 | {count} left. The house is waiting. | keep |
| today.heroOpenNamed | {name}, {count} left today. | {name}, {count} left today. Finish them and you're done. |
| today.heroClosed1 | Day closed. Well done. | All done for today. Well done. |
| today.heroClosed3 | Closed for the day. {count} done. | All done for today. {count} things finished. |
| today.compactClosed | Today · closed | Today · all done |
| notify.eveningTitle | Close the day? | Finish today? |
| notify.eveningBody | {count} left · about {minutes} min keeps your {run}-day streak. | {count} left, about {minutes} min. Do them and your {run}-day streak keeps going. |
| settings.eveningHelp | …when a chore or two would close the day and keep your streak. | …when a chore or two would finish the day and keep your streak. |
| settings.milestonesEmpty | Close a day and it shows up here. | Finish everything on a day and it shows up here. |
| today.runStart | Close today to start one | Finish today's list to start one |
| today.runRestart | Close today to start again | Finish today's list to start again |
| today.runStripAria | Last 7 days: {closed} closed, {open} open | Last 7 days: {closed} all done, {open} with things left |
| milestone.first-close.title | First closed day | First all-done day |
| milestone.first-close.body | Your first closed day. That's the whole habit, right there. | You finished everything on your list today. That's the whole habit, right there. |
| milestone.seven-run.body | Seven days closed in a row. This is the week it starts to feel easy. | Seven days in a row with everything done. This is the week it starts to feel easy. |
| milestone.thirty-run.body | Thirty days closed. Quiet consistency. | Thirty days in a row, everything done. Quiet consistency. |
| milestone.hundred-run.body | A hundred days closed. This is just how you live now. | A hundred days in a row. This is just how you live now. |
| care.dropped | Down to {level} for now. A few closed days bring it back. | Down to {level} for now. Finish everything a few more days and it comes back. |
| today.yearWrappedBody | {closed} closed days · best streak {best} · {hours} | {closed} days all done · best streak {best} · {hours} |
| share.yearWrappedText | {year} at {name}: {closed} closed days, best streak {best} days, {hours} given to the house. | {year} at {name}: {closed} days all done, best streak {best} days, {hours} spent on the house. |
| year.closedDays | Closed days | Days all done |
| year.gridAria | {closed} closed days in {year} | {closed} days all done in {year} |
| year.legend.closed | Closed | All done |
| year.legend.open | Open | Some left |
| year.legend.grace | Grace | Forgiven |
| settings.yourYearHelp | Closed days, runs, milestones and seasonal jobs. | Days all done, streaks, milestones and seasonal jobs. |
| share.dayClosedTitle | Day closed at {name} | All done today at {name} |
| share.dayClosedHeadline | Day closed | All done today |
| share.dayClosedText | Day closed: {done} things, about {minutes} min, {rooms} rooms. {run}-day streak. | All done today: {done} things, about {minutes} min, {rooms} rooms. {run}-day streak. |
| quest.close-five.title | Close five days | Finish five days |
| quest.close-five.body | Five of seven. The grace day covers one of the other two. | Five days out of seven with everything done. One missed day is forgiven. |

**2. Streak, not run. No rings, no grace.**

| Key | Now | Proposed |
|---|---|---|
| settings.momentumTitle | Runs and milestones | Streaks and milestones |
| settings.momentumHelp | Shows the living house, day ring, runs, and milestones on Today. | Shows the house picture, the progress ring, streaks and milestones on Today. |
| today.runDay, widget.run, notify.briefRun | Day {count} | {count}-day streak |
| today.runBest | Best {count} | Best: {count} days |
| today.runGrace | Grace day used | One missed day forgiven |
| duty.detail.rhythm | Rhythm | How it's going |

**3. "Given to the house" becomes "spent on the house"**

| Key | Now | Proposed |
|---|---|---|
| year.hoursGiven | Given to the house | Time spent on the house |
| ledger.month | About {hours} given to the house this month | About {hours} spent on the house this month |
| ledger.monthMinutes | About {minutes} min given to the house this month | About {minutes} min spent on the house this month |
| ledger.monthNone | Nothing given to the house yet this month | No time on the house yet this month |
| houseLine.ledgerHours | {hours} hours given to the house so far this month. | {hours} hours spent on the house so far this month. |
| houseLine.ledgerMinutes | {minutes} minutes given to the house so far this month. | {minutes} minutes spent on the house so far this month. |
| today.ceremonyMinutes | minutes given | minutes spent |
| ledger.amount | roughly ${amount} handled yourself | about ${amount} saved by doing it yourself |
| year.handled | Handled yourself | Saved by doing it yourself |

"rooms touched" stays. It is plain English.

**4. "Open" meaning not done**

| Key | Now | Proposed |
|---|---|---|
| digest.choreOpenOne | 1 chore still open | 1 chore still to do |
| digest.choreOpenMany | {count} chores still open | {count} chores still to do |
| common.openCount | {count} open | {count} to do |

**5. Rooms and the care ladder**

| Key | Now | Proposed |
|---|---|---|
| today.roomsKeptAria | {fresh} of {total} rooms kept | {fresh} of {total} rooms done |
| today.wholeHouseKept | Whole house kept | Every room done |
| today.roomFresh | Fresh | Done |
| today.roomWaiting | Waiting | Not yet |
| portrait.paletteLocked | {palette} opens when your home reaches {level}. | {palette} unlocks when your home reaches {level}. |

The care levels (Settling in, Kept, Well kept, Cared for, Loved) are a ladder brand and the milestones and portrait unlocks hang off them. "Kept" on its own is the weak rung: "Your home is now Kept" is not a sentence anyone says. Two options, to decide with the tester: rename "Kept" to "Looked after", or keep the names and always pair a level with one line of what it means ("Well kept: most weeks, everything done").

**6. Restock**

| Key | Now | Proposed |
|---|---|---|
| restock.field.leadTime | Lead time (days) | Days to arrive |
| restock.leadTimeHelp | Learned from your deliveries automatically. Set only to override. | We learn this from your deliveries. Change it only if you need to. |
| home.onHandLead | On hand {onHand} · lead {lead}d | {onHand} on hand · {lead} days to arrive |
| restock.field.orderAtOrBelow | Order at or below | Order when down to |
| restock.optionalReorderHelp | Optional. Also flag for ordering at this count, on top of the automatic timing. | Optional. Put it on the order list when you're down to this many, even if the timing says later. |
| restock.quickCheck | Quick check | How's it looking? |
| restock.quickCheckHint | Keeps the estimates honest. | A quick answer keeps the timing right. |
| restock.field.size | Size or spec | Size or model |
| map.suggestedReorder | Suggested reorder: {names} | Worth ordering: {names} |

**7. Home and map: appliances, not assets**

| Key | Now | Proposed |
|---|---|---|
| home.assets, map.assets | Assets | Appliances |
| home.addAnAsset | Add an asset | Add an appliance |
| home.addAssetCta | Add asset | Add appliance |
| home.assetAdded | Asset added | Appliance added |
| home.assetFallback | Asset | Appliance |
| home.deleteRoomBody | Reassign its duties and reorders, or delete them with the room. | Move its chores and items to another room, or delete them with the room. |

Roofs, paint and floors are also "assets" in the model. "Appliances" is still the word a person uses for the list, and the map already says "appliances or units".

**8. Seasonal and weather**

| Key | Now | Proposed |
|---|---|---|
| seasonal.firedWeek | Fired this week. Tasks were added to Today. | This week's weather set it off. Its tasks are on Today. |
| season.fireAdded | {name} — {count} added to Today | {name}: {count} added to Today |
| today.emptyToday | Nothing is due today. Daily chores show on their weekday. Seasonal chores show in their window. Restock items show when it is time to order. | Nothing due today. Chores show up on their day, seasonal ones when their season comes, and items when it's time to order. |
| today.emptyCalendar | Nothing is due on this day. Daily chores show on their weekday. Seasonal chores show in their window. | Nothing due on this day. Chores show up on their day, seasonal ones when their season comes. |
| houseLine.windowOpens | {name} opens in {days} days. | {name} comes up in {days} days. |
| intro.seasonal | Seasonal windows ahead | Seasonal jobs ahead |
| intro.supplies | {count} supplies watched | {count} items we'll remind you to buy |
| seasonal.idealTime | Ideal time | Best time is now |

**9. Budget**

| Key | Now | Proposed |
|---|---|---|
| budget.viewOptionsBody | Look-ahead, big-expense threshold, and home value for the 1% rule. | How far ahead to look, what counts as a big expense, and your home's value. |
| budget.homeValue1pct | Home value (for the 1% rule) | Home value (for the yearly upkeep guide) |
| budget.onePercent | Your forecast is {monthly}/mo, about {pct}% of your home's value annually, which is {band}. | Your forecast is {monthly}/mo, about {pct}% of your home's value a year. Most homes spend 1 to 3%, so that's {band}. |
| budget.suggestedSetAside | Suggested set-aside {amount}/month | Suggested savings: {amount}/month |
| budget.fundSuggestedBody | Suggested set-aside is {amount}/month so you're ready for the next 12 months ({total} total). | Set aside {amount}/month and you'll be ready for the next 12 months ({total} total). |
| budget.fundTitle | Home maintenance fund | Money set aside for the house |
| budget.logPurchase | Log a purchase | Add what you paid |
| budget.captureCost | {intro} Capture the real cost so future estimates get better. | {intro} Enter what it really cost so the next estimate is closer. |
| budget.emptyTitle | Start logging purchases | Start adding what you pay |
| budget.emptyBody | When you log what things cost, the forecast gets sharper. | When you add what things cost, the forecast gets sharper. |
| budget.logHistoryHint | Log a purchase on an upcoming item to start a history. … | Add what you paid on an upcoming item to start a history. … |
| budget.loggingHint | Logging what you paid trains the forecast. Deferring pushes the date out if it's still working. | Adding what you paid makes the forecast better. Pushing out means it's still working, so the date moves later. |
| budget.deferMonths | Defer {count} months | Push out {count} months |
| budget.upcomingBody | The replacements that actually move the needle. | The replacements that cost real money. |
| budget.spendingSummary | Last {months} months: forecast {planned}, actual {actual} | Last {months} months: expected {planned}, paid {actual} |

**10. Everything else**

| Key | Now | Proposed |
|---|---|---|
| today.scopeList | List scope | Show |
| cleaner.leftHere | {count} left here. Use Done. Next above. | {count} left in this room. Tap Done on each. The next room is above. |
| duty.nothingQueued | Nothing queued today. | Nothing for today. |
| onboarding.placeCopy | Home type fills rooms. How long you've been here shapes the first-week checklist. | We'll suggest rooms from the home type, and a first-week list from how long you've been here. |
| onboarding.buildCopy | Toggle rooms, rename them, or add one. Chores attach after you finish. | Toggle rooms, rename them, or add one. We'll add chores once you finish. |
| quest.doneBody | Done. The house is dressed for it until Sunday. | Done for the week. Nothing more until Sunday. |
| settings.nightFollowsSky | Night follows the sky | Evening look after sunset |
| settings.appearanceHelp | The living house dims the app after sunset. Pick a fixed look if you would rather it stayed put. | The house picture dims after sunset. Pick a fixed look if you'd rather it stayed put. |
| settings.appearanceSky | Follow the sky | Follow sunset |
| content.playbook.cold-hose-bibs.why | A hose left on a bib can freeze… | A hose left on a spigot can freeze… |
| content.playbook.humid-ac-drain.why | …backs condensate into the ceiling. | …backs water up into the ceiling. |

### Delivery

- One pass over all three catalogs, then `npm test` and `npm run typecheck`.
- Read the Today hero, the finish screen, the year view and the settings page aloud on the simulator afterwards.
- Add a line to `AGENTS.md` with the rule, so future copy follows it.

---

## Workstream B: Running low, and the haul

### Why the current design fails her

- A supply item can only be born as a replacement chore with a lifespan (`applyDutySave` with a `supplyAutomation`). Milk has no lifespan, no chore, no retailer, so there is nowhere to put it.
- The check-in strip on Restock appears only when the model decides it is due (`checkinDue`). Her weekly walk is user-initiated, so most weeks there is nowhere to record what she saw.
- "Walk the house" on that screen opens the add-items picker, not a level check. Same words, different job.
- A "low" answer is a data point at 20 percent that the rate math may override. It does not guarantee the item lands on the next order.
- The order flow is shaped for online only: open retailer, confirm you ordered, pick an arrival date, then "did it arrive?". A Costco run is three wrong questions.

### The design

**The haul is the screen.** The top of Restock becomes a checkable shopping list called the haul. A "Need something?" line sits above it, with one-tap chips for her usual items. Milk and toilet paper look identical on the list. She never picks a type. The difference only shows after checking one off: a tracked item goes back to Stocked, anything else just disappears.

**Checking off is the whole interaction.** The checkbox means "got it" and receives the item immediately, with the usual quantity, feeding the existing rate learning. The retailer name sits as a small chip on the row for the online path, which stays the existing order flow. No "Bought it" button, no "Done shopping" button. Whatever stays unchecked carries to next week.

**Low beats the model.** A low flag (`flaggedLowAt` on the supply item) pins the item to the haul until it is received. `restockPlacement` honors it over the rate estimate.

**Capture with a confirm chip, never a silent match.** Typing "towels" shows the best match ("Paper towels, mark low?") beside "Add as new". A wrong silent match would promote the wrong item and cost trust.

**One walk, two jobs.** Merge the add-items picker and the level check into a single room-by-room walk. Each tracked item shows only Low and Out. Silence means fine. "Next room" advances, and rooms she passes through count as confirmed. Each room ends with an add row. Six taps for a whole house instead of thirty.

**The walk shrinks as the app learns, and says so.** Items the model is unsure about (`checkinDue` true) sit under "Worth a look" at the top. The rest collapse under "Probably fine, tap if not". A tracked item that is still learning reads "Learning your pace, two hauls to go" rather than a confident date. Two cycles of toilet paper are what it takes, and she should see the walk get shorter.

**Two different offers for repeats.** A short-interval repeat (milk, weekly) gets "Add to every haul", a standing staple with a one-tap skip. A long-interval repeat (detergent) gets "Track it" with the learned interval. The interval decides the offer. Nothing is offered on the first or second buy.

**The cleaner is the best inventory taker.** Cleaner mode already walks every room weekly. A visit ends with the same Low / Out pass. Almost free, since the walk already exists.

**The Sunday digest opens the walk.** The weekly notification becomes "Your haul: milk, toilet paper, filters. 2 worth a look." and deep-links to it.

### Honest limits

- A web view cannot start dictation on its own. The widget button (post-1.0) opens the capture line with the keyboard up and the mic one tap away. True hands-free is only Siri through App Intents, and a Siri phrase can only carry an enum or entity parameter, so "I'm low on milk" works for tracked items and anything else is a two-turn exchange.
- Haul items are a separate small array (`haulItems`), not a supply automation with optional fields. Making lifespan and duty optional on `SupplyAutomation` would ripple through 800 lines of restock logic and its tests before 1.0.

---

## Workstream C: More than one filter size

### Why it fails today

- `alreadyTracked` in `src/lib/onboarding/restock-walk.ts` dedupes by item name, so a second "HVAC filter" is refused.
- `targetFor` attaches the filter to the first HVAC asset it finds.
- `sizeSpec` is one string and the retailer search URL carries one size.
- The Home model already allows several HVAC assets. The fix is in the supply layer.

### The design

**"Another size?", never "another unit".** Standing at the return grille, she thinks "two sizes", not "two units", and she should not have to name anything. The filter row in the walk, and the item detail, offer "Another size?". Each size becomes its own supply record pointing at the same chore, which the supply-to-duty link (`linkedDutyIds`) already allows.

**One chore, two supplies.** Today shows one chore ("Replace HVAC filters"), because changing both is one afternoon and she wants one checkbox. The haul shows two rows labeled by size through `itemNameWithSize`, each with its own retailer search and its own check. The walk shows two rows.

**Code change.** `consumableForDuty` becomes plural. Part status reads "order first" if any size is out. Completing the chore consumes one unit of each linked supply. "Used one" on a single size in its detail covers the rare case of replacing only one.

**Optional unit link.** Tying a size to a specific HVAC asset on the home map stays optional in the item detail, for people who care about per-unit history.

**Same fix covers two fridges** with different water filters. Mixed smoke-detector batteries (one asset type, many units) is a different problem and waits.

**Migration.** Household version 8 to 9. Existing single-filter homes keep working; the item detail gains "Another size?".

---

## Workstream D: Add to Google Calendar

### What she is asking for, precisely

In Google Calendar a "task" is a Google Tasks item: it sits on the calendar grid with a checkbox and strikes through when she ticks it. That is what makes a seasonal chore feel like a to-do rather than an appointment. None of the obvious paths can create one:

- EventKit only writes to calendars the iPhone knows about, and its edit sheet only shows her Google calendar if she has added the Google account to iOS Calendar. People who live in the Google Calendar app often have not.
- An .ics file imports as an event.
- Google offers no URL or share target for creating a task. Only the Google Tasks API, behind OAuth.

### The three ways to reach her, compared

| Path | What she gets | Permission or setup | Fits 1.0 |
|---|---|---|---|
| Google Calendar link | An event, pre-filled, one Save tap in the browser | None | Yes |
| EventKit edit sheet | An event, only if Google is in iOS Calendar | None | Yes |
| Google Tasks API | A real checkable task, and check-off flows back | OAuth, consent screen, Google verification | No |

### 1.0: Add to calendar, asking once which calendar she uses

- The first tap offers Google Calendar or Apple Calendar and remembers the answer in Settings.
- **Google** builds the standard add-to-calendar link (`calendar.google.com/calendar/render?action=TEMPLATE`) with title, all-day dates, description and a yearly recurrence rule, and opens it through the existing open-URL helper. On iPhone it opens in the browser, where she must be signed in, with one Save tap.
- **Apple** opens the EventKit UI edit sheet through a small Capacitor plugin following the widget plugin's pattern. Apple's docs confirm the sheet runs outside the app's process on iOS 17 and later and needs no calendar permission.
- **Web build** shares an .ics file through the existing share path.
- **The event carries the task.** One yearly all-day event per playbook, titled like "Fall prep, 5 tasks", with each task on its own line in the description and a link back into the app. Google Calendar only makes https links tappable, so the link goes through the app's web share domain and hands off to the app, not a raw `cuidala://` scheme. A single chore adds a single event.
- **Offer it at the moment of commitment.** A one-time inline line right after accepting a playbook ("Want this on your calendar too?"), using the teaching tip pattern. Permanent homes: the duty detail sheet next to Snooze and Edit, and the playbook overflow. Not a button on every card.
- **No double reminders.** When the morning brief is on, the event's alert defaults to none. The edit sheet's own alert picker overrides.
- **One-way.** Cuidala stays the source of truth. Two-way sync means duplicates, reschedule drift and deletion handling, and would need full calendar access.
- **Privacy page.** The Google link sends the chore title and description to Google in a URL. It is her own calendar, but say so on the privacy page, and keep addresses and home details out of the description.

### 1.1: Connect Google Tasks

- A single switch in Settings, one Google sign-in with PKCE from the app (no backend needed for the token exchange), tokens in the Keychain.
- The season's chores become tasks in a "Cuidala" list, due at the window start. Completion syncs back: ticking a task in Google Calendar marks the chore done in the app on next open. Snoozing in Cuidala moves the task's due date. The app holds the task id.
- The Year view gets "Put my year on Google" as the bulk action.
- **Start the paperwork now.** Google Cloud project, OAuth consent screen, and verification for the tasks scope, which is sensitive and takes weeks. It is independent of the code and is the long pole.
- **Reminders** ("a task to the event" could also mean Apple Reminders) needs full access and a prompt. Ask before building.

---

## After 1.0

- Widget button that deep-links to `cuidala://low` and opens the capture line.
- Siri intent with tracked items as entities.
- Google Tasks connection (Workstream D, 1.1).
- Apple Reminders, if testers ask.

---

## Sequencing

Two tracks, in parallel. Neither blocks the other.

| Track | Order | Contents |
|---|---|---|
| Web | 1 | Workstream A copy pass, all three languages |
| Web | 2 | Haul list, capture line with confirm chip, usual-item chips, low flag |
| Web | 3 | Unified walk with Low / Out, silence-means-fine, "Worth a look" ordering, learning state, cleaner visit pass, digest deep link |
| Web | 4 | "Another size?", one chore with a supply per size, household v9 migration |
| Native | 1 | Calendar plugin: EventKit edit sheet, Google link builder, .ics share, calendar-choice setting, offer at playbook acceptance |
| Paperwork | now | Google Cloud project and OAuth verification for Google Tasks |

Everything on both tracks fits before the 1.0 submission. Only the post-1.0 list adds App Review surface.

---

## Data model changes (household v8 to v9)

- `Household.haulItems: { id, name, addedAt, standing?: boolean }[]`
- `Household.haulHistory: { name, boughtAt }[]`, capped, feeds usual-item chips and repeat offers
- `SupplyAutomation.flaggedLowAt?: string`
- `SupplyAutomation.assetId?: string` (optional unit link for a size)
- `Household.calendarChoice?: "google" | "apple"`
- `Duty.calendarEventId?: string` (Apple path, to avoid double-adding)

---

## Open questions for the tester

1. Is an event with the checklist in its description a good enough stand-in for a few months, or is the checkable task the whole point?
2. When you think "what do I owe the house this month", do you open Google Calendar, Google Tasks, or Apple Reminders?
3. "Your home is now Kept": does that sentence make sense to you? Would "Looked after" be better?
4. Should the haul accept groceries at all, or only household supplies?

---

## How we will verify

- `npm test`, `npm run typecheck`, `npm run lint`.
- Simulator pass through XcodeBuildMCP: Today open state on three consecutive days (headline rotation), finish state, year view, settings, Restock haul, the walk, and the calendar offer after accepting a playbook.
- Read every changed screen aloud once.
