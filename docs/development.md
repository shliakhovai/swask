# Development

Use Node.js 24 and npm. No global tools are required.

```sh
npm install
npm run dev
```

## Checks

```sh
npm run check
npm run build
npx playwright install
npm run test:e2e
```

`check` includes formatting, ESLint, strict TypeScript and unit tests. Browser tests cover Chromium, Firefox, WebKit and a mobile WebKit viewport. CI installs browser system dependencies automatically.

The server runs TypeScript directly with Node.js 24. Use top-level `import type` for imports containing only types; inline-only type specifiers can retain a runtime module import. ESLint enforces this, and `verbatimModuleSyntax` keeps compiler checks aligned with Node's type stripping.

Husky installs hooks during `npm install`. Pre-commit formats staged files, runs ESLint, type checks and unit tests. Commit messages use `type(scope): summary`, for example `feat(tasks): group tasks by deadline`.

## Git workflow

One feature per `codex/<feature>` branch and PR. Keep commits small and meaningful. For dependent features, use stacked PRs targeting the previous branch; merge in order and retarget the next PR to `master`. Use merge commits for the initial stack to preserve ancestry. If choosing squash/rebase merge, rebase the remaining stack onto the updated base before retargeting. The initial implementation follows this workflow. A PR must describe resulting behavior and its validation; secrets and local data are never committed.
