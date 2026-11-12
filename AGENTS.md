# Repository agent instructions

## Project context

- Load project context before broad repository exploration. Use the configured `context-load` workflow; do not guess a machine-specific context-store path.
- If a `.codegraph/` directory exists at the repository root, use CodeGraph before grep/find when locating or understanding code. If it does not exist, skip CodeGraph.
- Treat context notes as an index. Verify behavior, APIs, and commands against current repository files.
- For a small change with a known location, use `quick-fix`; for broad or unclear work, use `deep-task`. Ask before guessing about behavior, data, or public interfaces.
- Read project checks and run commands from the project overview and manifests. Do not invent commands based only on the stack.
- Preserve user changes. Never put secrets, API keys, tokens, or customer data in source, documentation, context notes, or commits.
- Use `context-update` when a change establishes durable behavior, architecture, commands, or conventions. Use `session-handoff` if work is paused or transferred.

## Feature branch and delivery workflow

- Start each feature on a new `feat-<short-slug>` branch from the current base before editing.
- Keep each feature's changes scoped to its branch. Stage and commit only files belonging to that feature; do not amend shared history, force-push, or push directly to `main`.
- When a feature is complete, commit it and push its feature branch to `origin`. Report the branch, commit, and push result accurately.
- Keep `.env` and other local secret files untracked. Add only variable names and empty placeholders to `.env.example`; never commit a real credential.
