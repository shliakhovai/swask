// Each entry is a single SQL statement, including the complete function body.
// The Neon driver executes the array in one transaction. Re-running is safe.
export const TASK_MIGRATION = [
  `CREATE TABLE IF NOT EXISTS swask_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS swask_tasks (id uuid PRIMARY KEY, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS swask_operations (id uuid PRIMARY KEY, processed_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION swask_apply_operations(operations jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE operation jsonb; task_id uuid; timestamp_text text;
    BEGIN
      -- One personal workspace: serialize batches to preserve a consistent snapshot.
      PERFORM pg_advisory_xact_lock(19842026);
      FOR operation IN SELECT value FROM jsonb_array_elements(operations) LOOP
        INSERT INTO swask_operations(id) VALUES ((operation->>'id')::uuid) ON CONFLICT DO NOTHING;
        IF NOT FOUND THEN CONTINUE; END IF;
        task_id := (operation->>'taskId')::uuid;
        timestamp_text := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
        IF operation->>'kind' = 'create' THEN
          INSERT INTO swask_tasks(id, data) VALUES (task_id, (operation->'task') || jsonb_build_object(
            'updatedAt', timestamp_text,
            'completedAt', CASE WHEN (operation->'task'->>'completed')::boolean
              THEN coalesce(nullif(operation->'task'->'completedAt', 'null'::jsonb), operation->'task'->'updatedAt')
              ELSE 'null'::jsonb END
          )) ON CONFLICT DO NOTHING;
        ELSIF operation->>'kind' = 'update' THEN
          UPDATE swask_tasks SET data = data || (operation->'changes') || jsonb_build_object(
            'updatedAt', timestamp_text,
            'completedAt', CASE
              WHEN operation->'changes'->'completed' = 'false'::jsonb THEN 'null'::jsonb
              WHEN operation->'changes'->'completed' = 'true'::jsonb AND (data->>'completed')::boolean = false THEN operation->'at'
              WHEN (data->>'completed')::boolean THEN coalesce(nullif(data->'completedAt', 'null'::jsonb), data->'updatedAt')
              ELSE 'null'::jsonb END
          )
          WHERE id = task_id AND (data->>'deleted')::boolean = false;
        ELSIF operation->>'kind' = 'delete' THEN
          UPDATE swask_tasks SET data = data || jsonb_build_object('deleted', true, 'updatedAt', timestamp_text) WHERE id = task_id;
        ELSE
          RAISE EXCEPTION 'Unknown operation';
        END IF;
      END LOOP;
      RETURN (SELECT coalesce(jsonb_agg(data ORDER BY id), '[]'::jsonb) FROM swask_tasks);
    END;
  $$`,
  `INSERT INTO swask_migrations(version) VALUES (1) ON CONFLICT DO NOTHING`,
]
