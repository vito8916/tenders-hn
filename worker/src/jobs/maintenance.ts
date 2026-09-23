import { env } from "../env";
import type { QueueConsumer } from "../queue";

const startedAt = new Date();

export const maintenanceConsumer: QueueConsumer = {
    queue: "maintenance",
    visibilityTimeoutSeconds: 60,
    maxAttempts: 3,
    handlers: {
        // Enqueued every minute by pg_cron; proves the worker is alive and consuming.
        heartbeat: async (_message, { pool }) => {
            await pool.query(
                `insert into public.worker_heartbeats (worker_id, version, started_at, last_heartbeat_at)
                 values ($1, $2, $3, now())
                 on conflict (worker_id) do update
                 set version = excluded.version,
                     started_at = excluded.started_at,
                     last_heartbeat_at = now()`,
                [env.WORKER_ID, env.WORKER_VERSION, startedAt],
            );
        },
    },
};
