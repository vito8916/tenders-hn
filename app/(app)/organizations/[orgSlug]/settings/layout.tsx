import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { SettingsNav } from "./_components/settings-nav";

export default async function SettingsLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                    <Settings className="size-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold">Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage your account and organization preferences.
                    </p>
                </div>
            </div>

            <SettingsNav orgSlug={orgSlug} />

            <div className="max-w-2xl">{children}</div>
        </div>
    );
}
