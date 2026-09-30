"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { OrganizationStep } from "./steps/organization-step";
import { CompanyStep } from "./steps/company-step";
import { InvitesStep } from "./steps/invites-step";
import { JoinStep, type JoinableInvitation } from "./steps/join-step";
import { PlanStep } from "./steps/plan-step";
import { completeOnboardingWithoutOrgAction, createOnboardingOrganizationAction, finishOnboardingAction } from "../actions";
import { checkSlugAvailabilityAction } from "@/features/organizations/actions";
import { getPlanActiveAction, prepareCheckoutAction } from "@/features/billing/actions";
import { usePaddle } from "@/features/billing/components/use-paddle";
import type { PlanWithPrice } from "@/features/billing/schemas";
import { InviteRoleSchema } from "@/features/invitations/schemas";
import {
    companyProfileInputSchema,
    EMPTY_COMPANY_PROFILE,
    type ImprovementsRemaining,
} from "@/features/company-profile/schemas";
import { ChevronRight, Loader2 } from "lucide-react";

const CREATE_STEPS = [
    { value: "profile" },
    { value: "organization" },
    { value: "company" },
    { value: "plan" },
    { value: "invites" },
];

const PLAN_POLL_MS = 3_000;

const JOIN_STEPS = [
    { value: "profile" },
    { value: "join" },
];

const onboardingFormSchema = z.object({
    fullName: z
        .string()
        .min(1, "Ingrese su nombre")
        .max(100, "El nombre no puede tener más de 100 caracteres")
        .trim(),
    phone: z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/, "Ingrese un número de teléfono válido, por ejemplo +50499998888")
        .optional()
        .or(z.literal("")),
    email: z.string().email("Ingrese un correo electrónico válido"),
    orgName: z
        .string()
        .min(2, "El nombre de la organización debe tener al menos 2 caracteres")
        .max(100, "El nombre de la organización no puede tener más de 100 caracteres")
        .trim(),
    orgSlug: z
        .string()
        .min(2, "El identificador en la URL debe tener al menos 2 caracteres")
        .max(50, "El identificador en la URL no puede tener más de 50 caracteres")
        .regex(/^[a-z0-9-]+$/, "Use solo letras minúsculas, números y guiones"),
    invites: z.array(
        z.object({
            id: z.string(),
            email: z.string(),
            role: InviteRoleSchema,
        })
    ),
    ...companyProfileInputSchema.shape,
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
    improvementsRemaining: ImprovementsRemaining;
    plans: PlanWithPrice[];
    preselectedPlanId: string | null;
}

