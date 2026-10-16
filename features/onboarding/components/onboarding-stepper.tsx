"use client";

import { useState } from "react";
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
import { ActivationStep } from "./steps/activation-step";
import { CompanyStep } from "./steps/company-step";
import { JoinStep, type JoinableInvitation } from "./steps/join-step";
import { PlanStep } from "./steps/plan-step";
import { completeOnboardingWithoutOrgAction, createOnboardingOrganizationAction } from "../actions";
import { prepareCheckoutAction } from "@/features/billing/actions";
import { usePaddle } from "@/features/billing/components/use-paddle";
import type { PlanWithPrice } from "@/features/billing/schemas";
import { organizationNameField } from "@/features/organizations/schemas";
import {
    companyProfileInputSchema,
    EMPTY_COMPANY_PROFILE,
    type ImprovementsRemaining,
} from "@/features/company-profile/schemas";
import { ChevronRight, Loader2 } from "lucide-react";

const CREATE_STEPS = [{ value: "company" }, { value: "plan" }];

const JOIN_STEPS = [{ value: "join" }];

const onboardingFormSchema = z.object({
    orgName: organizationNameField,
    ...companyProfileInputSchema.shape,
});

type OnboardingFormData = z.infer<typeof onboardingFormSchema>;

interface OnboardingStepperProps {
    pendingInvitations: JoinableInvitation[];
    hasExistingMembership: boolean;
    improvementsRemaining: ImprovementsRemaining;
    plans: PlanWithPrice[];
    preselectedPlanId: string | null;
}

export function OnboardingStepper({
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
    const [step, setStep] = useState(mode === "join" ? "join" : "company");
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Created at the plan step, since Paddle's checkout carries its id; from then on the company step is saved.
    const [organization, setOrganization] = useState<{ id: string; slug: string } | null>(null);
    const [checkoutCompleted, setCheckoutCompleted] = useState(false);

    // Closing the checkout without paying lands on the organization, which asks for a plan.
    const paddle = usePaddle(
        () => setCheckoutCompleted(true),
        () => {
            if (organization) router.push(`/organizations/${organization.slug}`);
        },
    );

    const STEPS = mode === "join" ? JOIN_STEPS : CREATE_STEPS;

    const form = useForm<OnboardingFormData>({
        resolver: zodResolver(onboardingFormSchema),
        defaultValues: {
            orgName: "",
            ...EMPTY_COMPANY_PROFILE,
        },
    });

    const stepIndex = STEPS.findIndex((s) => s.value === step);

    const handleValidate = async (_targetValue: string, direction: "next" | "prev"): Promise<boolean> => {
        if (direction === "prev") return organization === null;

        return step === "company" ? form.trigger(["orgName", "description", "offerings", "exclusions", "locations"]) : true;
    };

    /** Creates the organization once; choosing another plan after closing the checkout reuses it. */
    const ensureOrganization = async () => {
        if (organization) return organization;

        const values = form.getValues();
        const result = await createOnboardingOrganizationAction({
            name: values.orgName,
            companyProfile: {
                description: values.description,
                offerings: values.offerings,
                exclusions: values.exclusions,
                locations: values.locations,
            },
        });
        if (!result.success) {
            toast.error(result.error);
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

    const handleFinishJoin = () =>
        withSubmitting(async () => {
            const result = await completeOnboardingWithoutOrgAction(joinedOrgSlug);
            if (result && !result.success) {
                toast.error(result.error);
            }
        });

    // Joining requires at least one accepted invitation or a prior membership
    const canFinishJoin = joinedOrgSlug !== null || hasExistingMembership;

    return (
        <Form {...form}>
            <Stepper value={step} onValueChange={setStep} onValidate={handleValidate}>
                <div className="w-full space-y-8">
                    {STEPS.length > 1 ? (
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
                    ) : null}

                    {mode === "join" ? (
                        <StepperContent value="join">
                            <JoinStep
                                invitations={pendingInvitations}
                                hasExistingMembership={hasExistingMembership}
                                onJoined={setJoinedOrgSlug}
                                onCreateInstead={() => {
                                    setMode("create");
                                    setStep("company");
                                }}
                            />
                        </StepperContent>
                    ) : (
                        <>
                            <StepperContent value="company">
                                <CompanyStep improvementsRemaining={improvementsRemaining} />
                            </StepperContent>

                            <StepperContent value="plan">
                                {checkoutCompleted && organization ? (
                                    <ActivationStep orgId={organization.id} orgSlug={organization.slug} />
                                ) : (
                                    <PlanStep
                                        plans={plans}
                                        preselectedPlanId={preselectedPlanId}
                                        disabled={isSubmitting || !paddle}
                                        onChoose={choosePlan}
                                    />
                                )}
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
                        {mode === "join" ? (
                            <Button onClick={handleFinishJoin} disabled={isSubmitting || !canFinishJoin}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Finalizar
                            </Button>
                        ) : step === "company" ? (
                            <StepperNext asChild>
                                <Button type="button">
                                    Siguiente
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </StepperNext>
                        ) : null}
                    </div>
                </div>
            </Stepper>
        </Form>
    );
}
