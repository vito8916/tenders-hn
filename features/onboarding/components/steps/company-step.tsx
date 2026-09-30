"use client";

import { CompanyProfileFields } from "@/features/company-profile/components/company-profile-fields";
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

            <CompanyProfileFields orgId={null} improvementsRemaining={improvementsRemaining} />
        </div>
    );
}
