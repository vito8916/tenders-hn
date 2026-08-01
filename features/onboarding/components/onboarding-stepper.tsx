"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
    Stepper,
    StepperContent,
    StepperIndicator,
    StepperItem,
    StepperList,
    StepperNext,
    StepperPrev,
} from "@/components/ui/stepper";
import { ProfileStep } from "./steps/profile-step";
import { ThemeStep } from "./steps/theme-step";
import { OrganizationStep } from "./steps/organization-step";
import { InvitesStep } from "./steps/invites-step";
import { JoinStep, type JoinableInvitation } from "./steps/join-step";
import { completeOnboardingAction, completeOnboardingWithoutOrgAction } from "../actions";
import { checkSlugAvailabilityAction } from "@/features/organizations/actions";
import { ChevronRight, Loader2 } from "lucide-react";

const CREATE_STEPS = [
    { value: "profile" },
    { value: "theme" },
    { value: "organization" },
    { value: "invites" },
];

const JOIN_STEPS = [
    { value: "profile" },
    { value: "theme" },
    { value: "join" },
];

const onboardingFormSchema = z.object({
    fullName: z.string().min(1, "Name is required").max(100).trim(),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format")
        .optional()
        .or(z.literal("")),
    email: z.string().email(),
    orgName: z.string().min(2, "Organization name is too short").max(100).trim(),
    orgSlug: z
        .string()
        .min(2, "Slug is too short")
        .max(50, "Slug is too long")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and dashes"),
    invites: z.array(
        z.object({
            id: z.string(),
            email: z.string(),
            role: z.enum(["owner", "admin", "member", "viewer"]),
        })
    ),
});

type OnboardingFormData = z.infer<typeof onboardingFormSchema>;

interface OnboardingStepperProps {
    defaultProfile: {
        fullName: string;
        phone: string;
        email: string;
        avatarUrl?: string | null;
    };
    pendingInvitations: JoinableInvitation[];
    hasExistingMembership: boolean;
}

