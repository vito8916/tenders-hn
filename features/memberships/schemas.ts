import { z } from "zod";

/**
 * Organization role enum schema
 * Matches database constraint on organization_members.role
 */
export const OrgRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

/**
 * Full organization membership entity schema
 */
export const organizationMembershipSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    userId: z.uuid(),
    role: OrgRoleSchema,
    createdAt: z.coerce.date(),
});

/**
 * Lightweight schema for membership queries
 */
export const membershipRoleSchema = z.object({
    userId: z.uuid(),
    orgId: z.uuid(),
    role: OrgRoleSchema,
});

/**
 * Roles that can be assigned when changing a member's role
 * Ownership is transferred, never assigned directly
 */
export const AssignableRoleSchema = z.enum(["admin", "member", "viewer"]);

/**
 * Membership enriched with the member's profile, as shown on the members page
 */
export const orgMemberSchema = organizationMembershipSchema.extend({
    fullName: z.string().nullable(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
});

// Exported types inferred from schemas
export type OrganizationMembership = z.infer<typeof organizationMembershipSchema>;
export type OrgRole = z.infer<typeof OrgRoleSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;
export type OrgMember = z.infer<typeof orgMemberSchema>;
