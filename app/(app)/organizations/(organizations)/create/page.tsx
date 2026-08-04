import { Suspense } from "react";
import { connection } from "next/server";
import { AddOrganizationStepperForm } from "@/features/organizations/components/add-organization";
import { CreateOrganizationSkeleton } from "@/components/shared/create-organization-skeleton";

async function CreateOrganizationContent() {
    await connection();

    return (
        <div className="mx-auto w-full max-w-2xl">
            <h1 className="mb-2 text-2xl font-bold">Create Organization</h1>
            <AddOrganizationStepperForm />
        </div>
    );
}

export default function CreateOrganizationPage() {
    return (
        <Suspense fallback={<CreateOrganizationSkeleton />}>
            <CreateOrganizationContent />
        </Suspense>
    );
}