export function OnboardingStepper({
    defaultProfile,
    pendingInvitations,
    hasExistingMembership,
    improvementsRemaining,
    plans,
    preselectedPlanId,
}: OnboardingStepperProps) {
    const router = useRouter();
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
    // Created at the plan step, since Paddle's checkout carries its id; from then on the earlier steps are saved.
    const [organization, setOrganization] = useState<{ id: string; slug: string } | null>(null);
    const [checkoutCompleted, setCheckoutCompleted] = useState(false);
    const [planActive, setPlanActive] = useState(false);

    const paddle = usePaddle(() => {
        setCheckoutCompleted(true);
        setStep("invites");
    });

    // Paddle's webhook activates the plan a few seconds after checkout; invitations need it.
    useEffect(() => {
        if (!checkoutCompleted || !organization || planActive) return;
        const interval = setInterval(async () => {
            const result = await getPlanActiveAction({ orgId: organization.id });
            if (result.success && result.data) setPlanActive(true);
        }, PLAN_POLL_MS);
        return () => clearInterval(interval);
    }, [checkoutCompleted, organization, planActive]);

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
            ...EMPTY_COMPANY_PROFILE,
        },
    });

    const stepIndex = STEPS.findIndex((s) => s.value === step);

    const handleValidate = async (_targetValue: string, direction: "next" | "prev"): Promise<boolean> => {
        if (direction === "prev") return organization === null;

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
                            message: "Este identificador en la URL ya está en uso. Elija otro.",
                        });
                        toast.error("El identificador en la URL ya está en uso");
                        return false;
                    }
                    return true;
                } finally {
                    setIsCheckingSlug(false);
                }
            }
            case "company":
                return form.trigger(["description", "offerings", "exclusions", "locations"]);
            case "plan":
                return checkoutCompleted;
            default:
                return true;
        }
    };

    const pendingInvites = form
        .watch("invites")
        .filter((invite) => invite.email.trim() !== "")
        .map((invite) => ({ email: invite.email.trim(), role: invite.role }));

    /** Creates the organization once; choosing another plan after closing the checkout reuses it. */
    const ensureOrganization = async () => {
        if (organization) return organization;

        const values = form.getValues();
        const formData = new FormData();
        formData.set("fullName", values.fullName.trim());
        formData.set("phone", values.phone?.trim() || "");
        if (avatarFile) formData.set("avatarFile", avatarFile);
        formData.set("orgName", values.orgName.trim());
        formData.set("orgSlug", values.orgSlug.trim());
        if (orgLogoFile) formData.set("orgLogoFile", orgLogoFile);
        formData.set(
            "companyProfile",
            JSON.stringify({
                description: values.description,
                offerings: values.offerings,
                exclusions: values.exclusions,
                locations: values.locations,
            })
        );

        const result = await createOnboardingOrganizationAction(formData);
        if (!result.success) {
            if (result.slugTaken) {
                setStep("organization");
                form.setError("orgSlug", {
                    type: "manual",
                    message: "Este identificador en la URL ya está en uso. Elija otro.",
                });
                toast.error("El identificador en la URL ya está en uso");
            } else {
                toast.error(result.error);
            }
            return null;
        }

        const created = { id: result.orgId, slug: result.orgSlug };
        setOrganization(created);
        return created;
    };

    const withSubmitting = async (work: () => Promise<void>) => {
        setIsSubmitting(true);
        try {
            await work();
        } catch (error) {
            if (error && typeof error === "object" && "digest" in error) {
                throw error;
            }
            toast.error("Algo salió mal. Intente de nuevo.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const choosePlan = (plan: PlanWithPrice) =>
        withSubmitting(async () => {
            const org = await ensureOrganization();
            if (!org || !paddle) return;

            const result = await prepareCheckoutAction({ orgId: org.id, orgSlug: org.slug, priceId: plan.priceId });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            const { priceId, customData, customer } = result.data;
            paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customData, ...(customer && { customer }) });
        });

    // Without a plan the organization is read-only; Facturación offers the same plans.
    const choosePlanLater = () =>
        withSubmitting(async () => {
            const org = await ensureOrganization();
            if (org) router.push(`/organizations/${org.slug}/settings/billing`);
        });

    const handleFinish = () =>
        withSubmitting(async () => {
            const values = form.getValues();

            if (mode === "join") {
                const formData = new FormData();
                formData.set("fullName", values.fullName.trim());
                formData.set("phone", values.phone?.trim() || "");
                if (avatarFile) formData.set("avatarFile", avatarFile);
                if (joinedOrgSlug) formData.set("joinedOrgSlug", joinedOrgSlug);
                const result = await completeOnboardingWithoutOrgAction(formData);
                if (result && !result.success) {
                    toast.error(result.error || "No se pudo completar la configuración inicial");
                }
                return;
            }

            if (!organization) return;
            const result = await finishOnboardingAction({
                orgId: organization.id,
                orgSlug: organization.slug,
                invites: pendingInvites,
            });
            if (result && !result.success) {
                toast.error(result.error);
            }
        });

    // Joining requires at least one accepted invitation or a prior membership
    const canFinishJoin = mode !== "join" || joinedOrgSlug !== null || hasExistingMembership;
    const canFinishCreate = mode !== "create" || pendingInvites.length === 0 || planActive;

    return (
        <Form {...form}>
            <Stepper value={step} onValueChange={setStep} onValidate={handleValidate}>
                <div className="w-full space-y-8">
                    <div className="space-y-2">
                        <p className="text-muted-foreground text-sm">
                            Paso {stepIndex + 1} de {STEPS.length}
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

                            <StepperContent value="company">
                                <CompanyStep improvementsRemaining={improvementsRemaining} />
                            </StepperContent>

                            <StepperContent value="plan">
                                <PlanStep
                                    plans={plans}
                                    preselectedPlanId={preselectedPlanId}
                                    disabled={isSubmitting || !paddle}
                                    onChoose={choosePlan}
                                />
                            </StepperContent>

                            <StepperContent value="invites">
                                <InvitesStep planActive={planActive} />
                            </StepperContent>
                        </>
                    )}

                    <div className="flex justify-between items-center pt-4">
                        {stepIndex > 0 && !organization ? (
                            <StepperPrev asChild>
                                <Button variant="outline">Anterior</Button>
                            </StepperPrev>
                        ) : (
                            <div />
                        )}
                        {step === "plan" ? (
                            <Button variant="ghost" onClick={choosePlanLater} disabled={isSubmitting}>
                                Elegir el plan más tarde
                            </Button>
                        ) : stepIndex === STEPS.length - 1 ? (
                            <Button onClick={handleFinish} disabled={isSubmitting || !canFinishJoin || !canFinishCreate}>
                                {isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Finalizar
                            </Button>
                        ) : (
                            <StepperNext asChild disabled={isCheckingSlug}>
                                <Button type="button" disabled={isCheckingSlug}>
                                    {isCheckingSlug && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Siguiente
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
