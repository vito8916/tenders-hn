import { SCHEDULE_LABELS, type SavedSearch } from "../schemas";

const dateTime = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

function CriteriaItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

const listOr = (items: string[], empty: string) => (items.length > 0 ? items.join(" · ") : empty);

/** What a search looks for and when it runs, read-only. */
export function SearchCriteria({ search }: { search: SavedSearch }) {
    return (
        <dl className="space-y-3 text-sm">
            <CriteriaItem label="Qué busca">
                {search.inheritsProfile ? (
                    "Todo lo que vende la empresa, según su perfil"
                ) : (
                    <p className="line-clamp-4 whitespace-pre-line">{search.description}</p>
                )}
            </CriteriaItem>
            {search.keywords.length > 0 ? <CriteriaItem label="Términos adicionales">{search.keywords.join(" · ")}</CriteriaItem> : null}
            {search.exclusions.length > 0 ? <CriteriaItem label="No desea recibir">{search.exclusions.join(" · ")}</CriteriaItem> : null}
            <CriteriaItem label="Instituciones">{listOr(search.entities, "Todas")}</CriteriaItem>
            <CriteriaItem label="Modalidades">{listOr(search.modalities, "Todas")}</CriteriaItem>
            <CriteriaItem label="Tipos de adquisición">{listOr(search.acquisitionTypes, "Todos")}</CriteriaItem>
            <CriteriaItem label="Frecuencia">
                {search.isActive ? SCHEDULE_LABELS[search.schedule] : "Pausada"}
                {search.nextRunAt ? (
                    <span className="text-muted-foreground"> · próxima el {dateTime.format(new Date(search.nextRunAt))}</span>
                ) : null}
            </CriteriaItem>
            <CriteriaItem label="Entrega">
                {search.deliverByEmail
                    ? search.emailWhenEmpty
                        ? "Por correo, aunque no haya coincidencias nuevas"
                        : "Por correo cuando haya coincidencias nuevas"
                    : "Solo se guarda en la plataforma"}
                {search.alertOnChanges ? "; avisa cambios de oportunidades enviadas" : ""}
            </CriteriaItem>
        </dl>
    );
}
