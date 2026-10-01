import { ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchStateBadge, RelevanceBadge } from "@/features/search-runs/components/results-table";
import type { SearchRunMatch } from "@/features/search-runs/schemas";
import { getOpportunityDetailService } from "../services";
import { DOCUMENT_KIND_LABELS, type ProcessDetail, type ProcessEvent } from "../schemas";
import { FeedbackButtons } from "./feedback-buttons";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "full", timeStyle: "short", timeZone: "America/Tegucigalpa" });
const shortDateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

const formatDate = (value: string | null | undefined, format = shortDateTime) => (value ? format.format(new Date(value)) : null);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3 border-t px-6 py-5">
            <h3 className="text-sm font-semibold">{title}</h3>
            {children}
        </section>
    );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

/** The deadline, where and to whom bids go: what a supplier needs first (plan, Phase 4). */
function KeyFacts({ match, detail }: { match: SearchRunMatch; detail: ProcessDetail | null }) {
    const deadline = detail?.bidsDueAt ?? match.closesAt;
    const contact = detail?.contact;
    return (
        <dl className="grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
            <Fact label="Fecha límite de ofertas">
                <span className="font-medium">{formatDate(deadline, dateTime) ?? "No publicada"}</span>
            </Fact>
            <Fact label="Recepción de ofertas">{detail?.bidReceptionPlace ?? "No indicada en el detalle; revise los documentos"}</Fact>
            <Fact label="Contacto">
                {contact?.name || contact?.email || contact?.phone ? (
                    <span className="flex flex-col">
                        {contact.name ? <span>{contact.name}</span> : null}
                        {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                                {contact.email}
                            </a>
                        ) : null}
                        {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                                {contact.phone}
                            </a>
                        ) : null}
                    </span>
                ) : (
                    "No publicado"
                )}
            </Fact>
            {detail?.clarificationsDueAt ? <Fact label="Consultas y aclaraciones hasta">{formatDate(detail.clarificationsDueAt)}</Fact> : null}
        </dl>
    );
}

function ProcessData({ match, detail }: { match: SearchRunMatch; detail: ProcessDetail | null }) {
    const funding = [detail?.fundingType, detail?.fundingSource].filter(Boolean).join(" · ");
    return (
        <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Institución">{match.buyerEntity}</Fact>
            {detail?.purchaseUnit ? <Fact label="Unidad de compra">{detail.purchaseUnit}</Fact> : null}
            <Fact label="Modalidad">{match.modality ?? "—"}</Fact>
            <Fact label="Etapa">{match.stage ?? "—"}</Fact>
            <Fact label="Tipo de adquisición">{match.acquisitionType ?? "—"}</Fact>
            <Fact label="Inicio">{formatDate(detail?.startsAt ?? match.startsAt) ?? "—"}</Fact>
            {funding ? <Fact label="Financiamiento">{funding}</Fact> : null}
            {detail?.bidDocumentPrice ? (
                <Fact label="Precio del pliego">
                    {detail.bidDocumentPrice.currency} {detail.bidDocumentPrice.amount}
                </Fact>
            ) : null}
            <Fact label="Detectada por Tenders HN">{formatDate(match.detectedAt) ?? "—"}</Fact>
        </dl>
    );
}

/** Each product line with its specifications in full: in Compra Menor they often hold the only submission instructions. */
function Products({ products }: { products: NonNullable<ProcessDetail["products"]> }) {
    return (
        <ol className="space-y-3">
            {products.map((product, index) => (
                <li key={`${index}-${product.unspsc}`} className="space-y-1 rounded-lg border p-3 text-sm">
                    <p className="font-medium">{product.description ?? "Sin descripción"}</p>
                    <p className="text-xs text-muted-foreground">
                        {product.quantity ? `Cantidad: ${product.quantity}` : "Cantidad no indicada"}
                        {product.unspsc ? ` · UNSPSC ${product.unspsc}` : ""}
                    </p>
                    {product.specifications ? <p className="whitespace-pre-line text-muted-foreground">{product.specifications}</p> : null}
                </li>
            ))}
        </ol>
    );
}

const eventDate = (value: unknown) => (typeof value === "string" ? shortDateTime.format(new Date(value)) : "—");
const text = (value: unknown) => (typeof value === "string" ? value : "—");

