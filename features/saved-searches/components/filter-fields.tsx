"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FilterOption, SavedSearchInput } from "../schemas";

type FilterFieldName = "entities" | "modalities" | "acquisitionTypes";

const openCount = (option: FilterOption) =>
    option.openProcesses === 1 ? "1 proceso abierto" : `${option.openProcesses} procesos abiertos`;

// A value saved earlier may no longer appear in the processes; it stays selectable so it can be removed.
function withSelected(options: FilterOption[], selected: string[]): FilterOption[] {
    const known = new Set(options.map((option) => option.value));
    return [...options, ...selected.filter((value) => !known.has(value)).map((value) => ({ value, openProcesses: 0 }))];
}

/** Checkboxes for a short list, such as modalities or acquisition types. */
export function CheckboxFilterField({
    name,
    label,
    options,
    disabled,
}: {
    name: Exclude<FilterFieldName, "entities">;
    label: string;
    options: FilterOption[];
    disabled?: boolean;
}) {
    const form = useFormContext<SavedSearchInput>();

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field: { value: selected = [], onChange } }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormDescription>Ninguna marcada: todas.</FormDescription>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                        {withSelected(options, selected).map((option) => (
                            <Label key={option.value} className="font-normal">
                                <Checkbox
                                    disabled={disabled}
                                    checked={selected.includes(option.value)}
                                    onCheckedChange={(checked) =>
                                        onChange(checked ? [...selected, option.value] : selected.filter((item) => item !== option.value))
                                    }
                                />
                                <span>
                                    {option.value} <span className="text-muted-foreground">· {openCount(option)}</span>
                                </span>
                            </Label>
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

/** A searchable multi-select for institutions, which are too many for checkboxes. */
export function EntityFilterField({ options, disabled }: { options: FilterOption[]; disabled?: boolean }) {
    const form = useFormContext<SavedSearchInput>();
    const [open, setOpen] = useState(false);

    return (
        <FormField
            control={form.control}
            name="entities"
            render={({ field: { value: selected = [], onChange } }) => (
                <FormItem>
                    <FormLabel>Instituciones</FormLabel>
                    <FormDescription>Solo los procesos de estas instituciones. Ninguna elegida: todas.</FormDescription>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal">
                                {selected.length === 0 ? "Todas las instituciones" : selected.length === 1 ? "1 elegida" : `${selected.length} elegidas`}
                                <ChevronsUpDown className="size-4 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar institución…" />
                                <CommandList>
                                    <CommandEmpty>No hay instituciones con ese nombre.</CommandEmpty>
                                    {withSelected(options, selected).map((option) => {
                                        const isSelected = selected.includes(option.value);
                                        return (
                                            <CommandItem
                                                key={option.value}
                                                value={option.value}
                                                onSelect={() =>
                                                    onChange(isSelected ? selected.filter((item) => item !== option.value) : [...selected, option.value])
                                                }
                                            >
                                                <Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
                                                <span className="flex-1">{option.value}</span>
                                                <span className="text-xs text-muted-foreground">{option.openProcesses}</span>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {selected.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {selected.map((value) => (
                                <Badge key={value} variant="secondary" className="gap-1 pr-1">
                                    {value}
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => onChange(selected.filter((item) => item !== value))}
                                        className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                                        aria-label={`Quitar ${value}`}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
