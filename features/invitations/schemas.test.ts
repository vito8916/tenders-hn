import { describe, expect, it } from "vitest";
import {
    inviteItemSchema,
    createInvitationsInputSchema,
    invitationPreviewSchema,
} from "./schemas";

describe("invitation schemas", () => {
    it("accepts a valid invite item", () => {
        const result = inviteItemSchema.safeParse({
            email: "colleague@company.com",
            role: "member",
        });
        expect(result.success).toBe(true);
    });

    it("rejects invalid emails", () => {
        const result = inviteItemSchema.safeParse({ email: "not-an-email", role: "member" });
        expect(result.success).toBe(false);
    });

    it("rejects the owner role in invitations", () => {
        const result = inviteItemSchema.safeParse({ email: "a@b.com", role: "owner" });
        expect(result.success).toBe(false);
    });

    it("requires at least one invitation and caps at ten", () => {
        const base = { orgId: "1b671a64-40d5-491e-99b0-da01ff1f3341" };

        expect(createInvitationsInputSchema.safeParse({ ...base, invites: [] }).success).toBe(false);

        const eleven = Array.from({ length: 11 }, (_, i) => ({
            email: `user${i}@company.com`,
            role: "member" as const,
        }));
        expect(createInvitationsInputSchema.safeParse({ ...base, invites: eleven }).success).toBe(false);

        expect(
            createInvitationsInputSchema.safeParse({ ...base, invites: eleven.slice(0, 10) }).success
        ).toBe(true);
    });

    it("parses an invitation preview with coerced dates", () => {
        const result = invitationPreviewSchema.safeParse({
            id: "1b671a64-40d5-491e-99b0-da01ff1f3341",
            orgId: "1b671a64-40d5-491e-99b0-da01ff1f3342",
            orgName: "Acme",
            orgSlug: "acme",
            email: "a@b.com",
            role: "admin",
            expiresAt: "2030-01-01T00:00:00.000Z",
            acceptedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.expiresAt).toBeInstanceOf(Date);
        }
    });
});
