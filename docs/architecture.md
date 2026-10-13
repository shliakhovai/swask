# Architecture

swask is a small React + TypeScript application built with Vite. Its two views share the same tasks: a deadline-grouped list and a swipe deck. The interface is Ukrainian, light, keyboard accessible and responsive.

## Boundaries

Calendar utilities accept dates from `1900-01-01` through `9999-12-31` and reject date arithmetic outside that range with a `RangeError`.

- `src/lib`: calendar and domain logic, with behavior tests.
- `src/components`: focused UI components.
- `src/styles`: shared design tokens and responsive styles; no remote fonts or assets.
- `server`: server-only APIs, Neon access and background push delivery.
- `tests/e2e`: user journeys against the production build.

Deadlines are optional `YYYY-MM-DD` calendar dates displayed using the user's Ukrainian locale. Moving a deadline adds 1, 3 or 7 calendar days to the later of today and the existing deadline. Task data is saved locally first; Neon synchronization is optional and configured only on the server. Detailed sync and PWA contracts are documented with their implementation.
