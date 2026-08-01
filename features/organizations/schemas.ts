import { z } from "zod";
import { InviteRoleSchema } from "@/features/invitations/schemas";

/**
 * Reusable field definitions for organizations
 */
const organizationNameField = z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name cannot exceed 100 characters");

const organizationSlugField = z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug cannot exceed 50 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens");

/**
 * Full organization entity schema (matches database table)
 */
export const organizationSchema = z.object({
    id: z.uuid(),
    name: organizationNameField,
    slug: organizationSlugField,
    ownerId: z.uuid(),
    orgLogoUrl: z.string().nullable(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

/**
 * Lightweight schema for organization lists
 */
export const organizationListItemSchema = z.object({
    id: z.uuid(),
    name: organizationNameField,
    slug: organizationSlugField,
    orgLogoUrl: z.string().nullable(),
    memberCount: z.number().int().nonnegative().optional(),
});

/**
 * Input schema for creating a new organization
 * Used in Server Actions and Services
 */
export const createOrganizationInputSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Organization name must be at least 2 characters")
        .max(100, "Organization name cannot exceed 100 characters"),
    slug: z
        .string()
        .trim()
        .min(2, "Slug must be at least 2 characters")
        .max(50, "Slug cannot exceed 50 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
    ownerId: z.uuid(),
    orgLogoUrl: z.string().url().nullable().optional(),
});

/**
 * Form schema for creating organization with invites (client-side validation)
 * Used in UI components for form validation
 */
export const createOrganizationWithInvitesFormSchema = z.object({
    orgName: z
        .string()
        .min(2, "Organization name is too short")
        .max(100, "Organization name is too long"),
    orgSlug: z
        .string()
        .min(2, "Slug is too short")
        .max(50, "Slug is too long")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
    invites: z
        .array(
            z.object({
                email: z.string().email("Enter a valid email address").or(z.literal("")),
                role: InviteRoleSchema,
            })
        )
        .max(10, "Maximum 10 invitations allowed")
        .refine(
            (invites) => {
                const nonEmptyInvites = invites.filter((inv) => inv.email.trim() !== "");
                return nonEmptyInvites.length <= 10;
            },
            {
                message: "Maximum 10 invitations allowed",
            }
        ),
});

/**
 * Input schema for updating an existing organization
 * All fields are optional, but at least one must be provided
 */
export const updateOrganizationInputSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, "Organization name must be at least 2 characters")
            .max(100, "Organization name cannot exceed 100 characters")
            .optional(),
        slug: z
            .string()
            .trim()
            .min(2, "Slug must be at least 2 characters")
            .max(50, "Slug cannot exceed 50 characters")
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens")
            .optional(),
        orgLogoUrl: z.string().url().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update",
    });

// Exported types inferred from schemas
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationListItem = z.infer<typeof organizationListItemSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInputSchema>;
export type CreateOrganizationWithInvitesFormInput = z.infer<typeof createOrganizationWithInvitesFormSchema>;
