import { z } from "zod";
import { Constants } from "@/types/database.types";

/**
 * DB enums are already present in generated types as Constants.public.Enums
 * This makes schemas stay in sync with your database enums.
 */
export const ProjectVisibilitySchema = z.enum(Constants.public.Enums.project_visibility);
export const ProjectStatusSchema = z.enum(Constants.public.Enums.project_status);

/**
 * Reusable field definitions to ensure consistency across schemas
 */
const projectNameField = z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name cannot exceed 120 characters");
const projectDescriptionField = z.string().trim().max(2000, "Description cannot exceed 2000 characters").nullable();
const projectSlugField = z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug cannot exceed 50 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens");

/**
 * Full project entity schema (matches database table)
 */
export const projectSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    name: projectNameField,
    slug: projectSlugField,
    description: projectDescriptionField,
    ownerId: z.uuid(),
    visibility: ProjectVisibilitySchema,
    status: ProjectStatusSchema,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});

/**
 * Lightweight schema for project lists
 */
export const ProjectListItemSchema = z.object({
    id: z.uuid(),
    orgId: z.uuid(),
    name: projectNameField,
    slug: projectSlugField,
    description: projectDescriptionField,
    visibility: ProjectVisibilitySchema,
    status: ProjectStatusSchema,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    isFavorite: z.boolean().optional(),
});

/**
 * Input schema for creating a new project
 * Used in Server Actions and Services
 */
export const createProjectInputSchema = z.object({
    orgId: z.uuid(),
    ownerId: z.uuid(),
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name cannot exceed 120 characters"),
    slug: z
        .string()
        .trim()
        .min(2, "Slug must be at least 2 characters")
        .max(50, "Slug cannot exceed 50 characters")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
    description: z
        .string()
        .trim()
        .max(2000, "Description cannot exceed 2000 characters"),
    status: ProjectStatusSchema.optional(),
    visibility: ProjectVisibilitySchema.optional(),
});

export const createProjectFormSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name cannot exceed 120 characters"),
    description: z
        .string()
        .trim()
        .max(2000, "Description cannot exceed 2000 characters"),
    status: ProjectStatusSchema.optional(),
    visibility: ProjectVisibilitySchema.optional(),
});

/**
 * Input schema for updating an existing project
 * All fields are optional, but at least one must be provided
 */
export const updateProjectInputSchema = z
    .object({
        name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name cannot exceed 120 characters").optional(),
        slug: z
            .string()
            .trim()
            .min(2, "Slug must be at least 2 characters")
            .max(50, "Slug cannot exceed 50 characters")
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens")
            .optional(),
        description: z
            .string()
            .trim()
            .max(2000, "Description cannot exceed 2000 characters"),
        status: ProjectStatusSchema.optional(),
        visibility: ProjectVisibilitySchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided for update",
    });

// Exported types inferred from schemas
export type Project = z.infer<typeof projectSchema>;
export type ProjectVisibility = z.infer<typeof ProjectVisibilitySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
export type CreateProjectFormInput = z.infer<typeof createProjectFormSchema>;
