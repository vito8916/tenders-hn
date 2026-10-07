import type { SavedSearch } from "../schemas";

function CriteriaItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

const listOr = (items: string[], empty: string) => (items.length > 0 ? items.join(" · ") : empty);

/** What a search looks for, read-only. */
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
            <CriteriaItem label="Avisos">
                {search.alertOnChanges ? "Avisa cuando cambia una oportunidad ya enviada" : "No avisa cambios de oportunidades enviadas"}
            </CriteriaItem>
            {search.isActive ? null : <CriteriaItem label="Estado">Pausada</CriteriaItem>}
        </dl>
    );
}
