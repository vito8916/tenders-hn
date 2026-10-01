"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ListFilter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
    FACETS,
    RESULT_SORTS,
    VIEW_PARAMS,
    facetValueLabel,
    withParams,
    type FacetCounts,
    type FacetKey,
    type ResultView,
    type SearchParamsRecord,
} from "../results";

const SEARCH_DELAY_MS = 300;

function useViewNavigation() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const navigate = (changes: Record<string, string | string[] | null>) => {
        const current: SearchParamsRecord = {};
        for (const key of new Set(searchParams.keys())) current[key] = searchParams.getAll(key);
        startTransition(() => router.replace(`${pathname}${withParams(current, changes)}`, { scroll: false }));
    };

    return { navigate, isPending };
}

function FacetFilter({
    facet,
    values,
    selected,
    onChange,
}: {
    facet: FacetKey;
    values: FacetCounts[FacetKey];
    selected: string[];
    onChange: (selected: string[]) => void;
}) {
    const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(selected.length > 0 && "border-primary")}>
                    {FACETS[facet].label}
                    {selected.length > 0 ? <Badge className="ml-1 px-1.5">{selected.length}</Badge> : null}
                    <ChevronDown className="text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <Command>
                    {values.length > 8 ? <CommandInput placeholder={`Buscar ${FACETS[facet].label.toLowerCase()}…`} /> : null}
                    <CommandList>
                        <CommandEmpty>Sin coincidencias.</CommandEmpty>
                        {values.map(({ value, count }) => (
                            <CommandItem key={value} value={facetValueLabel(facet, value)} onSelect={() => toggle(value)}>
                                <Check className={cn("size-4", selected.includes(value) ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate">{facetValueLabel(facet, value)}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

function DeadlineFilter({ view, onChange }: { view: ResultView; onChange: (changes: Record<string, string | null>) => void }) {
    const active = view.closesFrom !== null || view.closesTo !== null;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(active && "border-primary")}>
                    Fecha límite
                    <ChevronDown className="text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="start">
                <div className="space-y-1.5">
                    <Label htmlFor="cierre-desde">Desde</Label>
                    <Input
                        id="cierre-desde"
                        type="date"
                        defaultValue={view.closesFrom ?? ""}
                        onChange={(event) => onChange({ cierre_desde: event.target.value || null })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="cierre-hasta">Hasta</Label>
                    <Input
                        id="cierre-hasta"
                        type="date"
                        defaultValue={view.closesTo ?? ""}
                        onChange={(event) => onChange({ cierre_hasta: event.target.value || null })}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

/**
 * Search, sort, and facets for the results table. They only change the URL
 * (and so the view of this run), never the saved search (spec §12.2).
 */
export function ResultsToolbar({ view, facets, filtered }: { view: ResultView; facets: FacetCounts; filtered: boolean }) {
    const { navigate, isPending } = useViewNavigation();
    const [query, setQuery] = useState(view.q);
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Typing waits for a pause before it changes the URL.
    const changeQuery = (value: string) => {
        setQuery(value);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => navigate({ q: value.trim() || null }), SEARCH_DELAY_MS);
    };

    const facetFilters = (Object.keys(FACETS) as FacetKey[])
        .filter((facet) => facets[facet].length > 1 || view.facets[facet].length > 0)
        .map((facet) => (
            <FacetFilter
                key={facet}
                facet={facet}
                values={facets[facet]}
                selected={view.facets[facet]}
                onChange={(selected) => navigate({ [facet]: selected })}
            />
        ));
    const clear = filtered ? (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => {
                clearTimeout(searchTimeout.current);
                setQuery("");
                navigate(Object.fromEntries(VIEW_PARAMS.filter((key) => key !== "orden").map((key) => [key, null])));
            }}
        >
            <X />
            Limpiar filtros
        </Button>
    ) : null;

    return (
        <div className={cn("space-y-3 transition-opacity", isPending && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                    <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => changeQuery(event.target.value)}
                        placeholder="Buscar en los resultados…"
                        aria-label="Buscar en los resultados"
                        className="pl-8"
                    />
                </div>
                <Select value={view.sort} onValueChange={(sort) => navigate({ orden: sort === "relevancia" ? null : sort })}>
                    <SelectTrigger className="w-48" aria-label="Ordenar por">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(RESULT_SORTS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                Ordenar: {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="md:hidden">
                            <ListFilter />
                            Filtros
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="max-h-[80svh] overflow-y-auto p-4">
                        <SheetTitle>Filtros</SheetTitle>
                        <div className="flex flex-wrap gap-2">
                            {facetFilters}
                            <DeadlineFilter view={view} onChange={navigate} />
                            {clear}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
            <div className="hidden flex-wrap items-center gap-2 md:flex">
                {facetFilters}
                <DeadlineFilter view={view} onChange={navigate} />
                {clear}
            </div>
        </div>
    );
}
