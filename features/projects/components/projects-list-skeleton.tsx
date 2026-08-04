import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PageHeaderSkeleton } from "@/components/shared/page-header-skeleton";

export function ProjectsListSkeleton({ showHeader = false }: { showHeader?: boolean }) {
    return (
        <div className="flex flex-col gap-6">
            {showHeader ? <PageHeaderSkeleton showAction actionWidth="w-32" /> : null}

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex flex-1 items-center gap-2">
                        <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                </div>

                <div className="overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                    <Skeleton className="h-4 w-4" />
                                </TableHead>
                                <TableHead>
                                    <Skeleton className="h-4 w-16" />
                                </TableHead>
                                <TableHead>
                                    <Skeleton className="h-4 w-24" />
                                </TableHead>
                                <TableHead>
                                    <Skeleton className="h-4 w-16" />
                                </TableHead>
                                <TableHead>
                                    <Skeleton className="h-4 w-20" />
                                </TableHead>
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: 6 }).map((_, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Skeleton className="h-4 w-4" />
                                    </TableCell>
                                    <TableCell>
                                        <Skeleton className="h-4 w-32" />
                                    </TableCell>
                                    <TableCell>
                                        <Skeleton className="h-4 w-48 max-w-[300px]" />
                                    </TableCell>
                                    <TableCell>
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </TableCell>
                                    <TableCell>
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </TableCell>
                                    <TableCell>
                                        <Skeleton className="size-8 rounded-md" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between px-2">
                    <Skeleton className="h-4 w-36" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="size-8" />
                        <Skeleton className="size-8" />
                        <Skeleton className="h-8 w-20" />
                    </div>
                </div>
            </div>
        </div>
    );
}
