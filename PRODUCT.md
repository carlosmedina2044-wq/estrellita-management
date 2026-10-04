# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users
The household manager: the one adult who keeps the home running. They open the
app for a quick daily check of what is left to do, and again when supplies run
low. Confirmed with the owner on 2026-10-04; the first outside tester (see
`docs/FEEDBACK_PLAN_2026-09-19.md`) fits this profile.

## Product Purpose
Cuidala (repo folder `estrellita-management`, bundle id `com.cuidala.app`) helps
a household keep up with home maintenance: chores by room, seasonal jobs,
restock reminders, and a forecast of repair costs. Success is a person finishing
the day's short list and trusting that nothing slipped, without having to think
about it. Goal as of 2026-09: a first App Store submission, v1.0, free, US.

## Positioning
- **Private and on-device.** No account, no Cuidala server. Data stays on the
  iPhone, encrypted behind a biometric-bound key.
- **Restock built in.** Supplies are tracked alongside chores, with a level and
  an order-by date, so "what are we low on" lives in the same app as "what is
  left today".
- **A house that reacts.** An illustrated house shows how well kept the home is
  and responds when the day's list is finished.

## Operating Context
Used one-handed on an iPhone, in short sessions, often standing in the room the
chore belongs to. Walks the house weekly to check supplies. Seasonal jobs may
also be sent to the user's own calendar. Local weather informs some chores.

## Capabilities and Constraints
- Next.js static export inside a Capacitor 8 WKWebView; iPhone only.
- Languages: English, Spanish, Brazilian Portuguese. Copy must read the same in
  all three, never as a literal translation of jargon.
- Local-first: no server, so nothing may assume an account or sync.
- Terminology: things are **done** or **left**; a day is **all done**; a streak
  is a **streak**. Never use model words in user-facing copy (closed, run, arc,
  asset, duty, fired, window, lead time). See AGENTS.md, "Plain language rule".
- Weather comes from WeatherKit, with Apple attribution required.

## Brand Commitments
Name and bundle id above. Voice: plain, spoken, friendly. The brand lockup and
logo studies live in `design/brand` and `design/logo-examples`.

## Evidence on Hand
- Feedback from one outside tester: `docs/FEEDBACK_PLAN_2026-09-19.md`.
- Review and readiness notes: `docs/REVIEW_2026-09-19.md`,
  `docs/APP_STORE_SUBMISSION.md`.
- No public testimonials, usage numbers or reviews exist yet. Do not invent any.

## Product Principles
1. **Left, not logged.** Lead with how many things are left; that is what tells
   someone they are finished.
2. **Plain words.** Every sentence is one you would say aloud to a friend who has
   never opened the app.
3. **Progress before decoration.** Show what to do and what is done first; the
   illustrated house and rewards support that, they never compete with it.
4. **Private by default.** Nothing leaves the phone without the person asking.
5. **Calm.** A home app should lower worry; avoid pressure, guilt and noise.

## Accessibility & Inclusion
No formal standard has been set. Working bar: Dynamic Type, VoiceOver labels,
Reduce Motion honoured (shipped in the motion pass), 44pt minimum targets, and
text contrast of at least 4.5:1. Three locales are supported.
