import { z } from "zod";
import { InviteRoleSchema } from "@/features/invitations/schemas";

/**
 * Reusable field definitions for organizations
 */
export const organizationNameField = z
    .string()
    .trim()
    .min(2, "El nombre de la organización debe tener al menos 2 caracteres.")
    .max(100, "El nombre de la organización no puede tener más de 100 caracteres.");

export const organizationSlugField = z
    .string()
    .trim()
    .min(2, "El identificador en la URL debe tener al menos 2 caracteres.")
    .max(50, "El identificador en la URL no puede tener más de 50 caracteres.")
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "El identificador en la URL solo puede tener letras minúsculas, números y guiones."
    );

const organizationLogoUrlField = z.string().url("La dirección del logo no es válida.");

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
    name: organizationNameField,
    slug: organizationSlugField,
    ownerId: z.uuid(),
    orgLogoUrl: organizationLogoUrlField.nullable().optional(),
});

/**
 * Form schema for creating organization with invites (client-side validation)
 * Used in UI components for form validation
 */
export const createOrganizationWithInvitesFormSchema = z.object({
    orgName: organizationNameField,
    orgSlug: organizationSlugField,
    invites: z
        .array(
            z.object({
                email: z.string().email("Ingrese un correo electrónico válido.").or(z.literal("")),
                role: InviteRoleSchema,
            })
        )
        .max(10, "Puede enviar hasta 10 invitaciones.")
        .refine(
            (invites) => {
                const nonEmptyInvites = invites.filter((inv) => inv.email.trim() !== "");
                return nonEmptyInvites.length <= 10;
            },
            {
                message: "Puede enviar hasta 10 invitaciones.",
            }
        ),
});

/**
 * Input schema for updating an existing organization
 * All fields are optional, but at least one must be provided
 */
export const updateOrganizationInputSchema = z
    .object({
        name: organizationNameField.optional(),
        slug: organizationSlugField.optional(),
        orgLogoUrl: organizationLogoUrlField.nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Indique al menos un dato para actualizar.",
    });

// Exported types inferred from schemas
export type Organization = z.infer<typeof organizationSchema>;
export type OrganizationListItem = z.infer<typeof organizationListItemSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInputSchema>;
export type CreateOrganizationWithInvitesFormInput = z.infer<typeof createOrganizationWithInvitesFormSchema>;
