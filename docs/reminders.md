# Reminders

Reminder preferences follow the same storage-safety contract as tasks: unreadable data blocks writes, can be downloaded, and is replaced only by an explicit reset. Each edit reads the latest preferences so other tabs' changes are preserved.

Push opt-in saves the server subscription before its local flag. A failed local write compensates with server deletion and browser unsubscription, including pre-existing subscriptions. Failed cleanup keeps a retryable handle and explains how to disable it. Opt-out remains available after notification permission is revoked. Subscription mutations include the expected workspace ID and reject a mismatch before database writes.

The worker rechecks its invalidation revision after reserving a delivery. A stale reservation is released without sending; sent receipts are preserved.

Every device starts with in-app reminders at 09:00 in its local time zone. Settings can change the time and disable in-app reminders. The banner includes incomplete tasks due today or earlier, updates after focus and at most 30 seconds after a minute change, and can be dismissed for the current day. Tasks without deadlines do not produce reminders.

## Background Web Push

```sh
npm run setup
```

Setup generates a workspace access key and matching VAPID public/private keys in the ignored `.env`, preserving any existing values. Add `DATABASE_URL` from Neon. Keep VAPID keys stable once devices subscribe. `VAPID_SUBJECT` is a public contact HTTPS URL or a mailto address; the default points to this repository. No private key is exposed to browser code.

Build and run the production application, connect the device to your workspace in settings, then enable push reminders. The browser asks for notification permission only after that button is pressed. On iPhone/iPad, install the PWA on the home screen before enabling push. Other devices require a browser that supports Push API. Production must use HTTPS; localhost works for desktop development. Plain HTTP on a LAN address cannot provide a full PWA or Web Push.

Background reminders require one continuously running Node server with internet access. Neon stores tasks and subscriptions; Neon alone does not run the reminder worker. Deploy one server/worker instance for this personal workspace. Multiple app instances need explicit cache invalidation or a dedicated worker before deployment; the current container is intended to run as one instance.

## Delivery behavior

The worker checks the clock every minute and sends a reminder near the selected time on the deadline date. It caches subscriptions and the dates already checked, and invalidates that cache after task edits and subscription changes. It does not poll Neon every minute while idle; database access resumes when a reminder is due or the workspace changes.

Each subscription/task/deadline has a persistent PostgreSQL delivery record. A five-minute lease prevents concurrent sends; successful delivery closes the record, transient failures retry after the lease, and HTTP 404/410 removes an expired subscription. A pending retry is distinct from a settled delivery. Claims recheck whether the task is still active and has the same deadline. Browser notification tags consolidate retries. Postponing to another date allows a new reminder for that deadline.

Clicking a notification focuses an existing application window and returns to the task list, or opens swask. Push is best-effort: permissions, OS settings, internet access and browser delivery rules affect arrival time. Offline/closed-app delivery is not guaranteed; in-app reminders show due and overdue tasks after opening. A successful push may stay queued by the provider for up to 24 hours.

## Verification

Unit tests cover time zones/DST, preferences, task filtering, retry leases, cache invalidation, expired subscriptions and authorization. PGlite runs the real delivery-table SQL. Browser tests check time selection and persistent dismissal in all supported test browsers. A Chromium protocol test delivers a push event into the actual production service worker and mocks only the native notification display API, since automated browser profiles deny notification permission. No provider is contacted. Complete an end-to-end test with your real Neon database and subscribed device after supplying credentials.

References: [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [Web Push on iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push library](https://github.com/web-push-libs/web-push).
