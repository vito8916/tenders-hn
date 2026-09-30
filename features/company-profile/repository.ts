import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
    companyProfileSchema,
    type CompanyProfile,
    type CompanyProfileInput,
    type ImprovableField,
    type ImprovementsRemaining,
} from "./schemas";

// ========== QUERIES ==========

export async function getCompanyProfile(orgId: string): Promise<CompanyProfile | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("company_profiles")
        .select("description, offerings, exclusions, locations, version, updated_at")
        .eq("org_id", orgId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return companyProfileSchema.parse({ ...data, updatedAt: data.updated_at });
}

export async function getImprovementsRemaining(): Promise<ImprovementsRemaining> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("profile_improvements_remaining");

    if (error) throw error;

    const rows = z.array(z.object({ field: z.string(), remaining: z.number().int() })).parse(data);
    const remainingFor = (field: ImprovableField) => rows.find((row) => row.field === field)?.remaining ?? 0;
    return { description: remainingFor("description"), offerings: remainingFor("offerings"), exclusions: remainingFor("exclusions") };
}

// ========== MUTATIONS ==========

/** Saves the profile and returns its version; raises insufficient_role or empty_profile. */
export async function saveCompanyProfile(orgId: string, input: CompanyProfileInput): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_company_profile", {
        target_org: orgId,
        profile_description: input.description,
        profile_offerings: input.offerings,
        profile_exclusions: input.exclusions,
        profile_locations: input.locations,
    });

    if (error) throw error;
    return data;
}

/** Claims one of today's improvements of a field; raises improvement_limit_reached or insufficient_role. */
export async function claimProfileImprovement(params: { field: ImprovableField; model: string; orgId: string | null }) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("claim_profile_improvement", {
        target_field: params.field,
        used_model: params.model,
        ...(params.orgId && { target_org: params.orgId }),
    });

    if (error) throw error;
    const [claim] = z.array(z.object({ event_id: z.number().int(), remaining: z.number().int() })).length(1).parse(data);
    return { eventId: claim.event_id, remaining: claim.remaining };
}

/** Records how a claimed improvement ended; a failed one does not count toward the limit. */
export async function finishProfileImprovement(params: {
    eventId: number;
    succeeded: boolean;
    model?: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number;
    error?: string;
}) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("finish_profile_improvement", {
        target_event: params.eventId,
        succeeded: params.succeeded,
        response_model: params.model,
        used_input_tokens: params.inputTokens ?? undefined,
        used_output_tokens: params.outputTokens ?? undefined,
        used_latency_ms: params.latencyMs,
        error_message: params.error,
    });

    if (error) throw error;
}
