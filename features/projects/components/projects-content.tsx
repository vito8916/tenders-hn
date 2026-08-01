"use client"

import { useRouter } from "next/navigation";
import { getProjectColumns } from "./columns";
import { DataTable } from "@/components/shared/ui/data-table/data-table";
import { bulkDeleteProjectsAction } from "../actions";
import type { ProjectListItem } from "../schemas";

interface ProjectsContentProps {
    projects: ProjectListItem[];
    orgId: string;
    orgSlug: string;
}

/* Faceted filters for the projects table */
const facetedFilters = [
    {
        label: "Status",
        value: "status",
        options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "Completed", value: "completed" },
            { label: "Canceled", value: "canceled" },
            { label: "Archived", value: "archived" },
        ]
    },
    {
        label: "Visibility",
        value: "visibility",
        options: [
            { label: "Public", value: "public" },
            { label: "Private", value: "private" },
        ]
    }
];

export function ProjectsContent({ projects, orgSlug }: ProjectsContentProps) {
    const router = useRouter();
    const columns = getProjectColumns(orgSlug);

    const handleDelete = async (ids: string[]) => {
        const result = await bulkDeleteProjectsAction(ids, orgSlug);
        if (!result.ok) {
            throw new Error((result.error as { message: string })?.message ?? "Failed to delete projects");
        }
        // Refresh the page to show updated data
        router.refresh();
    };

    return (
        <DataTable
            columns={columns}
            data={projects}
            onDelete={handleDelete}
            filterColumn="name"
            filterPlaceholder="Filter by name..."
            facetedFilters={facetedFilters}
        />
    );
}
