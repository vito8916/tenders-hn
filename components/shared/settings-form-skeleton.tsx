import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

function SettingsSectionSkeleton({
    fields = 3,
    showButton = true,
}: {
    fields?: number;
    showButton?: boolean;
}) {
    return (
        <section className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="space-y-4">
                {Array.from({ length: fields }).map((_, index) => (
                    <div key={index} className="space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ))}
                {showButton ? <Skeleton className="h-9 w-28" /> : null}
            </div>
        </section>
    );
}

export function SettingsFormSkeleton({
    sections = 2,
}: {
    sections?: number;
}) {
    return (
        <div className="space-y-6">
            {Array.from({ length: sections }).map((_, index) => (
                <div key={index} className="space-y-6">
                    {index > 0 ? <Separator /> : null}
                    <SettingsSectionSkeleton fields={index === 0 ? 3 : 2} />
                </div>
            ))}
        </div>
    );
}
