import { PageSectionSkeleton } from "@/components/shared/page-section-skeleton";

export default function OrgLoading() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
            <PageSectionSkeleton cards={3} showHeader showAction />
        </div>
    );
}

