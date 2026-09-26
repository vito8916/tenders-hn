import { Pool } from "pg";
import { env } from "./env";
import { docsConsumer } from "./jobs/docs";
import { ingestConsumer } from "./jobs/ingest";
import { maintenanceConsumer } from "./jobs/maintenance";
import { errorMessage, log } from "./log";
import { consumeQueue, type QueueConsumer } from "./queue";

const consumers: QueueConsumer[] = [maintenanceConsumer, ingestConsumer, docsConsumer];

const pool = new Pool({ connectionString: env.DATABASE_URL, max: consumers.length + 2 });
pool.on("error", (error) => log("error", "Idle database client error", { error: errorMessage(error) }));

const shutdown = new AbortController();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
        log("info", "Shutting down, finishing in-flight jobs", { signal });
        shutdown.abort();
    });
}

log("info", "Worker started", { workerId: env.WORKER_ID, version: env.WORKER_VERSION, queues: consumers.map((c) => c.queue) });

await Promise.all(consumers.map((consumer) => consumeQueue(pool, consumer, shutdown.signal)));
await pool.end();

log("info", "Worker stopped");
