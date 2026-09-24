import { hostname } from "node:os";
import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    // Storage for raw source pages (and documents in Phase 2).
    SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    // Railway sets RAILWAY_REPLICA_ID / RAILWAY_GIT_COMMIT_SHA; locally they fall back.
    WORKER_ID: z.string().min(1).default(process.env.RAILWAY_REPLICA_ID ?? hostname()),
    WORKER_VERSION: z.string().min(1).default(process.env.RAILWAY_GIT_COMMIT_SHA ?? "dev"),
    AI_GATEWAY_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
