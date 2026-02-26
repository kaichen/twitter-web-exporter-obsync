# Repository Guidelines

## Project Structure & Module Organization
- `src/`: application code (TypeScript + Preact). Key areas:
  - `src/modules/`: feature modules and XHR interceptors (e.g., `home-timeline`).
  - `src/core/`: app shell, extension manager, database, options.
  - `src/components/`: UI (modals, tables, shared components).
  - `src/utils/`: helpers (exporting, API parsing, logging).
  - `src/i18n/`: translations and i18next setup.
  - `src/types/`: shared type definitions.
- `docs/`: screenshots and docs assets.
- `vite.config.ts`: build config and userscript metadata (vite-plugin-monkey).
- `eslint.config.js`, `tailwind.config.js`: linting and styling.

## Build, Test, and Development Commands
- `bun run dev`: start Vite dev server for local development.
- `bun run build`: typecheck (`tsc`) and build the userscript bundle.
- `bun run preview`: preview the production build.
- `bun run lint`: run ESLint (TypeScript + Prettier rules).
- `bun run changelog`: generate `CHANGELOG.md` via git-cliff.

## Package Manager
- Use `bun` as the default and primary package manager for this repository.
- Use `bun install` for dependency installation and keep `bun.lock` as the source-of-truth lockfile.
- Prefer `bun run <script>` for all package scripts unless a task explicitly requires another toolchain.

## Coding Style & Naming Conventions
- Language: TypeScript with Preact JSX (`.tsx` for UI).
- Style: ESLint + Prettier (see `eslint.config.js`).
- Naming: files and folders are kebab-case (e.g., `home-timeline`); components and classes are PascalCase.
- Userscript metadata (`@grant`, `@connect`, `@match`) is defined in `vite.config.ts`.

## Testing Guidelines
- No automated test suite is configured in this repo. Rely on linting and manual verification in the browser.
- If you add tests, document the runner and command in this file.

## Commit & Pull Request Guidelines
- Commit messages should follow Conventional Commits (commitlint config: `.commitlintrc`). Example: `feat(sync): add obsidian exporter`.
- PRs should include: a concise description, test/verification steps, and screenshots for UI changes.

## Security & Configuration Tips
- API keys or local integration tokens should not be committed. Use placeholders in code and document where to fill them (e.g., `src/utils/obsidian.ts`).
- Be mindful of X.com CSP; cross-origin requests should use `GM_xmlhttpRequest` with `@connect` configured.
