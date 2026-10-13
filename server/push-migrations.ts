export const PUSH_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS swask_push_subscriptions (id text PRIMARY KEY, subscription jsonb NOT NULL, timezone text NOT NULL, reminder_time text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS swask_push_deliveries (subscription_id text NOT NULL REFERENCES swask_push_subscriptions(id) ON DELETE CASCADE, task_id uuid NOT NULL REFERENCES swask_tasks(id) ON DELETE CASCADE, deadline text NOT NULL, sent_at timestamptz, locked_until timestamptz NOT NULL, PRIMARY KEY(subscription_id, task_id, deadline))`,
  `CREATE INDEX IF NOT EXISTS swask_deadline_idx ON swask_tasks ((data->>'deadline'))`,
  `INSERT INTO swask_migrations(version) VALUES (2) ON CONFLICT DO NOTHING`,
]
