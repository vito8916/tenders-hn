import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
    processDetailSchema,
    processEventSchema,
    sourceDocumentSchema,
    type FeedbackDecision,
    type ProcessDetail,
    type ProcessEvent,
    type SourceDocument,
} from "./schemas";

// ========== QUERIES ==========

/** The process's current version: its id, when it was seen, and its parsed detail. */
export async function getCurrentProcessVersion(processId: string): Promise<{ versionId: string; observedAt: string; detail: ProcessDetail } | null> {
    const supabase = await createClient();
    const { data: process, error } = await supabase.from("procurement_processes").select("current_version_id").eq("id", processId).maybeSingle();

    if (error) throw error;
    if (!process?.current_version_id) return null;

    const { data: version, error: versionError } = await supabase
        .from("process_versions")
        .select("id, observed_at, detail")
        .eq("id", process.current_version_id)
        .single();

    if (versionError) throw versionError;
    return { versionId: version.id, observedAt: version.observed_at, detail: processDetailSchema.parse(version.detail) };
}

/** What changed in the process, newest first; its creation is left out. */
export async function listProcessEvents(processId: string): Promise<ProcessEvent[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("process_events")
        .select("id, kind, before, after, observed_at")
        .eq("process_id", processId)
        .neq("kind", "created")
        .order("observed_at", { ascending: false })
        .limit(50);

    if (error) throw error;
    return data.map((row) =>
        processEventSchema.parse({ id: row.id, kind: row.kind, before: row.before, after: row.after, observedAt: row.observed_at }),
    );
}

/** The documents published for the process and not removed since. */
export async function listProcessDocuments(processId: string): Promise<SourceDocument[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("source_documents")
        .select("id, title, kind, source_url, first_seen_at")
        .eq("process_id", processId)
        .is("removed_at", null)
        .order("first_seen_at");

    if (error) throw error;
    return data.map((row) =>
        sourceDocumentSchema.parse({ id: row.id, title: row.title, kind: row.kind, sourceUrl: row.source_url, firstSeenAt: row.first_seen_at }),
    );
}

export async function getFeedback(orgId: string, processId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("opportunity_feedback")
        .select("decision, reason, decided_at, decided_by")
        .eq("org_id", orgId)
        .eq("process_id", processId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

// ========== MUTATIONS ==========

export async function upsertFeedback(params: { orgId: string; processId: string; userId: string; decision: FeedbackDecision; reason: string | null }) {
    const supabase = await createClient();
    const { error } = await supabase.from("opportunity_feedback").upsert({
        org_id: params.orgId,
        process_id: params.processId,
        decision: params.decision,
        reason: params.reason,
        decided_by: params.userId,
        decided_at: new Date().toISOString(),
    });

    if (error) throw error;
}

export async function deleteFeedback(orgId: string, processId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("opportunity_feedback").delete().eq("org_id", orgId).eq("process_id", processId);

    if (error) throw error;
}
