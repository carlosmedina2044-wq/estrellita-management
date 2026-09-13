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
