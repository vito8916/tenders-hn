import { Suspense } from "react";
import { connection } from "next/server";
import { AddOrganizationStepperForm } from "@/features/organizations/components/add-organization";
import { Skeleton } from "@/components/ui/skeleton";

async function CreateOrganizationContent() {
    await connection();

    return (
        <div className="w-full max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-2">Create Organization</h1>
            <AddOrganizationStepperForm />
        </div>
    );
}

function CreateOrganizationSkeleton() {
    return (
        <div className="w-full max-w-2xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-96 w-full" />
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
