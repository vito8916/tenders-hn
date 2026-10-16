"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CompanyProfileFields } from "@/features/company-profile/components/company-profile-fields";
import type { ImprovementsRemaining } from "@/features/company-profile/schemas";

/** The organization's name and what the company sells, for a form whose values include orgName and CompanyProfileInput. */
export function OrganizationCompanyFields({ improvementsRemaining }: { improvementsRemaining: ImprovementsRemaining }) {
    const form = useFormContext<{ orgName: string }>();

    return (
        <div className="space-y-6">
            <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre de la empresa*</FormLabel>
                        <FormControl>
                            <Input placeholder="Constructora Norte" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <CompanyProfileFields orgId={null} improvementsRemaining={improvementsRemaining} />
        </div>
    );
}