function describeEvent(event: ProcessEvent) {
    switch (event.kind) {
        case "stage_changed":
            return `Etapa: ${text(event.before?.stage)} → ${text(event.after?.stage)}`;
        case "deadline_changed":
            return event.before?.bidsDueAt !== event.after?.bidsDueAt
                ? `Fecha límite: ${eventDate(event.before?.bidsDueAt)} → ${eventDate(event.after?.bidsDueAt)}`
                : `Consultas hasta: ${eventDate(event.before?.clarificationsDueAt)} → ${eventDate(event.after?.clarificationsDueAt)}`;
        case "document_added":
            return `Documento nuevo: ${text(event.after?.title)}`;
        case "document_replaced":
            return `Documento reemplazado: ${text(event.after?.title)}`;
        case "document_removed":
            return `Documento retirado: ${text(event.before?.title)}`;
        case "created":
            return "Publicado";
    }
}

/** The opportunity beside the table (spec §12.3), loaded when the panel opens. */
export async function OpportunityDetail({
    orgId,
    orgSlug,
    match,
    canDecide,
}: {
    orgId: string;
    orgSlug: string;
    match: SearchRunMatch;
    canDecide: boolean;
}) {
    const { version, events, documents, feedback } = await getOpportunityDetailService({ orgId, processId: match.processId });
    const detail = version?.detail ?? null;
    const changedSinceRun = version !== null && match.processVersionId !== null && version.versionId !== match.processVersionId;

    return (
        <article>
            <header className="space-y-3 px-6 pt-6 pb-5">
                <div className="flex flex-wrap items-center gap-1.5 pr-8">
                    <RelevanceBadge relevance={match.relevance} />
                    <MatchStateBadge match={match} />
                    <span className="text-xs text-muted-foreground">{match.expediente}</span>
                </div>
                {/* The detail's object is fuller, except in Compra Menor, where it is just «Compra Menor» and the match's title names the products. */}
                <h2 className="text-lg leading-snug font-semibold">{detail?.object && detail.object !== "Compra Menor" ? detail.object : match.title}</h2>
                <p className="text-sm text-muted-foreground">{match.buyerEntity}</p>
                <Button variant="outline" size="sm" asChild>
                    <a href={match.detailUrl} target="_blank" rel="noreferrer">
                        Ver en HonduCompras <ExternalLink />
                    </a>
                </Button>
                {changedSinceRun ? (
                    <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                        El proceso cambió después de esta ejecución: se muestran sus datos actuales.
                    </p>
                ) : null}
                <KeyFacts match={match} detail={detail} />
            </header>

            <Section title="¿Le interesa?">
                <FeedbackButtons orgId={orgId} orgSlug={orgSlug} processId={match.processId} feedback={feedback} canDecide={canDecide} />
            </Section>

            {match.reasons.length > 0 ? (
                <Section title="Por qué coincide">
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                        {match.reasons.map((reason, index) => (
                            <li key={`${index}-${reason.text}`}>{reason.text}</li>
                        ))}
                    </ul>
                </Section>
            ) : null}

            {detail?.products && detail.products.length > 0 ? (
                <Section title={`Productos y especificaciones (${detail.products.length})`}>
                    <Products products={detail.products} />
                </Section>
            ) : null}

            <Section title="Documentos">
                {documents.length > 0 ? (
                    <ul className="space-y-1.5">
                        {documents.map((document) => (
                            <li key={document.id}>
                                <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                                    <FileText className="size-4 shrink-0" />
                                    <span className="truncate">{document.title}</span>
                                    <Badge variant="outline" className="shrink-0">
                                        {DOCUMENT_KIND_LABELS[document.kind]}
                                    </Badge>
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">Este proceso no tiene documentos publicados en HonduCompras.</p>
                )}
            </Section>

            <Section title="Datos del proceso">
                <ProcessData match={match} detail={detail} />
            </Section>

            <Section title="Cambios">
                {events.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                        {events.map((event) => (
                            <li key={event.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                                <span className="shrink-0 text-xs text-muted-foreground sm:w-36">{shortDateTime.format(new Date(event.observedAt))}</span>
                                <span>{describeEvent(event)}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">Sin cambios desde que Tenders HN lo detectó.</p>
                )}
            </Section>
        </article>
    );
}
