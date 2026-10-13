# Neon synchronization

## Setup

The app works in local mode with only `npm install` and `npm run dev`. To connect your Neon PostgreSQL database:

```sh
npm run setup
```

The command creates a private, ignored `.env` with a random `SWASK_SYNC_KEY`. Add your Neon connection string as `DATABASE_URL`, then restart `npm run dev`. No separate database installation is needed. The first synchronization automatically applies the idempotent schema migration. You can also run `npm run db:migrate` to prepare it explicitly.

On each device, open the same application URL and enter `SWASK_SYNC_KEY` in Settings → Між твоїми пристроями. Do not paste `DATABASE_URL` into the UI. The key grants access to one shared personal workspace; this version has no individual accounts or separate user workspaces. Use a dedicated Neon database/schema for swask.

Production requires the Node server, not just static hosting. `DATABASE_URL` and the access key stay server-side; they are not bundled into browser assets. The browser stores only the device access key and its own task copy. HTTP API responses are never cached by the worker. Authentication uses a bearer key, constant-time comparison and no cross-origin API access.

## Offline and conflicts

- Every edit atomically saves the updated task document and a UUID operation locally before success is shown.
- Foreground devices poll every 30 seconds, synchronize shortly after edits, and retry on focus/reconnection. Batches contain at most 100 operations.
- PostgreSQL applies each batch atomically and records operation UUIDs, making retries idempotent. A personal-workspace advisory lock serializes batches and their returned snapshots.
- Updates contain only changed fields. Changes to different fields merge; when two devices change the same field, the last operation received by the server wins, including offline edits delivered later. Client clocks do not decide conflicts.
- Deletion retains a tombstone and wins over later stale updates/creates. A deleted task is not restored automatically.
- A response acknowledges only the submitted UUIDs. The client replays edits made during the request onto the received snapshot and persists it before dropping acknowledged operations.
- A device binds to its first cloud workspace. It refuses to upload into a different database until the user handles its local copy; rotating database passwords does not change the binding.
- Each sync request includes its expected `spaceId`. The server rejects a mismatch before touching the database, including when the same origin is redeployed while a tab has cached configuration.
- Device key changes propagate through browser storage events. Disconnecting invalidates all open tabs and their in-flight responses; connecting in one tab also reconnects the others.
- Completion records the original operation time in `completedAt`; server receipt timestamps and later field edits do not move older completions into today's count.

Storage and migration details: `src/lib/task-store.ts`, `src/lib/sync-client.ts`, `server/migrations.ts`, `server/repository.ts`. PGlite tests execute the actual PostgreSQL migration and cover retries, field conflicts, tombstones, rollback and migration reruns. Neon connectivity must be verified after adding real credentials.

Reference: [official Neon driver](https://github.com/neondatabase/serverless).
