import "server-only";
import { getUserOrgRole, listOrgMembers } from "@/features/memberships/repository";
import { getProfileSummariesByIds } from "@/features/profiles/repository";
import { UserFacingError } from "@/lib/errors";
import { canTrackOpportunity } from "./rbac";
import {
    deleteNote,
    deleteTracking,
    getCurrentProcessVersion,
    getNote,
    getTracking,
    insertNote,
    listNotes,
    listProcessDocuments,
    listProcessEvents,
    listTracking,
    upsertTracking,
} from "./repository";
import type { AddNoteInput, Assignee, DeleteNoteInput, OpportunityNote, SaveTrackingInput, TrackedState, Tracking } from "./schemas";

const displayName = (profile: { fullName: string | null; email: string | null }) => profile.fullName?.trim() || profile.email || null;

async function namesById(userIds: (string | null)[]) {
    const ids = [...new Set(userIds.filter((id) => id !== null))];
    const profiles = await getProfileSummariesByIds({ userIds: ids });
    return new Map(profiles.map((profile) => [profile.id, displayName(profile)]));
}

/** The status and assignee of every opportunity the organization has acted on, by process. */
export async function listTrackingService(orgId: string): Promise<Map<string, TrackedState>> {
    const rows = await listTracking(orgId);
    const names = await namesById(rows.map((row) => row.assignedTo));
    return new Map(
        rows.map((row) => [
            row.processId,
            { status: row.status, assigneeId: row.assignedTo, assigneeName: row.assignedTo ? (names.get(row.assignedTo) ?? null) : null },
        ]),
    );
}

/** What the detail panel adds to a match (spec 0.4 §12.3): the process as it is now, its changes, its documents, and the team's tracking and notes. */
export async function getOpportunityDetailService(params: { orgId: string; processId: string }) {
    const [version, events, documents, trackingRow, noteRows, members] = await Promise.all([
        getCurrentProcessVersion(params.processId),
        listProcessEvents(params.processId),
        listProcessDocuments(params.processId),
        getTracking(params.orgId, params.processId),
        listNotes(params.orgId, params.processId),
        listOrgMembers({ orgId: params.orgId }),
    ]);
    const names = await namesById([trackingRow?.updated_by ?? null, ...noteRows.map((note) => note.author_id)]);

    const tracking: Tracking | null = trackingRow
        ? {
              status: trackingRow.status,
              assignedTo: trackingRow.assigned_to,
              discardReason: trackingRow.discard_reason,
              updatedAt: trackingRow.updated_at,
              updatedByName: trackingRow.updated_by ? (names.get(trackingRow.updated_by) ?? null) : null,
          }
        : null;
    const notes: OpportunityNote[] = noteRows.map((note) => ({
        id: note.id,
        authorId: note.author_id,
        authorName: note.author_id ? (names.get(note.author_id) ?? null) : null,
        body: note.body,
        createdAt: note.created_at,
    }));
    const assignees: Assignee[] = members
        .filter((member) => member.role !== "viewer")
        .map((member) => ({ userId: member.userId, name: displayName(member) ?? "Miembro" }));

    return { version, events, documents, tracking, notes, assignees };
}

async function assertCanTrack(userId: string, orgId: string) {
    const role = await getUserOrgRole({ userId, orgId });
    if (!role || !canTrackOpportunity(role)) {
        throw new UserFacingError("Su rol no le permite dar seguimiento a oportunidades.");
    }
    return role;
}

/**
 * Sets the opportunity's status and assignee, or returns it to «Nueva». Assigning someone to a «Nueva»
 * opportunity starts its evaluation; the discard reason is kept only while it is discarded.
 */
export async function saveTrackingService(params: { userId: string; input: SaveTrackingInput }) {
    const { userId, input } = params;
    await assertCanTrack(userId, input.orgId);

    const status = input.status ?? (input.assignedTo ? "en_evaluacion" : null);
    if (status === null) {
        await deleteTracking(input.orgId, input.processId);
        return;
    }
    await upsertTracking({
        orgId: input.orgId,
        processId: input.processId,
        userId,
        status,
        assignedTo: input.assignedTo,
        discardReason: status === "descartada" ? input.discardReason || null : null,
    });
}

export async function addNoteService(params: { userId: string; input: AddNoteInput }) {
    const { userId, input } = params;
    await assertCanTrack(userId, input.orgId);
    await insertNote({ orgId: input.orgId, processId: input.processId, userId, body: input.body });
}

/** Authors delete their own notes; owners and admins any of the organization's. */
export async function deleteNoteService(params: { userId: string; input: DeleteNoteInput }) {
    const { userId, input } = params;
    const role = await assertCanTrack(userId, input.orgId);
    const note = await getNote(input.noteId);
    if (!note || note.org_id !== input.orgId) {
        throw new UserFacingError("No encontramos esta nota.");
    }
    if (note.author_id !== userId && role !== "owner" && role !== "admin") {
        throw new UserFacingError("Solo quien escribió la nota o un administrador puede borrarla.");
    }
    await deleteNote(input.noteId);
}