export function OnboardingStepper({
    defaultProfile,
    pendingInvitations,
    hasExistingMembership,
}: OnboardingStepperProps) {
    // Invited users join their team instead of creating an organization
    const [mode, setMode] = useState<"join" | "create">(
        pendingInvitations.length > 0 || hasExistingMembership ? "join" : "create"
    );
    const [joinedOrgSlug, setJoinedOrgSlug] = useState<string | null>(null);
    const [step, setStep] = useState("profile");
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [orgLogoFile, setOrgLogoFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingSlug, setIsCheckingSlug] = useState(false);

    const STEPS = mode === "join" ? JOIN_STEPS : CREATE_STEPS;

    const form = useForm<OnboardingFormData>({
        resolver: zodResolver(onboardingFormSchema),
        defaultValues: {
            fullName: defaultProfile.fullName,
            phone: defaultProfile.phone,
            email: defaultProfile.email,
            orgName: "",
            orgSlug: "",
            invites: [
                { id: crypto.randomUUID(), email: "", role: "member" },
                { id: crypto.randomUUID(), email: "", role: "member" },
                { id: crypto.randomUUID(), email: "", role: "member" },
            ],
        },
    });

    const stepIndex = STEPS.findIndex((s) => s.value === step);

    const handleValidate = async (_targetValue: string, direction: "next" | "prev"): Promise<boolean> => {
        if (direction === "prev") return true;

        switch (step) {
            case "profile":
                return form.trigger(["fullName", "phone", "email"]);
            case "organization": {
                const isValid = await form.trigger(["orgName", "orgSlug"]);
                if (!isValid) return false;

                setIsCheckingSlug(true);
                try {
                    const orgSlug = form.getValues("orgSlug");
                    const { isAvailable } = await checkSlugAvailabilityAction(orgSlug);
                    if (!isAvailable) {
                        form.setError("orgSlug", {
                            type: "manual",
                            message: "This slug is already taken. Please choose another.",
                        });
                        toast.error("This organization slug is already taken");
                        return false;
                    }
                    return true;
                } finally {
                    setIsCheckingSlug(false);
                }
            }
            default:
                return true;
        }
    };

    const handleFinish = async () => {
        const values = form.getValues();
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.set("fullName", values.fullName.trim());
            formData.set("phone", values.phone?.trim() || "");
            if (avatarFile) formData.set("avatarFile", avatarFile);

            if (mode === "join") {
                if (joinedOrgSlug) formData.set("joinedOrgSlug", joinedOrgSlug);
                const result = await completeOnboardingWithoutOrgAction(formData);
                if (result && !result.success) {
                    toast.error(result.error || "Failed to complete onboarding");
                }
                return;
            }

            formData.set("orgName", values.orgName.trim());
            formData.set("orgSlug", values.orgSlug.trim());
            formData.set(
                "invites",
                JSON.stringify(
                    values.invites
                        .filter((inv) => inv.email.trim() !== "")
                        .map((inv) => ({ email: inv.email.trim(), role: inv.role }))
                )
            );
            if (orgLogoFile) formData.set("orgLogoFile", orgLogoFile);

            const result = await completeOnboardingAction(formData);

            if (result && !result.success) {
                toast.error(result.error || "Failed to complete onboarding");
            }
        } catch (error) {
            if (error && typeof error === "object" && "digest" in error) {
                throw error;
            }
            toast.error("Something went wrong. Please try again.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Joining requires at least one accepted invitation or a prior membership
    const canFinishJoin = mode !== "join" || joinedOrgSlug !== null || hasExistingMembership;

    return (
        <Form {...form}>
            <Stepper value={step} onValueChange={setStep} onValidate={handleValidate}>
                <div className="w-full space-y-8">
                    <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                            Step {stepIndex + 1} of {STEPS.length}
                        </p>
                        <StepperList className="flex gap-1">
                            {STEPS.map((s) => (
                                <StepperItem key={s.value} value={s.value} className="flex-1">
                                    <StepperIndicator
                                        asChild
                                        className="h-1 w-full rounded-full data-[state=active]:bg-primary data-[state=completed]:bg-primary data-[state=inactive]:bg-muted"
                                    >
                                        <div className="h-1 w-full rounded-full bg-muted data-[state=active]:bg-primary data-[state=completed]:bg-primary" />
                                    </StepperIndicator>
                                </StepperItem>
                            ))}
                        </StepperList>
                    </div>

                    <StepperContent value="profile">
                        <ProfileStep
                            defaultAvatarUrl={defaultProfile.avatarUrl}
                            avatarFile={avatarFile}
                            onAvatarFileChange={setAvatarFile}
                        />
                    </StepperContent>

                    <StepperContent value="theme">
                        <ThemeStep />
                    </StepperContent>

                    {mode === "join" ? (
                        <StepperContent value="join">
                            <JoinStep
                                invitations={pendingInvitations}
                                hasExistingMembership={hasExistingMembership}
                                onJoined={setJoinedOrgSlug}
                                onCreateInstead={() => {
                                    setMode("create");
                                    setStep("organization");
                                }}
                            />
                        </StepperContent>
                    ) : (
                        <>
                            <StepperContent value="organization">
                                <OrganizationStep
                                    logoFile={orgLogoFile}
                                    onLogoFileChange={setOrgLogoFile}
                                />
                            </StepperContent>

                            <StepperContent value="invites">
                                <InvitesStep />
                            </StepperContent>
                        </>
                    )}

                    <div className="flex justify-between items-center pt-4">
                        {stepIndex > 0 ? (
                            <StepperPrev asChild>
                                <Button variant="outline">Previous</Button>
                            </StepperPrev>
                        ) : (
                            <div />
                        )}
                        {stepIndex === STEPS.length - 1 ? (
                            <Button onClick={handleFinish} disabled={isSubmitting || !canFinishJoin}>
                                {isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Finish
                            </Button>
                        ) : (
                            <StepperNext asChild disabled={isCheckingSlug}>
                                <Button type="button" disabled={isCheckingSlug}>
                                    {isCheckingSlug && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Next step
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </StepperNext>
                        )}
                    </div>
                </div>
            </Stepper>
        </Form>
    );
}
