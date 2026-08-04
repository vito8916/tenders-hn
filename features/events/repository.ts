import 'server-only';
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { appEventSchema, type AppEvent, type LogAppEventInput } from "./schemas";

// ========== QUERIES ==========

/**
 * Lists the most recent events of an organization
 * (RLS: only org owner/admin can read)
 * @throws Supabase error if query fails
 */
export async function listRecentEvents(params: {
    orgId: string;
    limit?: number;
    offset?: number;
}): Promise<AppEvent[]> {
    const supabase = await createClient();
    const limit = params.limit ?? 10;
    const offset = params.offset ?? 0;

    const { data, error } = await supabase
        .from("app_events")
        .select("*")
        .eq("org_id", params.orgId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) throw error;

    return data.map((row) =>
        appEventSchema.parse({
            id: row.id,
            eventName: row.event_name,
            orgId: row.org_id,
            userId: row.user_id,
            metadata: row.metadata,
            createdAt: row.created_at,
        })
    );
}

// ========== MUTATIONS ==========

/**
 * Logs an app event via the log_app_event RPC (SECURITY DEFINER)
 * The database resolves user_id from the authenticated session
 * @throws Supabase error if the RPC fails
 */
export async function logAppEvent(input: LogAppEventInput): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.rpc("log_app_event", {
        p_event_name: input.eventName,
        p_org_id: input.orgId ?? undefined,
        p_metadata: (input.metadata ?? {}) as Json,
    });

    if (error) throw error;
}
