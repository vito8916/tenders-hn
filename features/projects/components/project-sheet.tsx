"use client";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import AddProjectForm from "./add-project-form";
import { useState } from "react";

export function ProjectSheet({ orgId, orgSlug }: { orgId: string, orgSlug: string }) {
	const [isOpen, setIsOpen] = useState(false);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setIsOpen(false);
		}
	};
	return (
		<Sheet open={isOpen} onOpenChange={handleOpenChange}>
			<SheetTrigger asChild>
				<Button variant="outline">New Project</Button>
			</SheetTrigger>
			<SheetContent className="w-full md:max-w-xl overflow-y-auto">
				<SheetHeader>
					<SheetTitle>New Project</SheetTitle>
					<SheetDescription>
						Create a new project for your organization.
					</SheetDescription>
				</SheetHeader>
				<div className="w-full px-4">
					<AddProjectForm
						handleOpenChange={handleOpenChange}
						orgSlug={orgSlug}
						orgId={orgId}
					/>
				</div>
				<SheetFooter>
					<SheetClose asChild>
						<Button variant="outline">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
