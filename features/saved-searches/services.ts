import "server-only";
import { z } from "zod";
import { getUserOrgRole } from "@/features/memberships/repository";
import { UserFacingError } from "@/lib/errors";
import { canManageSearches } from "./rbac";
import {
    createSavedSearch,
    deleteSavedSearch,
    followList,
    getSavedSearch,
    getSearchLimits,
    listFilterOptions,
    listFollowedListIds,
    listSavedSearches,
    setSavedSearchActive,
    unfollowList,
    updateSavedSearch,
} from "./repository";
import type { SavedSearchInput } from "./schemas";

export async function listSavedSearchesService(orgId: string) {
    return listSavedSearches(orgId);
}

/** Null when the search does not exist, is not visible to the user, or the id is malformed (a hand-edited URL). */
export async function getSavedSearchService(params: { orgId: string; searchId: string }) {
    if (!z.uuid().safeParse(params.searchId).success) {
        return null;
    }
    return getSavedSearch(params.orgId, params.searchId);
}

export async function getSearchLimitsService(orgId: string) {
    return getSearchLimits(orgId);
}

export async function listFollowedListIdsService(params: { orgId: string; userId: string }) {
    return listFollowedListIds(params.orgId, params.userId);
}

export async function listFilterOptionsService() {
    return listFilterOptions();
}

async function assertCanManageSearches(userId: string, orgId: string) {
    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canManageSearches(role)) {
        throw new UserFacingError("Solo los propietarios y administradores pueden modificar las listas.");
    }
}

/** Creates the search when searchId is null; the database enforces the plan. */
export async function saveSavedSearchService(params: { userId: string; orgId: string; searchId: string | null; input: SavedSearchInput }) {
    await assertCanManageSearches(params.userId, params.orgId);

    if (params.searchId === null) {
        const searchId = await createSavedSearch(params.orgId, params.input);
        if (params.input.follow) {
            await followList(params.orgId, searchId, params.userId);
        }
        return searchId;
    }
    await updateSavedSearch(params.orgId, params.searchId, params.input);
    return params.searchId;
}

/** Any member, viewers included, follows or unfollows a list for themselves; the database rejects «Recomendadas». */
export async function setListFollowedService(params: { userId: string; orgId: string; searchId: string; followed: boolean }) {
    if (params.followed) {
        await followList(params.orgId, params.searchId, params.userId);
    } else {
        await unfollowList(params.orgId, params.searchId, params.userId);
    }
}

export async function setSavedSearchActiveService(params: { userId: string; orgId: string; searchId: string; isActive: boolean }) {
    await assertCanManageSearches(params.userId, params.orgId);
    await setSavedSearchActive(params.orgId, params.searchId, params.isActive);
}

export async function deleteSavedSearchService(params: { userId: string; orgId: string; searchId: string }) {
    await assertCanManageSearches(params.userId, params.orgId);
    await deleteSavedSearch(params.orgId, params.searchId);
}
