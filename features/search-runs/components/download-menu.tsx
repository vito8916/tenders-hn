"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { withParams, type SearchParamsRecord } from "../results";

/**
 * The view's downloads (spec 0.4 §12.2), each with the number of rows it holds: every opportunity of the view,
 * or only the filtered ones, as CSV; and, for Recomendadas, a list, or a snapshot, the run's frozen PDF and
 * Excel file once the worker has rendered them.
 */
export function DownloadMenu({
    csvHref,
    params,
    total,
    filtered,
    run,
}: {
    /** The view's CSV route, which reads the same filters as the page. */
    csvHref: string;
    params: SearchParamsRecord;
    total: number;
    /** The filtered count, or null without filters. */
    filtered: number | null;
    /** /organizations/<org>/updates/<run>, under which the pdf and xlsx routes live. */
    run: { href: string; reportReady: boolean; excelReady: boolean } | null;
}) {
    const withoutPanels = { detalle: null, pagina: null, preguntar: null };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download />
                    Descargar
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>CSV</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                    <a href={`${csvHref}${withParams(params, { ...withoutPanels, alcance: "todos" })}`} download>
                        Todas las de esta vista ({total})
                    </a>
                </DropdownMenuItem>
                {filtered !== null ? (
                    <DropdownMenuItem asChild>
                        <a href={`${csvHref}${withParams(params, { ...withoutPanels, alcance: "filtrados" })}`} download>
                            Solo resultados filtrados ({filtered})
                        </a>
                    </DropdownMenuItem>
                ) : null}
                {run ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Reporte de la actualización</DropdownMenuLabel>
                        {run.reportReady ? (
                            <DropdownMenuItem asChild>
                                <a href={`${run.href}/pdf`}>PDF</a>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem disabled>El PDF se está preparando…</DropdownMenuItem>
                        )}
                        {run.excelReady ? (
                            <DropdownMenuItem asChild>
                                <a href={`${run.href}/xlsx`}>Excel (.xlsx)</a>
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem disabled>El Excel se está preparando…</DropdownMenuItem>
                        )}
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
