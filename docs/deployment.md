# Build and deployment

Local development is just `npm install` and `npm run dev`. The Node server serves both the app and its API on one origin. With no `DATABASE_URL`, it runs in local mode.

## Production

```sh
npm ci
npm run build
npm start
```

The production default is port 4173; `HOST` and `PORT` can override it. Use an HTTPS reverse proxy or a hosting platform with HTTPS for installed PWA, offline caching and push support on other devices. Neon provides the database connection; hosting the Node app is a separate step. Static hosting alone cannot synchronize or send background reminders.

The service worker intentionally runs only in the production build. `npm run preview` runs the same Node production server, so it also exercises the API rather than a separate static server.

## Optional container

```sh
docker build -t swask .
docker run --rm --env-file .env -p 4173:4173 swask
```

The image runs as a non-root user, contains only production dependencies and keeps `.env` out of the build context. Supply secrets at runtime. `/api/health` reports application availability; database readiness is checked during synchronization.

## CI/CD

Every PR and push to `master` runs formatting, lint, type checks, unit/PostgreSQL tests, production build, Chromium/Firefox/WebKit/mobile browser journeys and a container build/startup check. The runtime smoke test checks health and the PWA manifest using only production dependencies. GitHub actions are pinned to verified commit SHAs.

After CI passes on `master`, the publish workflow builds that exact commit and pushes `latest` and commit-SHA tags to `ghcr.io/shliakhovai/swask`, using GitHub's scoped workflow token. No external server is deployed automatically. Point your hosting service at the image when ready. PR workflows cannot publish images.

Reference: [GitHub container publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
