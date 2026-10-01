"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * The report's chat beside the results, open while the URL has
 * ?preguntar=reporte; closing removes only that, so the view stays as it was.
 */
export function ReportChatSheet({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const close = () => {
        const params = new URLSearchParams(searchParams);
        params.delete("preguntar");
        router.replace(`${pathname}?${params}`, { scroll: false });
    };

    return (
        <Sheet open onOpenChange={(open) => !open && close()}>
            <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
                <SheetHeader className="border-b">
                    <SheetTitle>Preguntar sobre el reporte</SheetTitle>
                    <SheetDescription>Consulte las oportunidades relevantes de esta ejecución.</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
