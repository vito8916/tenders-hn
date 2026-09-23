"use client";

import { usePathname } from "next/navigation";

import { useOrg } from "@/contexts/org-context";

export function OrgHeader() {
	const pathname = usePathname();
	const currentOrg = useOrg();
	const isSettings = pathname.includes("/settings");

	return (
		<span className="truncate text-sm font-medium">
			{isSettings ? "Settings" : currentOrg.name}
		</span>
	);
}
