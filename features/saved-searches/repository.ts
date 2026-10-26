import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";
import {
    FILTER_KINDS,
    savedSearchSchema,
    searchLimitsSchema,
    type FilterKind,
    type FilterOptions,
    type SavedSearch,
    type SavedSearchInput,
    type SearchLimits,
} from "./schemas";

const SAVED_SEARCH_COLUMNS =
    "id, name, inherits_profile, description, keywords, exclusions, entities, modalities, acquisition_types, alert_on_changes, is_active, is_default";

type SavedSearchRow = Pick<
    Tables<"saved_searches">,
    | "id"
    | "name"
    | "inherits_profile"
    | "description"
    | "keywords"
    | "exclusions"
    | "entities"
    | "modalities"
    | "acquisition_types"
    | "alert_on_changes"
    | "is_active"
    | "is_default"
>;

// ========== MAPPERS ==========

function mapSavedSearchRow(row: SavedSearchRow): SavedSearch {
    return savedSearchSchema.parse({
        id: row.id,
        name: row.name,
        inheritsProfile: row.inherits_profile,
        description: row.description,
        keywords: row.keywords,
        exclusions: row.exclusions,
        entities: row.entities,
        modalities: row.modalities,
        acquisitionTypes: row.acquisition_types,
        alertOnChanges: row.alert_on_changes,
        isActive: row.is_active,
        isDefault: row.is_default,
    });
}

function toRow(input: SavedSearchInput) {
    return {
        name: input.name,
        inherits_profile: input.inheritsProfile,
        description: input.description || null,
        keywords: input.keywords,
        exclusions: input.exclusions,
        entities: input.entities,
        modalities: input.modalities,
        acquisition_types: input.acquisitionTypes,
        alert_on_changes: input.alertOnChanges,
    };
}

// ========== QUERIES ==========

export async function listSavedSearches(orgId: string): Promise<SavedSearch[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("saved_searches").select(SAVED_SEARCH_COLUMNS).eq("org_id", orgId)
        .order("is_default", { ascending: false })
        .order("name");

    if (error) throw error;
    return data.map(mapSavedSearchRow);
}

export async function getSavedSearch(orgId: string, searchId: string): Promise<SavedSearch | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("saved_searches")
        .select(SAVED_SEARCH_COLUMNS)
        .eq("org_id", orgId)
        .eq("id", searchId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapSavedSearchRow(data) : null;
}

export async function getSearchLimits(orgId: string): Promise<SearchLimits> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("saved_search_limits", { target_org: orgId });

    if (error) throw error;
    // One row for members; the generated types cannot tell that max_active_searches may be null.
    const [row] = z.array(z.record(z.string(), z.unknown())).length(1).parse(data);
    return searchLimitsSchema.parse({
        hasActivePlan: row.has_active_plan,
        maxActiveSearches: row.max_active_searches,
        activeSearches: row.active_searches,
        maxDailyReports: row.max_daily_reports,
    });
}

/** The organization's lists the user follows («Recomendadas», which everyone follows, has no rows). */
export async function listFollowedListIds(orgId: string, userId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("list_followers").select("saved_search_id").eq("org_id", orgId).eq("user_id", userId);

    if (error) throw error;
    return data.map((row) => row.saved_search_id);
}

export async function listFilterOptions(): Promise<FilterOptions> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_filter_options");

    if (error) throw error;

    const options: FilterOptions = { entity: [], modality: [], acquisition_type: [] };
    for (const row of data) {
        if ((FILTER_KINDS as readonly string[]).includes(row.kind)) {
            options[row.kind as FilterKind].push({ value: row.value, openProcesses: row.open_processes });
        }
    }
    return options;
}

// ========== MUTATIONS ==========

/** Raises subscription_inactive, search_limit_reached, or saved_searches_org_name_key. */
export async function createSavedSearch(orgId: string, input: SavedSearchInput): Promise<string> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("saved_searches")
        .insert({ org_id: orgId, ...toRow(input) })
        .select("id")
        .single();

    if (error) throw error;
    return data.id;
}

export async function updateSavedSearch(orgId: string, searchId: string, input: SavedSearchInput): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("saved_searches").update(toRow(input)).eq("org_id", orgId).eq("id", searchId);

    if (error) throw error;
}

export async function setSavedSearchActive(orgId: string, searchId: string, isActive: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("saved_searches").update({ is_active: isActive }).eq("org_id", orgId).eq("id", searchId);

    if (error) throw error;
}

export async function followList(orgId: string, searchId: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("list_followers")
        .upsert({ org_id: orgId, saved_search_id: searchId, user_id: userId }, { onConflict: "saved_search_id,user_id", ignoreDuplicates: true });

    if (error) throw error;
}

export async function unfollowList(orgId: string, searchId: string, userId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("list_followers").delete().eq("org_id", orgId).eq("saved_search_id", searchId).eq("user_id", userId);

    if (error) throw error;
}

/** Deletes the search and, with it, its runs and their results. */
export async function deleteSavedSearch(orgId: string, searchId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("saved_searches").delete().eq("org_id", orgId).eq("id", searchId);

    if (error) throw error;
}
