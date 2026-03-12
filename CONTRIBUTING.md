# Contributing to PushUp

## Dev Setup

```bash
git clone https://github.com/ilian-iliev/pushup.git
cd pushup
npm install
```

Then open the project in VS Code and press **F5**. This launches an Extension Development Host with the extension loaded.

> The extension activates only when a `.pushup.json` file exists in the workspace. To test, create one in the dev host's open folder.

## Build & Test Commands

```bash
npm run compile       # Type-check + bundle
npm run check-types   # Type-check only
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Tests with coverage report
```

## Building a .vsix

```bash
npm run package
```

This type-checks, bundles, and packages the extension into a `.vsix` file.

## Project Structure

| Path | Description |
|------|-------------|
| `src/` | Source code |
| `src/__tests__/` | Unit tests (vitest) |
| `dist/` | Bundle output (gitignored) |
| `.pushup.json` | Per-project config (user-facing) |
| `esbuild.js` | Build script |

## Coding Conventions

See [AGENTS.md](AGENTS.md) for coding rules, testing rules, and the critical feedback policy.
