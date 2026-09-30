"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { SettingsSectionFooter } from "@/components/settings/settings-section";
import { saveCompanyProfileAction } from "../actions";
import {
    companyProfileInputSchema,
    EMPTY_COMPANY_PROFILE,
    type CompanyProfile,
    type CompanyProfileInput,
    type ImprovementsRemaining,
} from "../schemas";
import { CompanyProfileFields } from "./company-profile-fields";

export function CompanyProfileForm({
    orgId,
    orgSlug,
    profile,
    improvementsRemaining,
}: {
    orgId: string;
    orgSlug: string;
    profile: CompanyProfile | null;
    improvementsRemaining: ImprovementsRemaining;
}) {
    const router = useRouter();
    const form = useForm<CompanyProfileInput>({
        resolver: zodResolver(companyProfileInputSchema),
        defaultValues: profile
            ? {
                  description: profile.description,
                  offerings: profile.offerings,
                  exclusions: profile.exclusions,
                  locations: profile.locations,
              }
            : EMPTY_COMPANY_PROFILE,
    });

    async function onSubmit(values: CompanyProfileInput) {
        const result = await saveCompanyProfileAction({ orgId, orgSlug, profile: values });
        if (!result.success) {
            toast.error(result.error ?? "No se pudo guardar el perfil de la empresa.");
            return;
        }
        toast.success("Se guardó el perfil de la empresa.");
        router.refresh();
    }

    const { isSubmitting } = form.formState;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="px-6 py-6">
                    <CompanyProfileFields orgId={orgId} improvementsRemaining={improvementsRemaining} disabled={isSubmitting} />
                </div>
                <SettingsSectionFooter>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                                Guardando…
                            </>
                        ) : (
                            "Guardar"
                        )}
                    </Button>
                </SettingsSectionFooter>
            </form>
        </Form>
    );
}
