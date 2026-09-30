"use client";

import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HONDURAS_DEPARTMENTS, type CompanyProfileInput, type ImprovableField, type ImprovementsRemaining } from "../schemas";
import { ImproveFieldButton } from "./improve-field-button";

type ListFieldName = "offerings" | "exclusions";

function LabelRow({ label, action }: { label: string; action: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <FormLabel>{label}</FormLabel>
            {action}
        </div>
    );
}

function LinesField({
    name,
    label,
    description,
    placeholder,
    disabled,
    action,
}: {
    name: ListFieldName;
    label: string;
    description: string;
    placeholder: string;
    disabled?: boolean;
    action: ReactNode;
}) {
    const form = useFormContext<CompanyProfileInput>();

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <LabelRow label={label} action={action} />
                    <FormControl>
                        <Textarea
                            rows={4}
                            placeholder={placeholder}
                            disabled={disabled}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={(field.value ?? []).join("\n")}
                            onChange={(event) => field.onChange(event.target.value.split("\n"))}
                        />
                    </FormControl>
                    <FormDescription>{description}</FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function LocationsField({ disabled }: { disabled?: boolean }) {
    const form = useFormContext<CompanyProfileInput>();

    return (
        <FormField
            control={form.control}
            name="locations"
            render={({ field: { value: selected = [], onChange } }) => (
                <FormItem>
                    <FormLabel>Departamentos donde trabaja</FormLabel>
                    <FormDescription>Déjelo vacío si atiende todo el país.</FormDescription>
                    <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                        {HONDURAS_DEPARTMENTS.map((department) => (
                            <Label key={department} className="font-normal">
                                <Checkbox
                                    disabled={disabled}
                                    checked={selected.includes(department)}
                                    onCheckedChange={(checked) =>
                                        onChange(
                                            checked
                                                ? HONDURAS_DEPARTMENTS.filter((item) => item === department || selected.includes(item))
                                                : selected.filter((item) => item !== department),
                                        )
                                    }
                                />
                                {department}
                            </Label>
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

/**
 * The profile's fields, for a form whose values include CompanyProfileInput (onboarding and settings).
 * @param orgId null during onboarding, before the organization exists
 */
export function CompanyProfileFields({
    orgId,
    improvementsRemaining,
    disabled,
}: {
    orgId: string | null;
    improvementsRemaining: ImprovementsRemaining;
    disabled?: boolean;
}) {
    const form = useFormContext<CompanyProfileInput>();
    const improveButton = (field: ImprovableField) => (
        <ImproveFieldButton field={field} orgId={orgId} initialRemaining={improvementsRemaining[field]} disabled={disabled} />
    );

    return (
        <div className="space-y-6">
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <LabelRow label="¿Qué vende su empresa?*" action={improveButton("description")} />
                        <FormControl>
                            <Textarea
                                rows={6}
                                disabled={disabled}
                                placeholder="Por ejemplo: venta de licencias de software, soporte de sistemas SAP y desarrollo de integraciones para instituciones públicas."
                                {...field}
                            />
                        </FormControl>
                        <FormDescription>
                            Descríbalo con sus palabras o pegue el objeto social de la escritura de constitución.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <LinesField
                name="offerings"
                label="Productos o servicios concretos"
                description="Opcional. Uno por línea, con las palabras que usaría una institución al comprarlos."
                placeholder={"Licencias de Microsoft 365\nSoporte funcional SAP"}
                disabled={disabled}
                action={improveButton("offerings")}
            />

            <LinesField
                name="exclusions"
                label="Lo que no desea recibir"
                description="Opcional. Uno por línea. Si el objeto de un proceso los menciona, se marca como descartado; podrá revisarlo de todas formas."
                placeholder={"Impresoras\nCámaras de seguridad"}
                disabled={disabled}
                action={improveButton("exclusions")}
            />

            <LocationsField disabled={disabled} />
        </div>
    );
}
