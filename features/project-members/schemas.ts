import { z } from "zod";
import { OrgRoleSchema } from "@/features/memberships/schemas";

/**
 * Full project membership entity schema
 */
export const projectMemberSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    projectId: z.uuid(),
    userId: z.uuid(),
    createdAt: z.coerce.date(),
});

/**
 * Project membership enriched with the member's profile and org role,
 * as shown on the project's team card
 */
export const projectMemberWithProfileSchema = projectMemberSchema.extend({
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    orgRole: OrgRoleSchema,
});

/**
 * Input schema for assigning an org member to a project
 */
export const assignProjectMemberInputSchema = z.object({
    orgId: z.uuid(),
    projectId: z.uuid(),
    targetUserId: z.uuid(),
});

/**
 * Input schema for unassigning a member from a project
 */
export const unassignProjectMemberInputSchema = z.object({
    orgId: z.uuid(),
    projectId: z.uuid(),
    targetUserId: z.uuid(),
});

// Exported types inferred from schemas
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectMemberWithProfile = z.infer<typeof projectMemberWithProfileSchema>;
export type AssignProjectMemberInput = z.infer<typeof assignProjectMemberInputSchema>;
export type UnassignProjectMemberInput = z.infer<typeof unassignProjectMemberInputSchema>;
