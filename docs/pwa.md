# PWA and offline use

The production build contains a web manifest, maskable/regular PNG icons, an Apple touch icon and a Workbox service worker. All application assets are local and precached; navigation falls back to the cached application shell. API requests are excluded from navigation caching. No fonts, scripts or artwork depend on an external CDN.

After one successful online visit and service-worker activation, swask opens and reloads offline. Tasks can be created, edited, completed, deleted and postponed without a network. Local task writes do not depend on the worker. Pending synchronization operations stay on the device until the server acknowledges them.

## Local verification

```sh
npm run build
npm run preview
```

Service workers are disabled in the development server to avoid stale development files. Use the production preview for install/offline/push verification. A service worker requires HTTPS or localhost; plain HTTP on a LAN IP supports basic UI but cannot provide an installable offline PWA.

The browser's installation menu works where supported. Chromium may expose a one-click install button in settings. On iPhone/iPad, open the app in Safari and choose Share → Add to Home Screen.

## Updates and limits

Updates ask before activating; the update button stays disabled while a task editor or settings dialog is open. Changes are already persisted before the page can reload. Browsers may evict local storage and caches; private browsing can limit persistence. Cloud synchronization provides a second copy when configured.

`npm run icons` regenerates the committed PNG icons from `public/icon.svg`. End-to-end tests activate the actual production worker, disconnect the browser, reload and edit a task.

References: [Vite PWA injectManifest](https://vite-pwa-org.netlify.app/guide/inject-manifest), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
