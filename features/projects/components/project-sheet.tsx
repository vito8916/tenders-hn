"use client";

import { useState } from "react";
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
import { useOrg } from "@/contexts/org-context";
import AddProjectForm from "./add-project-form";

export function ProjectSheet() {
	const org = useOrg();
	const [isOpen, setIsOpen] = useState(false);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
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
						orgSlug={org.slug}
						orgId={org.id}
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
