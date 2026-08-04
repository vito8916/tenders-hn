import { Suspense } from "react";
import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { SettingsNav } from "./_components/settings-nav";
import { Skeleton } from "@/components/ui/skeleton";

async function SettingsLayoutContent({
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

function SettingsLayoutSkeleton({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 px-4 lg:p-6 lg:px-8">
            <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>
            <Skeleton className="h-9 w-full max-w-md" />
            <div className="max-w-2xl">{children}</div>
        </div>
    );
}

export default function SettingsLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ orgSlug: string }>;
}) {
    return (
        <Suspense fallback={<SettingsLayoutSkeleton>{children}</SettingsLayoutSkeleton>}>
            <SettingsLayoutContent params={params}>{children}</SettingsLayoutContent>
        </Suspense>
    );
}
