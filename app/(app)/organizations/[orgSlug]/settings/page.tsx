import { connection } from "next/server";
import { redirect } from "next/navigation";

export default async function SettingsPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    await connection();
    const { orgSlug } = await params;
    redirect(`/organizations/${orgSlug}/settings/account`);
}
