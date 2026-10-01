import "server-only";
import { getUserOrgRole } from "@/features/memberships/repository";
import { getProfileById } from "@/features/profiles/repository";
import { UserFacingError } from "@/lib/errors";
import { canDecideOpportunity } from "./rbac";
import { deleteFeedback, getCurrentProcessVersion, getFeedback, listProcessDocuments, listProcessEvents, upsertFeedback } from "./repository";
import type { Feedback, SaveFeedbackInput } from "./schemas";

/** What the detail panel adds to a match (spec §12.3): the process as it is now, its changes, its documents, and the organization's decision. */
export async function getOpportunityDetailService(params: { orgId: string; processId: string }) {
    const [version, events, documents, feedbackRow] = await Promise.all([
        getCurrentProcessVersion(params.processId),
        listProcessEvents(params.processId),
        listProcessDocuments(params.processId),
        getFeedback(params.orgId, params.processId),
    ]);
    const decidedBy = feedbackRow?.decided_by ? await getProfileById({ userId: feedbackRow.decided_by }) : null;
    const feedback: Feedback | null = feedbackRow
        ? {
              decision: feedbackRow.decision as Feedback["decision"],
              reason: feedbackRow.reason,
              decidedAt: feedbackRow.decided_at,
              decidedByName: decidedBy?.fullName ?? null,
          }
        : null;

    return { version, events, documents, feedback };
}

/** Records, changes, or clears the organization's decision about an opportunity. */
export async function saveFeedbackService(params: { userId: string; input: SaveFeedbackInput }) {
    const { userId, input } = params;
    const role = await getUserOrgRole({ userId, orgId: input.orgId });
    if (!role || !canDecideOpportunity(role)) {
        throw new UserFacingError("Su rol no le permite marcar oportunidades.");
    }

    if (input.decision === null) {
        await deleteFeedback(input.orgId, input.processId);
        return;
    }
    await upsertFeedback({ orgId: input.orgId, processId: input.processId, userId, decision: input.decision, reason: input.reason || null });
}
