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
 * The run's downloads (spec §12.2), each with the number of rows it holds:
 * every result of the run, or only the filtered ones, as CSV, and the
 * run's frozen PDF once the worker has rendered it.
 */
export function DownloadMenu({
    runHref,
    reportReady,
    reportCount,
    params,
    total,
    filtered,
}: {
    /** /organizations/<org>/runs/<run>, under which the csv and pdf routes live. */
    runHref: string;
    reportReady: boolean;
    /** Opportunities in the PDF: all but the discarded ones. */
    reportCount: number;
    params: SearchParamsRecord;
    total: number;
    /** The filtered count, or null without filters. */
    filtered: number | null;
}) {
    const csvHref = `${runHref}/csv`;
    const filteredQuery = withParams(params, { alcance: "filtrados", busqueda: null, ejecucion: null, detalle: null, pagina: null });

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
                    <a href={`${csvHref}?alcance=todos`} download>
                        Todos los resultados de esta ejecución ({total})
                    </a>
                </DropdownMenuItem>
                {filtered !== null ? (
                    <DropdownMenuItem asChild>
                        <a href={`${csvHref}${filteredQuery}`} download>
                            Solo resultados filtrados ({filtered})
                        </a>
                    </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>PDF</DropdownMenuLabel>
                {reportReady ? (
                    <DropdownMenuItem asChild>
                        <a href={`${runHref}/pdf`}>Reporte de la ejecución ({reportCount} oportunidades)</a>
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem disabled>El reporte se está preparando…</DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
