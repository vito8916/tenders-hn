import { ProjectDetailsSkeleton } from "@/features/projects/components/project-details-skeleton";

export default function ProjectDetailsLoading() {
    return (
        <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6 px-4 lg:px-8">
            <ProjectDetailsSkeleton />
        </div>
    );
}
