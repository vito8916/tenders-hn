import type { Pool } from "pg";
import { z } from "zod";
import { errorMessage, log } from "./log";

const jobMessageSchema = z.looseObject({ type: z.string().min(1) });

export type JobMessage = z.infer<typeof jobMessageSchema>;

export type JobHandler = (message: JobMessage, context: { pool: Pool; attempt: number }) => Promise<void>;

export interface QueueConsumer {
    queue: string;
    handlers: Record<string, JobHandler>;
    /** Seconds a claimed message stays invisible to other consumers. */
    visibilityTimeoutSeconds: number;
    /** Attempts before a message is archived as a dead letter. */
    maxAttempts: number;
}

const POLL_SECONDS = 5;
const POLL_INTERVAL_MS = 250;
const READ_FAILURE_PAUSE_MS = 5_000;

/** Delay before the next attempt: 30s, 60s, 120s, ... capped at 30 minutes. */
export function retryDelaySeconds(attempt: number): number {
    return Math.min(30 * 2 ** (attempt - 1), 30 * 60);
}

interface QueueRow {
    msg_id: string;
    read_ct: number;
    enqueued_at: Date;
    message: unknown;
}

/** Archives the message as a dead letter and records why, for the admin app. */
async function archiveFailedJob(pool: Pool, queue: string, row: QueueRow, error: string) {
    await pool.query(
        `with failure as (
           insert into public.worker_job_failures (queue, msg_id, message, attempts, error, enqueued_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (queue, msg_id) do update
           set message = excluded.message, attempts = excluded.attempts, error = excluded.error, failed_at = now()
         )
         select pgmq.archive($1, $2::bigint)`,
        [queue, row.msg_id, JSON.stringify(row.message), row.read_ct, error, row.enqueued_at],
    );
}

async function processMessage(pool: Pool, consumer: QueueConsumer, row: QueueRow) {
    const { queue } = consumer;
    const fields = { queue, msgId: row.msg_id, attempt: row.read_ct };
    const parsed = jobMessageSchema.safeParse(row.message);
    const handler = parsed.success ? consumer.handlers[parsed.data.type] : undefined;

    if (!parsed.success || !handler) {
        log("error", "Unknown job message, archiving", { ...fields, payload: row.message });
        await archiveFailedJob(pool, queue, row, "Unknown job message");
        return;
    }

    try {
        await handler(parsed.data, { pool, attempt: row.read_ct });
        await pool.query("select pgmq.delete($1, $2::bigint)", [queue, row.msg_id]);
    } catch (error) {
        if (row.read_ct >= consumer.maxAttempts) {
            log("error", "Job failed permanently, archiving", { ...fields, type: parsed.data.type, error: errorMessage(error) });
            await archiveFailedJob(pool, queue, row, errorMessage(error));
            return;
        }

        const delay = retryDelaySeconds(row.read_ct);
        log("warn", "Job failed, will retry", { ...fields, type: parsed.data.type, retryInSeconds: delay, error: errorMessage(error) });
        await pool.query("select pgmq.set_vt($1, $2::bigint, $3)", [queue, row.msg_id, delay]);
    }
}

/**
 * Reads one message at a time from a pgmq queue until `signal` aborts.
 * Successful jobs are deleted; failed jobs become visible again after an
 * exponential delay; jobs that exhaust their attempts are archived and
 * recorded in worker_job_failures.
 */
export async function consumeQueue(pool: Pool, consumer: QueueConsumer, signal: AbortSignal) {
    log("info", "Consuming queue", { queue: consumer.queue });

    while (!signal.aborted) {
        let rows: QueueRow[];
        try {
            const result = await pool.query<QueueRow>(
                "select msg_id, read_ct, enqueued_at, message from pgmq.read_with_poll($1, $2, 1, $3, $4)",
                [consumer.queue, consumer.visibilityTimeoutSeconds, POLL_SECONDS, POLL_INTERVAL_MS],
            );
            rows = result.rows;
        } catch (error) {
            if (signal.aborted) break;
            log("error", "Queue read failed", { queue: consumer.queue, error: errorMessage(error) });
            await new Promise((resolve) => setTimeout(resolve, READ_FAILURE_PAUSE_MS));
            continue;
        }

        for (const row of rows) {
            await processMessage(pool, consumer, row);
        }
    }

    log("info", "Stopped consuming queue", { queue: consumer.queue });
}
