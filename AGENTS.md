# PushUp — Project Conventions

## Tech Stack
TypeScript (strict), esbuild bundler, vitest for testing, VS Code Extension API

## Build & Test Commands
- `npm run compile` — Type-check + bundle
- `npm test` — Run all unit tests
- `npm run test:coverage` — Tests with coverage

## Project Structure
- `src/` — Source code
- `src/__tests__/` — Tests (vitest)
- `src/__tests__/setup.ts` — Shared vscode module mock
- `dist/` — Bundle output (gitignored)

## Critical Feedback Policy

Be direct and critical — no flattery, no praise, no “Great job.” Prioritize finding flaws and proposing improvements over highlighting positives. When in doubt, prefer more detailed explanations over brevity.
When planning ANY task (plan mode) or reading specs (@SPEC.md, etc.), ALWAYS use AskUserQuestionTool to interview me in detail about literally anything: technical implementation, UI & UX, concerns, tradeoffs, edge cases, priorities, etc.

## Coding Rules

- **Never delete existing comments** when editing code. Only remove a comment if it is factually wrong or the code it describes has been removed.
- Do not add oneline comments for obvious code.
- Never create temporary files in the project root (including `tmpclaude-*-cwd` or `nul`). Use `/dev/null` for discards in Git Bash. Work in a dedicated `/tmp` subdirectory if scratch space is needed, and clean up immediately after use.

## Testing Rules
- **Run `npm test` after all major changes** to verify nothing is broken
- Tests must not depend on network access or real filesystem state
- Mock external modules (vscode, ssh2-sftp-client, basic-ftp, fs) in tests
- Use `vi.useFakeTimers()` for any test involving setTimeout/setInterval


