import Link from "next/link";
import { Ban, Bell, Briefcase, Hash, Inbox, Layers, Star, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NewListDialog } from "@/features/saved-searches/components/new-list-dialog";
import type { FilterOptions } from "@/features/saved-searches/schemas";
import { homeViewPath } from "../opportunities";

export type PaneList = { id: string; name: string; isActive: boolean; newMatches: number; followed: boolean };

function PaneLink({
    href,
    icon: Icon,
    label,
    hint,
    current,
    trailing,
}: {
    href: string;
    icon: LucideIcon;
    label: string;
    /** Said to screen readers after the label, for what the icon shows. */
    hint?: string;
    current: boolean;
    trailing?: React.ReactNode;
}) {
    return (
        <li>
            <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted", current && "bg-muted font-medium")}
            >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                    {label}
                    {hint ? <span className="sr-only"> ({hint})</span> : null}
                </span>
                {trailing}
            </Link>
        </li>
    );
}

function Count({ value }: { value: number }) {
    return <span className="text-xs text-muted-foreground tabular-nums">{value}</span>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="space-y-1">
            <div className="flex items-center justify-between gap-2 px-3 pt-3">
                <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

/**
 * The Home's left pane (plan D7, spec 0.4 §12.1): Recomendadas and Todas with their counts; Nuevas,
 * En seguimiento, and Descartadas; and the organization's lists with their new opportunities, a bell on those the user follows.
 */
export function OpportunitiesPane({
    orgSlug,
    current,
    counts,
    lists,
    newList,
}: {
    orgSlug: string;
    /** The view or list shown: a view's kind («recomendadas», «nuevas», …) or a list's id. */
    current: string;
    counts: { recomendadas: number; todas: number; nuevas: number; seguimiento: number };
    lists: PaneList[];
    /** What «Nueva lista» needs; null when the user may not create one (role, plan, or limit). */
    newList: { orgId: string; filterOptions: FilterOptions; hasProfile: boolean } | null;
}) {
    return (
        <nav aria-label="Oportunidades" className="space-y-2 p-2">
            <Section title="Oportunidades">
                <ul className="space-y-0.5">
                    <PaneLink
                        href={homeViewPath(orgSlug, { kind: "recomendadas" })}
                        icon={Star}
                        label="Recomendadas"
                        current={current === "recomendadas"}
                        trailing={<Count value={counts.recomendadas} />}
                    />
                    <PaneLink href={homeViewPath(orgSlug, { kind: "todas" })} icon={Layers} label="Todas" current={current === "todas"} trailing={<Count value={counts.todas} />} />
                </ul>
            </Section>
            <Section title="Seguimiento">
                <ul className="space-y-0.5">
                    <PaneLink
                        href={homeViewPath(orgSlug, { kind: "nuevas" })}
                        icon={Inbox}
                        label="Nuevas"
                        current={current === "nuevas"}
                        trailing={<Count value={counts.nuevas} />}
                    />
                    <PaneLink
                        href={homeViewPath(orgSlug, { kind: "seguimiento" })}
                        icon={Briefcase}
                        label="En seguimiento"
                        current={current === "seguimiento"}
                        trailing={<Count value={counts.seguimiento} />}
                    />
                    <PaneLink href={homeViewPath(orgSlug, { kind: "descartadas" })} icon={Ban} label="Descartadas" current={current === "descartadas"} />
                </ul>
            </Section>
            {lists.length > 0 || newList ? (
                <Section
                    title="Listas"
                    action={
                        newList ? (
                            <NewListDialog
                                orgId={newList.orgId}
                                orgSlug={orgSlug}
                                filterOptions={newList.filterOptions}
                                hasProfile={newList.hasProfile}
                            />
                        ) : null
                    }
                >
                    {lists.length > 0 ? (
                        <ul className="space-y-0.5">
                            {lists.map((list) => (
                                <PaneLink
                                    key={list.id}
                                    href={homeViewPath(orgSlug, { kind: "lista", searchId: list.id })}
                                    icon={list.followed ? Bell : Hash}
                                    label={list.name}
                                    hint={list.followed ? "la sigue" : undefined}
                                    current={list.id === current}
                                    trailing={
                                        !list.isActive ? (
                                            <span className="text-xs text-muted-foreground">Pausada</span>
                                        ) : list.newMatches > 0 ? (
                                            <Badge variant="secondary" className="rounded-full px-1.5 text-[11px] text-muted-foreground">
                                                {list.newMatches === 1 ? "1 nueva" : `${list.newMatches} nuevas`}
                                            </Badge>
                                        ) : null
                                    }
                                />
                            ))}
                        </ul>
                    ) : (
                        <p className="px-3 py-1 text-xs text-muted-foreground">Cree listas para seguir otros temas, instituciones o modalidades.</p>
                    )}
                </Section>
            ) : null}
        </nav>
    );
}
