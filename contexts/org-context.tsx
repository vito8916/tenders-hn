// lib/contexts/org-context.tsx
"use client";

import React, { createContext, useContext } from "react";
import { Organization, OrganizationListItem } from "@/features/organizations/schemas";

interface OrgContextValue {
    currentOrg: Organization;
    organizations: OrganizationListItem[];
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({
    org,
    organizations,
    children,
}: {
    org: Organization;
    organizations: OrganizationListItem[];
    children: React.ReactNode;
}) {
    return (
        <OrgContext.Provider value={{ currentOrg: org, organizations }}>
            {children}
        </OrgContext.Provider>
    );
}

export function useOrg() {
    const context = useContext(OrgContext);

    if (!context) {
        throw new Error("useOrg must be used inside <OrgProvider>");
    }

    return context.currentOrg;
}

export function useOrgContext() {
    const context = useContext(OrgContext);

    if (!context) {
        throw new Error("useOrgContext must be used inside <OrgProvider>");
    }

    return context;
}
