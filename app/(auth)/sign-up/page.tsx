import { SignUpForm } from "@/features/auth/components/sign-up-form";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    const { next } = await searchParams;
    const nextPath = next?.startsWith("/") ? next : undefined;

    return <SignUpForm nextPath={nextPath} />;
}
