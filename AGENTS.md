# Repository Guidelines

## Project Structure & Module Organization

RPG Crafter is a pnpm workspace organized as a small TypeScript monorepo:

- `apps/studio/` contains the React 19 visual editor. UI components live in `src/components/`, while editor and content logic belongs in `src/lib/`.
- `apps/player/` contains the PixiJS runtime and renderer.
- `packages/game-schema/` defines shared Zod schemas, TypeScript types, migrations, autotiling, and navigation behavior.
- `content/reference-game/` is the bundled example project used for development and validation.
- `assets/` stores redistributable sprites and tilesets; `scripts/` contains asset and reference-content generators.

Keep workspace tests in the adjacent `tests/` directory and mirror the source filename where practical.

## Build, Test, and Development Commands

Use Node.js LTS and pnpm 10. From the repository root:

```bash
pnpm install       # Install all workspace dependencies
pnpm dev           # Run the Studio at http://localhost:4174
pnpm dev:player    # Run the Player at http://localhost:4173
pnpm check         # Type-check every workspace
pnpm test          # Run all Vitest suites once
pnpm build         # Build applications and validate packages
```

Target one workspace during iteration, for example `pnpm --filter @rpgcrafter/studio test`.

## Coding Style & Naming Conventions

Write strict TypeScript using two-space indentation, single quotes, and semicolons, matching the existing files. Use `kebab-case` filenames (`event-inspector.tsx`), `PascalCase` React components, and `camelCase` functions and variables. Keep shared data contracts in `game-schema`; avoid duplicating schema logic in either app. The Studio supports the `@/` alias for `src/`. No repository-wide formatter or linter is configured, so preserve local style and rely on `pnpm check`.

Write all README files and code comments in English. Do not use French or any other language for README content or comments.

## Testing Guidelines

Vitest is the test runner. Studio component tests use Testing Library, `jsdom`, and setup from `apps/studio/tests/setup.ts`; runtime and schema tests run in Node. Name tests `*.test.ts` or `*.test.tsx`. Add regression tests for behavioral fixes and cover schema migrations or validation changes with representative content. Run the affected workspace test first, then `pnpm test` and `pnpm check` before submitting.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, sentence-case subjects such as `Remove obsolete project files`. Keep each commit focused. Pull requests should explain the user-visible effect, identify affected workspaces, link relevant issues, and list verification commands. Include screenshots or a short recording for Studio UI changes. Do not contribute proprietary RPG Maker code or assets; only add material that can be redistributed.
