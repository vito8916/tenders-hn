"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

/**
 * The detail beside the results (spec §12.3). It is open while the URL has
 * ?detalle=; closing removes only that, so the search, run, filters, page,
 * and scroll position stay as they were.
 */
export function DetailSheet({ title, children }: { title: string; children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const close = () => {
        const params = new URLSearchParams(searchParams);
        params.delete("detalle");
        router.replace(`${pathname}?${params}`, { scroll: false });
    };

    return (
        <Sheet open onOpenChange={(open) => !open && close()}>
            <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
                <SheetTitle className="sr-only">{title}</SheetTitle>
                <SheetDescription className="sr-only">Detalle de la oportunidad</SheetDescription>
                {children}
            </SheetContent>
        </Sheet>
    );
}
