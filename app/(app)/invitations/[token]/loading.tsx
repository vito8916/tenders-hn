import { InvitationCardSkeleton } from "@/components/shared/invitation-card-skeleton";

export default function InvitationLoading() {
    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <InvitationCardSkeleton />
        </main>
    );
}
