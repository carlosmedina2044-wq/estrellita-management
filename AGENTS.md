<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## iOS review workflow

For any review, audit, refactor, or new-feature request:

1. First consult all installed skills (project: `.agents/skills/`; global: `~/.agents/skills/`).
2. Select the applicable ones for the task, **name them**, and apply them.
3. Always prefer **XcodeBuildMCP** over raw `xcodebuild` / `simctl`.
4. Always prefer **Sosumi** (`https://sosumi.ai/mcp`) over recalled Apple API details.

## Plain language rule

A tester could not parse "About 20 min to a closed day" — it took an explanation
to learn it meant "finish the two things left and you're done for today." That
sentence used a word the code invented (`DayArcState`'s `"closed"`) instead of
a word a person would say. See `docs/FEEDBACK_PLAN_2026-09-19.md` for the full
audit and the fix.

Every user-facing string (in `src/i18n/messages/*.json`, and any inline copy)
must be one you would say out loud to a friend who has never opened the app:

- Use the words already on the buttons: things are **done** or **left**, a day
  is **all done**, a streak is a **streak**.
- Lead with **how many things are left** — that's what tells someone they're
  finished. Minutes, dates and other stats are secondary.
- Never reuse a model/type name as user-facing copy (`closed`, `run`, `arc`,
  `asset`, `duty`, `fired`, `window`, `lead time`) unless a button already
  uses that word for the same thing.
- When a screen rotates between phrasings for variety, every phrasing must
  independently pass this test — never rotate a clear line with an unclear
  one.
- Read new copy aloud once before committing it.

All three locales (`en`, `es`, `pt-BR`) carry the same rule — a literal
translation of jargon is still jargon.
