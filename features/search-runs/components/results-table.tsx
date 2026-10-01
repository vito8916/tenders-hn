import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MATCH_STATE_LABELS, RELEVANCE_LABELS, withParams, type SearchParamsRecord } from "../results";
import type { Relevance, SearchRunMatch } from "../schemas";

const deadline = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Tegucigalpa" });
const day = new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Tegucigalpa" });

const RELEVANCE_VARIANTS: Record<Relevance, "default" | "secondary" | "outline"> = {
    muy_relevante: "default",
    posible: "secondary",
    pendiente: "outline",
    descartada: "outline",
};

export function RelevanceBadge({ relevance }: { relevance: Relevance }) {
    return (
        <Badge variant={RELEVANCE_VARIANTS[relevance]} className={cn(relevance === "descartada" && "text-muted-foreground")}>
            {RELEVANCE_LABELS[relevance]}
        </Badge>
    );
}

export function MatchStateBadge({ match }: { match: SearchRunMatch }) {
    if (match.matchState !== "nueva" && match.matchState !== "actualizada") return null;
    return <Badge variant="outline">{MATCH_STATE_LABELS[match.matchState]}</Badge>;
}

const formatDeadline = (match: SearchRunMatch) => (match.closesAt ? deadline.format(new Date(match.closesAt)) : "Sin fecha");

/**
 * The shown run's opportunities (spec §12.2). The expediente and the object
 * open the detail beside the table, keeping the filters and the page.
 */
export function ResultsTable({ rows, params, homeHref }: { rows: SearchRunMatch[]; params: SearchParamsRecord; homeHref: string }) {
    const detailHref = (match: SearchRunMatch) => `${homeHref}${withParams(params, { detalle: match.processId })}`;

    return (
        <>
            <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Relevancia</TableHead>
                            <TableHead className="w-full">Oportunidad</TableHead>
                            <TableHead>Modalidad y etapa</TableHead>
                            <TableHead>Fecha límite</TableHead>
                            <TableHead className="text-right">Documentos</TableHead>
                            <TableHead>Detectada</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((match) => (
                            <TableRow key={match.processId} className={cn(match.relevance === "descartada" && "text-muted-foreground")}>
                                <TableCell className="align-top">
                                    <div className="flex flex-col items-start gap-1">
                                        <RelevanceBadge relevance={match.relevance} />
                                        <MatchStateBadge match={match} />
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-0 align-top whitespace-normal">
                                    <Link href={detailHref(match)} scroll={false} className="group block space-y-0.5">
                                        <span className="block text-xs text-muted-foreground group-hover:underline">{match.expediente}</span>
                                        <span className="line-clamp-2 font-medium group-hover:underline">{match.title}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{match.buyerEntity}</span>
                                    </Link>
                                </TableCell>
                                <TableCell className="align-top text-xs whitespace-normal">
                                    <span className="block min-w-36">{match.modality ?? "—"}</span>
                                    <span className="block text-muted-foreground">{match.stage ?? "—"}</span>
                                </TableCell>
                                <TableCell className="align-top text-xs">{formatDeadline(match)}</TableCell>
                                <TableCell className="text-right align-top text-xs tabular-nums">{match.documentsCount > 0 ? match.documentsCount : "—"}</TableCell>
                                <TableCell className="align-top text-xs">{match.detectedAt ? day.format(new Date(match.detectedAt)) : "—"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ul className="divide-y rounded-lg border md:hidden">
                {rows.map((match) => (
                    <li key={match.processId}>
                        <Link href={detailHref(match)} scroll={false} className="block space-y-1.5 p-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <RelevanceBadge relevance={match.relevance} />
                                <MatchStateBadge match={match} />
                                <span className="text-xs text-muted-foreground">{match.expediente}</span>
                            </div>
                            <p className="line-clamp-2 text-sm font-medium">{match.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{match.buyerEntity}</p>
                            <p className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Cierra: {formatDeadline(match)}</span>
                                {match.documentsCount > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                        <FileText className="size-3" />
                                        {match.documentsCount}
                                    </span>
                                ) : null}
                            </p>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    );
}
