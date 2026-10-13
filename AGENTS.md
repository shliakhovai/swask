# Working on swask

- Read [architecture](docs/architecture.md) and [development](docs/development.md) before changing behavior.
- One feature per `codex/<feature>` branch and pull request. Use Conventional Commits; never merge without the owner's request.
- Keep TypeScript strict. Validate storage, API and import boundaries; keep date-only deadlines in local calendar time.
- Offline task edits must persist before the UI reports success. Never overwrite unreadable saved data or drop pending changes.
- Keep Ukrainian copy, accessible buttons alongside gestures, responsive layouts and reduced-motion support.
- Keep secrets in server-side `.env`; never expose database credentials in browser code or `VITE_*` variables.
- Add behavior tests for data changes. Run `npm run check`, `npm run build` and relevant browser tests before opening a PR.
- Update the relevant docs when setup, schema, sync or build behavior changes. Keep this file small.
