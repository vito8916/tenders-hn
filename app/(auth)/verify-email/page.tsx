import { redirect } from "next/navigation";
import { Suspense } from "react";

import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";
import { AuthFormSkeleton } from "@/components/shared/auth-form-skeleton";

async function VerifyEmailContent({
    searchParams,
}: {
    searchParams: Promise<{ email?: string }>;
}) {
    const { email } = await searchParams;

    if (!email) {
        redirect("/sign-up");
    }

    return <VerifyEmailForm email={email} />;
}

export default function Page({
    searchParams,
}: {
    searchParams: Promise<{ email?: string }>;
}) {
    return (
        <Suspense fallback={<AuthFormSkeleton variant="forgot-password" />}>
            <VerifyEmailContent searchParams={searchParams} />
        </Suspense>
    );
}
