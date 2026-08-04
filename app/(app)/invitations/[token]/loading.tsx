import { Skeleton } from "@/components/ui/skeleton";

export default function InvitationLoading() {
    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <Skeleton className="h-64 w-full max-w-md rounded-xl" />
        </main>
    );
}
