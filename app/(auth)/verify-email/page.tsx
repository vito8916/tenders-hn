import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";

export default async function Page({
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
