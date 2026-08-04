import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
    return (
        <div className="w-full space-y-6">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    );
}
