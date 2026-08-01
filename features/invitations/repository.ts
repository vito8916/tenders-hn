import 'server-only';
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import type { Database, Tables } from "@/types/database.types";
import {
    invitationSchema,
    invitationPreviewSchema,
    acceptInvitationResultSchema,
    myPendingInvitationSchema,
    type Invitation,
    type InvitationPreview,
    type AcceptInvitationResult,
    type InviteItem,
    type MyPendingInvitation,
} from "./schemas";

type InvitationRow = Tables<"organization_invitations">;

const INVITATION_EXPIRY_DAYS = 7;

// ========== MAPPERS ==========

/**
 * Maps a database row to an Invitation entity
 * Converts snake_case to camelCase and validates with Zod
 */
export function mapInvitationRow(row: InvitationRow): Invitation {
    return invitationSchema.parse({
        id: row.id,
        orgId: row.org_id,
        email: row.email,
        role: row.role,
        token: row.token,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
    });
}

function buildInvitationInsert(orgId: string, invite: InviteItem) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    return {
        org_id: orgId,
        email: invite.email,
        role: invite.role,
        token,
        expires_at: expiresAt.toISOString(),
    };
}

// ========== QUERIES ==========

/**
 * Lists invitations for an organization that have not been accepted yet
 * @throws Supabase error if query fails or RLS denies access
 */
export async function listPendingInvitations(params: { orgId: string }): Promise<Invitation[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("org_id", params.orgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data.map(mapInvitationRow);
}

/**
 * Gets a single invitation by id (RLS: members of the org can read)
 * @throws Supabase error if query fails
 */
export async function getInvitationById(params: { invitationId: string }): Promise<Invitation | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_invitations")
        .select("*")
        .eq("id", params.invitationId)
        .maybeSingle();

    if (error) throw error;
    return data ? mapInvitationRow(data) : null;
}

/**
 * Gets an invitation preview by token via SECURITY DEFINER RPC
 * Works for authenticated users who are not members yet
 * @returns Preview with org name/slug or null if the token is unknown
 * @throws Supabase error if the RPC fails
 */
export async function getInvitationByToken(params: { token: string }): Promise<InvitationPreview | null> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_invitation_by_token", {
        invite_token: params.token,
    });

    if (error) throw error;

    const row = data?.[0];
    if (!row) return null;

    return invitationPreviewSchema.parse({
        id: row.id,
        orgId: row.org_id,
        orgName: row.org_name,
        orgSlug: row.org_slug,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        createdAt: row.created_at,
    });
}

// ========== MUTATIONS ==========

/**
 * Creates a single organization invitation
 * @returns The created invitation (including its token, for email sending)
 * @throws Supabase error if insert fails or RLS denies access
 */
export async function createInvitation(params: {
    orgId: string;
    invite: InviteItem;
}): Promise<Invitation> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_invitations")
        .insert(buildInvitationInsert(params.orgId, params.invite))
        .select("*")
        .single();

    if (error) throw error;
    return mapInvitationRow(data);
}

/**
 * Creates multiple organization invitations
 * @returns The created invitations (including tokens, for email sending)
 * @throws Supabase error if insert fails or RLS denies access
 */
export async function createInvitations(params: {
    orgId: string;
    invites: InviteItem[];
}): Promise<Invitation[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("organization_invitations")
        .insert(params.invites.map((invite) => buildInvitationInsert(params.orgId, invite)))
        .select("*");

    if (error) throw error;
    return data.map(mapInvitationRow);
}

/**
 * Deletes an invitation (RLS: owner/admin of the org)
 * @throws Supabase error if delete fails or RLS denies access
 */
export async function deleteInvitation(params: { invitationId: string }): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
        .from("organization_invitations")
        .delete()
        .eq("id", params.invitationId);

    if (error) throw error;
}

/**
 * Accepts an invitation via SECURITY DEFINER RPC
 * The database validates token, expiry, email match, and creates the membership
 * @throws Supabase error with the validation reason (e.g. invitation_expired)
 */
export async function acceptInvitation(params: { token: string }): Promise<AcceptInvitationResult> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("accept_invitation", {
        invite_token: params.token,
    });

    if (error) throw error;

    const row = data?.[0];
    if (!row) {
        throw new Error("accept_invitation returned no result");
    }

    return acceptInvitationResultSchema.parse({
        orgId: row.org_id,
        orgSlug: row.org_slug,
        orgName: row.org_name,
    });
}

/**
 * Counts pending (not accepted) invitations of an organization
 * @throws Supabase error if query fails or RLS denies access
 */
export async function countPendingInvitations(params: { orgId: string }): Promise<number> {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from("organization_invitations")
        .select("*", { count: "exact", head: true })
        .eq("org_id", params.orgId)
        .is("accepted_at", null);

    if (error) throw error;
    return count ?? 0;
}

/**
 * Lists pending, non-expired invitations addressed to the current user's
 * email via SECURITY DEFINER RPC (a new user has no memberships, so plain
 * RLS would hide these rows)
 * @throws Supabase error if the RPC fails
 */
export async function listMyPendingInvitations(): Promise<MyPendingInvitation[]> {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("list_my_pending_invitations");

    if (error) throw error;

    type Row = Database["public"]["Functions"]["list_my_pending_invitations"]["Returns"][number];

    return ((data ?? []) as Row[]).map((row) =>
        myPendingInvitationSchema.parse({
            id: row.id,
            orgId: row.org_id,
            orgName: row.org_name,
            orgSlug: row.org_slug,
            email: row.email,
            role: row.role,
            token: row.token,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
        })
    );
}
