import { describe, expect, it } from "vitest";
import type { OrgRole } from "@/features/memberships/schemas";
import {
    canReadProject,
    canCreateProject,
    canUpdateProject,
    canDeleteProject,
    canUpdateProjectAsOwnerOrPrivileged,
} from "./rbac";

const ALL_ROLES: OrgRole[] = ["owner", "admin", "member", "viewer"];

describe("project RBAC matrix", () => {
    it("lets every role read projects", () => {
        for (const role of ALL_ROLES) {
            expect(canReadProject(role)).toBe(true);
        }
    });

    it("lets owner, admin, and member create and update projects", () => {
        for (const check of [canCreateProject, canUpdateProject]) {
            expect(check("owner")).toBe(true);
            expect(check("admin")).toBe(true);
            expect(check("member")).toBe(true);
            expect(check("viewer")).toBe(false);
        }
    });

    it("restricts project deletion to owner and admin", () => {
        expect(canDeleteProject("owner")).toBe(true);
        expect(canDeleteProject("admin")).toBe(true);
        expect(canDeleteProject("member")).toBe(false);
        expect(canDeleteProject("viewer")).toBe(false);
    });

    it("lets members update only their own or assigned projects in the fine-grained check", () => {
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "member", isProjectOwner: true, isAssigned: false })).toBe(true);
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "member", isProjectOwner: false, isAssigned: true })).toBe(true);
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "member", isProjectOwner: false, isAssigned: false })).toBe(false);
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "admin", isProjectOwner: false, isAssigned: false })).toBe(true);
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "owner", isProjectOwner: false, isAssigned: false })).toBe(true);
        expect(canUpdateProjectAsOwnerOrPrivileged({ role: "viewer", isProjectOwner: true, isAssigned: true })).toBe(false);
    });
});
