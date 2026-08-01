"use client";

import { Button } from "@/components/ui/button";
import { Table } from "@tanstack/react-table";
import React from "react";
import { Trash } from "lucide-react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";

export default function DataTableDeleteItems<TData>({
	table,
	onDelete,
}: {
	table: Table<TData>;
	onDelete?: (ids: string[]) => Promise<void>;
}) {
	
	
	const handleDeleteRows = async () => {
		const selectedRows = table.getSelectedRowModel().rows;
		const selectedIds = selectedRows.map((row) => {
			const record = row.original as Record<string, unknown>;
			return record.id as string;
		});
		if (onDelete) {
			try {
				const loadingToast = toast.loading(
					`Deleting ${selectedIds.length} item${
						selectedIds.length > 1 ? "s" : ""
					}...`
				);
				await onDelete(selectedIds);
				toast.dismiss(loadingToast);
				toast.success(
					`${selectedIds.length} item${
						selectedIds.length > 1 ? "s" : ""
					} deleted`
				);
				table.resetRowSelection();
			} catch (error) {
				console.error("Error deleting items:", error);
				toast.error("Failed to delete items");
			}
		}
		table.resetRowSelection();
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
                    size="sm"
					className="border border-border"
					variant="outline"
				>
					<Trash
						className="-ms-1 me-2 opacity-60"
						size={16}
						strokeWidth={2}
						aria-hidden="true"
					/>
					Delete
					<span className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
						{table.getSelectedRowModel().rows.length}
					</span>
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<div className="flex flex-col gap-2 max-sm:items-center sm:flex-row sm:gap-4">
					<div
						className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border"
						aria-hidden="true"
					>
						<CircleAlert
							className="opacity-80"
							size={16}
							strokeWidth={2}
						/>
					</div>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Are you absolutely sure?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently
							delete {table.getSelectedRowModel().rows.length}{" "}
							selected{" "}
							{table.getSelectedRowModel().rows.length === 1
								? "row"
								: "rows"}
							.
						</AlertDialogDescription>
					</AlertDialogHeader>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={handleDeleteRows}>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
