import { SettingsRow } from "@/components/settings/settings-section";
import type { Usage } from "../schemas";

const ofLimit = (used: number, limit: number | null) => (limit === null ? `${used} (sin límite)` : `${used} de ${limit}`);

export function UsageSummary({ usage }: { usage: Usage }) {
    return (
        <>
            <SettingsRow label="Usuarios" description="Miembros e invitaciones pendientes.">
                <span className="text-sm">{ofLimit(usage.seatsUsed, usage.maxMembers)}</span>
            </SettingsRow>
            <SettingsRow label="Listas activas" description="Recomendadas y las listas pausadas no cuentan.">
                <span className="text-sm">{ofLimit(usage.activeSearches, usage.maxActiveSearches)}</span>
            </SettingsRow>
            <SettingsRow label="Créditos de IA" description="Disponibles en este mes; no se acumulan.">
                <span className="text-sm">
                    {usage.creditsAvailable === null ? "—" : `${usage.creditsAvailable} de ${usage.creditsGranted ?? 0}`}
                </span>
            </SettingsRow>
        </>
    );
}
