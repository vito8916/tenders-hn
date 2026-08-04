"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, Pencil, Trash } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ProjectListItem } from "../schemas";
import { DataTableColumnHeader } from "@/components/shared/ui/data-table/data-table-column-header";

const statusColors: Record<ProjectListItem["status"], string> = {
	active: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
	inactive: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
	completed: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
	canceled: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
	archived: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
};

const visibilityColors: Record<ProjectListItem["visibility"], string> = {
	private: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
	public: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
};

export function getProjectColumns(orgSlug: string): ColumnDef<ProjectListItem>[] {
	return [
		{
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) =>
						table.toggleAllPageRowsSelected(!!value)
					}
					aria-label="Select all"
					className="translate-y-[2px]"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
					className="translate-y-[2px]"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "name",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Name" />
			),
			cell: ({ row }) => {
				const name = row.getValue("name") as string;
				return <div className="font-medium">{name}</div>;
			},
		},
		{
			accessorKey: "description",
			header: "Description",
			cell: ({ row }) => {
				const description = row.getValue("description") as string | null;
				return (
					<div className="max-w-[300px] truncate text-muted-foreground">
						{description || "—"}
					</div>
				);
			},
		},
		{
			accessorKey: "status",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Status" />
			),
			cell: ({ row }) => {
				const status = row.getValue("status") as ProjectListItem["status"];
				return (
					<Badge variant="outline" className={statusColors[status]}>
						{status}
					</Badge>
				);
			},
			filterFn: (row, id, value) => {
				return value.includes(row.getValue(id));
			},
		},
		{
			accessorKey: "visibility",
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title="Visibility" />
			),
			cell: ({ row }) => {
				const visibility = row.getValue(
					"visibility"
				) as ProjectListItem["visibility"];
				return (
					<Badge
						variant="outline"
						className={visibilityColors[visibility]}
					>
						{visibility}
					</Badge>
				);
			},
			filterFn: (row, id, value) => {
				return value.includes(row.getValue(id));
			},
		},
		{
			id: "actions",
			enableHiding: false,
			cell: ({ row }) => {
				const project = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem
								onClick={() =>
									navigator.clipboard.writeText(project.id)
								}
							>
								Copy project ID
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link href={`/organizations/${orgSlug}/projects/${project.slug}`}>
									<Eye className="mr-2 h-4 w-4" />
									View details
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Pencil className="mr-2 h-4 w-4" />
								Edit project
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem className="text-destructive">
								<Trash className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];
}
