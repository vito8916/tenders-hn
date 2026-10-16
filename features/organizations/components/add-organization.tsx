"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { companyProfileInputSchema, EMPTY_COMPANY_PROFILE, type ImprovementsRemaining } from "@/features/company-profile/schemas";
import { createOrganizationWithCompanyAction } from "../actions";
import { organizationNameField } from "../schemas";
import { OrganizationCompanyFields } from "./organization-company-fields";

const formSchema = z.object({
    orgName: organizationNameField,
    ...companyProfileInputSchema.shape,
});

type FormData = z.infer<typeof formSchema>;

export function AddOrganizationForm({ improvementsRemaining }: { improvementsRemaining: ImprovementsRemaining }) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: { orgName: "", ...EMPTY_COMPANY_PROFILE },
    });

    const onSubmit = async ({ orgName, ...companyProfile }: FormData) => {
        setIsSubmitting(true);
        try {
            const result = await createOrganizationWithCompanyAction({ name: orgName, companyProfile });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            router.push(result.redirectUrl);
        } catch (error) {
            toast.error("Algo salió mal. Intente de nuevo.");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Form {...form}>
            <form className="w-full space-y-8" onSubmit={form.handleSubmit(onSubmit)}>
                <OrganizationCompanyFields improvementsRemaining={improvementsRemaining} />
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Crear organización
                    </Button>
                </div>
            </form>
        </Form>
    );
}
