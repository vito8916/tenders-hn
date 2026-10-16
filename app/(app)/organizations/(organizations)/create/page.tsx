import { Suspense } from "react";
import { connection } from "next/server";
import { AddOrganizationForm } from "@/features/organizations/components/add-organization";
import { getImprovementsRemainingService } from "@/features/company-profile/services";
import { CreateOrganizationSkeleton } from "@/components/shared/create-organization-skeleton";

async function CreateOrganizationContent() {
    await connection();
    const improvementsRemaining = await getImprovementsRemainingService();

    return (
        <div className="mx-auto w-full max-w-2xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold">Crear organización</h1>
                <p className="mt-1 text-muted-foreground">
                    Cuéntenos qué vende para que busquemos las oportunidades que corresponden a su empresa. Después elegirá el plan.
                </p>
            </div>
            <AddOrganizationForm improvementsRemaining={improvementsRemaining} />
        </div>
    );
}

export const metadata = { title: "Crear organización" };

export default function CreateOrganizationPage() {
    return (
        <Suspense fallback={<CreateOrganizationSkeleton />}>
            <CreateOrganizationContent />
        </Suspense>
    );
}
