import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Relevance, SearchRunMatch } from "../schemas";

const GROUPS: { relevance: Relevance; title: string; description: string }[] = [
    { relevance: "muy_relevante", title: "Muy relevantes", description: "Lo solicitado corresponde claramente a lo que ofrece la empresa." },
    { relevance: "posible", title: "Posibles", description: "Pueden corresponder; conviene revisarlas." },
    { relevance: "pendiente", title: "Pendientes", description: "No se pudieron evaluar; revíselas manualmente." },
    { relevance: "descartada", title: "Descartadas", description: "Lo solicitado no parece corresponder. Siguen disponibles para revisión." },
];

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

function MatchItem({ match }: { match: SearchRunMatch }) {
    return (
        <li className="space-y-2 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{match.expediente}</span>
                <span>{match.buyerEntity}</span>
                {match.modality ? <Badge variant="outline">{match.modality}</Badge> : null}
                {match.stage ? <Badge variant="outline">{match.stage}</Badge> : null}
            </div>
            <p className="font-medium">{match.title}</p>
            {match.reasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {match.reasons.map((reason) => (
                        <li key={reason.text}>{reason.text}</li>
                    ))}
                </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{match.closesAt ? `Cierra el ${dateTime.format(new Date(match.closesAt))}` : "Sin fecha de cierre publicada"}</span>
                <span>
                    Posición {match.retrievalRank}
                    {match.inScope !== null ? ` · in_scope ${match.inScope.toFixed(2)}` : ""}
                </span>
                <a href={match.detailUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Ver en HonduCompras <ExternalLink className="size-3" />
                </a>
            </div>
        </li>
    );
}

export function MatchList({ matches }: { matches: SearchRunMatch[] }) {
    return (
        <div className="space-y-8">
            {GROUPS.map((group) => {
                const groupMatches = matches.filter((match) => match.relevance === group.relevance);
                if (groupMatches.length === 0) return null;

                const heading = (
                    <div>
                        <h2 className="text-lg font-medium">
                            {group.title} <span className="text-muted-foreground">({groupMatches.length})</span>
                        </h2>
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                    </div>
                );
                const list = (
                    <ul className="space-y-3">
                        {groupMatches.map((match) => (
                            <MatchItem key={match.processId} match={match} />
                        ))}
                    </ul>
                );

                return group.relevance === "descartada" ? (
                    <details key={group.relevance} className="space-y-3">
                        <summary className="cursor-pointer list-none">{heading}</summary>
                        {list}
                    </details>
                ) : (
                    <section key={group.relevance} className="space-y-3">
                        {heading}
                        {list}
                    </section>
                );
            })}
        </div>
    );
}
