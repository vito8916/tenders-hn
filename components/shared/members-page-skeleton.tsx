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

function MembersTableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            <Skeleton className="h-4 w-16" />
                        </TableHead>
                        <TableHead>
                            <Skeleton className="h-4 w-12" />
                        </TableHead>
                        <TableHead>
                            <Skeleton className="h-4 w-14" />
                        </TableHead>
                        <TableHead className="w-16" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: rows }).map((_, index) => (
                        <TableRow key={index}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Skeleton className="size-8 shrink-0 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell>
                                <Skeleton className="size-8 rounded-md" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function MembersPageSkeleton() {
    return (
        <div className="space-y-6">
            <PageHeaderSkeleton showAction actionWidth="w-36" />
            <MembersTableSkeleton />
            <section className="space-y-3">
                <Skeleton className="h-6 w-44" />
                <MembersTableSkeleton rows={2} />
            </section>
        </div>
    );
}
