import { redirect } from "next/navigation";

export default async function SettingsPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;
    redirect(`/organizations/${orgSlug}/settings/account`);
}
