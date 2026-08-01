import { describe, expect, it } from "vitest";
import type { OrgRole } from "@/features/memberships/schemas";
import {
    canReadOrganization,
    canUpdateOrganization,
    canDeleteOrganization,
    canManageMembers,
    canInviteMembers,
    canRemoveMembers,
    canChangeMemberRole,
    canTransferOwnership,
    canViewSettings,
    canLeaveOrganization,
} from "./rbac";

const ALL_ROLES: OrgRole[] = ["owner", "admin", "member", "viewer"];

describe("organization RBAC matrix", () => {
    it("lets every role read the organization", () => {
        for (const role of ALL_ROLES) {
            expect(canReadOrganization(role)).toBe(true);
        }
    });

    it("restricts organization updates to owner and admin", () => {
        expect(canUpdateOrganization("owner")).toBe(true);
        expect(canUpdateOrganization("admin")).toBe(true);
        expect(canUpdateOrganization("member")).toBe(false);
        expect(canUpdateOrganization("viewer")).toBe(false);
    });

    it("restricts organization deletion to the owner", () => {
        expect(canDeleteOrganization("owner")).toBe(true);
        expect(canDeleteOrganization("admin")).toBe(false);
        expect(canDeleteOrganization("member")).toBe(false);
        expect(canDeleteOrganization("viewer")).toBe(false);
    });

    it("restricts member management to owner and admin", () => {
        for (const check of [canManageMembers, canInviteMembers, canRemoveMembers]) {
            expect(check("owner")).toBe(true);
            expect(check("admin")).toBe(true);
            expect(check("member")).toBe(false);
            expect(check("viewer")).toBe(false);
        }
    });

    it("restricts role changes and ownership transfer to the owner", () => {
        for (const check of [canChangeMemberRole, canTransferOwnership]) {
            expect(check("owner")).toBe(true);
            expect(check("admin")).toBe(false);
            expect(check("member")).toBe(false);
            expect(check("viewer")).toBe(false);
        }
    });

    it("restricts settings visibility to owner and admin", () => {
        expect(canViewSettings("owner")).toBe(true);
        expect(canViewSettings("admin")).toBe(true);
        expect(canViewSettings("member")).toBe(false);
        expect(canViewSettings("viewer")).toBe(false);
    });

    it("lets everyone leave except the owner", () => {
        expect(canLeaveOrganization("owner")).toBe(false);
        expect(canLeaveOrganization("admin")).toBe(true);
        expect(canLeaveOrganization("member")).toBe(true);
        expect(canLeaveOrganization("viewer")).toBe(true);
    });
});
