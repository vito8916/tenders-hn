"use client";

import { OrganizationCompanyFields } from "@/features/organizations/components/organization-company-fields";
import type { ImprovementsRemaining } from "@/features/company-profile/schemas";

export function CompanyStep({ improvementsRemaining }: { improvementsRemaining: ImprovementsRemaining }) {
    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Cuéntenos qué vende</h2>
                <p className="text-muted-foreground mt-1">
                    Con esta información buscamos en HonduCompras las oportunidades que corresponden a su empresa. Podrá
                    cambiarla más adelante en Configuración.
                </p>
            </div>

            <OrganizationCompanyFields improvementsRemaining={improvementsRemaining} />
        </div>
    );
}
