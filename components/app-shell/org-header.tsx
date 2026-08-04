"use client";

import { usePathname } from "next/navigation";

import ProjectSwitcher from "@/components/app-shell/project-switcher";

export function OrgHeader() {
	const pathname = usePathname();
	const isSettings = pathname.includes("/settings");

	if (isSettings) {
		return <span className="text-sm font-medium">Settings</span>;
	}

	return <ProjectSwitcher />;
}
