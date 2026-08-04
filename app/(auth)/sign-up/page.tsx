import { SignUpForm } from "@/features/auth/components/sign-up-form";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    const { next } = await searchParams;
    const nextPath = next?.startsWith("/") ? next : undefined;

    return <SignUpForm nextPath={nextPath} />;
}
