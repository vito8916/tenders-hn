"use client";

import { useOrg } from "@/contexts/org-context";

export function OrgName() {
	return <>{useOrg().name}</>;
}
