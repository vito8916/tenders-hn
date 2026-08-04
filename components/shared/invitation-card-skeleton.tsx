import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function InvitationCardSkeleton() {
    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-9 w-full" />
            </CardFooter>
        </Card>
    );
}
