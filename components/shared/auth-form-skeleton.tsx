import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type AuthFormSkeletonVariant = "login" | "sign-up" | "forgot-password" | "update-password";

const FIELD_COUNTS: Record<AuthFormSkeletonVariant, number> = {
    login: 2,
    "sign-up": 3,
    "forgot-password": 1,
    "update-password": 2,
};

export function AuthFormSkeleton({
    variant = "login",
}: {
    variant?: AuthFormSkeletonVariant;
}) {
    const fieldCount = FIELD_COUNTS[variant];
    const showOAuth = variant === "login" || variant === "sign-up";

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="space-y-2">
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-4 w-full max-w-[16rem]" />
                    {variant === "login" ? (
                        <div className="space-y-1.5 pt-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-48" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                    ) : null}
                </CardHeader>
                <CardContent className="grid gap-6">
                    <div className="space-y-4">
                        {Array.from({ length: fieldCount }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-16" />
                                    {variant === "login" && index === 1 ? (
                                        <Skeleton className="h-4 w-28" />
                                    ) : null}
                                </div>
                                <Skeleton className="h-9 w-full" />
                                {variant === "sign-up" && index === fieldCount - 1 ? (
                                    <Skeleton className="h-3 w-48" />
                                ) : null}
                            </div>
                        ))}
                        <Skeleton className="h-9 w-full" />
                    </div>

                    {showOAuth ? (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center">
                                    <Skeleton className="h-3 w-28 bg-background" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <Skeleton className="h-9 w-full" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                            <div className="flex justify-center">
                                <Skeleton className="h-4 w-44" />
                            </div>
                        </>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
