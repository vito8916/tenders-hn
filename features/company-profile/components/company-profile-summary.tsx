import type { CompanyProfile } from "../schemas";

function SummaryItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1 py-4 first:pt-0 last:pb-0">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

const listOrNone = (items: string[]) => (items.length > 0 ? items.join(" · ") : "Ninguno");

/** The saved profile, read-only: for members who cannot edit it and for the internal inbox. */
export function CompanyProfileSummary({ profile }: { profile: CompanyProfile }) {
    return (
        <dl className="divide-y divide-border/60">
            <SummaryItem label="¿Qué vende su empresa?">
                <p className="line-clamp-6 whitespace-pre-line">{profile.description}</p>
            </SummaryItem>
            <SummaryItem label="Productos o servicios concretos">{listOrNone(profile.offerings)}</SummaryItem>
            <SummaryItem label="Lo que no desea recibir">{listOrNone(profile.exclusions)}</SummaryItem>
            <SummaryItem label="Departamentos donde trabaja">
                {profile.locations.length > 0 ? profile.locations.join(" · ") : "Todo el país"}
            </SummaryItem>
        </dl>
    );
}
