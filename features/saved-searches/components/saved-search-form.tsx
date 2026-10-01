"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFormContext, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { saveSavedSearchAction } from "../actions";
import {
    EMPTY_SAVED_SEARCH,
    SCHEDULE_LABELS,
    SEARCH_SCHEDULES,
    savedSearchInputSchema,
    type FilterOptions,
    type SavedSearch,
    type SavedSearchInput,
    type SearchSchedule,
} from "../schemas";
import { CheckboxFilterField, EntityFilterField } from "./filter-fields";

function LinesField({
    name,
    label,
    description,
    placeholder,
    disabled,
}: {
    name: "keywords" | "exclusions";
    label: string;
    description: string;
    placeholder: string;
    disabled?: boolean;
}) {
    const form = useFormContext<SavedSearchInput>();

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Textarea
                            rows={3}
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

function WhatFields({ hasProfile, profileSettingsHref, disabled }: { hasProfile: boolean; profileSettingsHref: string; disabled?: boolean }) {
    const form = useFormContext<SavedSearchInput>();
    const inheritsProfile = useWatch({ control: form.control, name: "inheritsProfile" });

    return (
        <div className="space-y-6">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre*</FormLabel>
                        <FormControl>
                            <Input placeholder="Por ejemplo: Soporte de software" disabled={disabled} {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="inheritsProfile"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>¿Qué busca?</FormLabel>
                        <RadioGroup
                            disabled={disabled}
                            value={field.value ? "profile" : "own"}
                            onValueChange={(value) => field.onChange(value === "profile")}
                            className="gap-2 pt-1"
                        >
                            <Label className="items-start font-normal">
                                <RadioGroupItem value="profile" className="mt-0.5" />
                                <span>
                                    Todo lo que vende la empresa, según su{" "}
                                    <Link href={profileSettingsHref} className="text-primary hover:underline">
                                        perfil
                                    </Link>
                                    {hasProfile ? "" : " (todavía no lo ha definido)"}
                                </span>
                            </Label>
                            <Label className="items-start font-normal">
                                <RadioGroupItem value="own" className="mt-0.5" />
                                <span>Solo una línea de negocio, que describo aquí</span>
                            </Label>
                        </RadioGroup>
                        <FormMessage />
                    </FormItem>
                )}
            />

            {inheritsProfile ? null : (
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Descripción de lo que busca*</FormLabel>
                            <FormControl>
                                <Textarea
                                    rows={4}
                                    disabled={disabled}
                                    placeholder="Por ejemplo: venta de computadoras, laptops, servidores y equipo de red para oficinas."
                                    {...field}
                                />
                            </FormControl>
                            <FormDescription>Con sus palabras, como lo describiría a un cliente.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <LinesField
                name="keywords"
                label="Términos adicionales"
                description="Opcional. Uno por línea: productos, marcas o servicios que también quiere encontrar."
                placeholder={"SAP\nLicencias Microsoft"}
                disabled={disabled}
            />
            <LinesField
                name="exclusions"
                label="Lo que no desea recibir en esta búsqueda"
                description={
                    inheritsProfile
                        ? "Opcional. Uno por línea; se suman a las exclusiones del perfil. Si el objeto de un proceso los menciona, se marca como descartado."
                        : "Opcional. Uno por línea. Si el objeto de un proceso los menciona, se marca como descartado."
                }
                placeholder={"Impresoras\nCámaras de seguridad"}
                disabled={disabled}
            />
        </div>
    );
}

function DeliveryFields({ allowedSchedules, disabled }: { allowedSchedules: SearchSchedule[]; disabled?: boolean }) {
    const form = useFormContext<SavedSearchInput>();
    const deliverByEmail = useWatch({ control: form.control, name: "deliverByEmail" });

    const checkbox = (name: "deliverByEmail" | "emailWhenEmpty" | "alertOnChanges", label: string, fieldDisabled?: boolean) => (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <Label className="font-normal">
                        <Checkbox disabled={disabled || fieldDisabled} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                        {label}
                    </Label>
                </FormItem>
            )}
        />
    );

    return (
        <div className="space-y-6">
            <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Frecuencia</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                            <FormControl>
                                <SelectTrigger className="w-full sm:w-96">
                                    <SelectValue />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {SEARCH_SCHEDULES.map((schedule) => (
                                    <SelectItem key={schedule} value={schedule} disabled={!allowedSchedules.includes(schedule)}>
                                        {SCHEDULE_LABELS[schedule]}
                                        {allowedSchedules.includes(schedule) ? "" : " · no incluida en su plan"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormDescription>
                            Hora de Honduras. Cada ejecución usa la última sincronización completa con HonduCompras.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <div className="space-y-3">
                {checkbox("deliverByEmail", "Enviar el reporte por correo")}
                {checkbox("emailWhenEmpty", "Enviarlo aunque no haya coincidencias nuevas", !deliverByEmail)}
                {checkbox("alertOnChanges", "Avisar cuando cambie una oportunidad ya enviada (fechas, documentos, etapa)")}
            </div>
        </div>
    );
}

export function SavedSearchForm({
    orgId,
    orgSlug,
    search,
    filterOptions,
    allowedSchedules,
    hasProfile,
}: {
    orgId: string;
    orgSlug: string;
    search: SavedSearch | null;
    filterOptions: FilterOptions;
    allowedSchedules: SearchSchedule[];
    hasProfile: boolean;
}) {
    const router = useRouter();
    const form = useForm<SavedSearchInput>({
        resolver: zodResolver(savedSearchInputSchema),
        defaultValues: search
            ? {
                  name: search.name,
                  inheritsProfile: search.inheritsProfile,
                  description: search.description ?? "",
                  keywords: search.keywords,
                  exclusions: search.exclusions,
                  entities: search.entities,
                  modalities: search.modalities,
                  acquisitionTypes: search.acquisitionTypes,
                  schedule: search.schedule,
                  deliverByEmail: search.deliverByEmail,
                  emailWhenEmpty: search.emailWhenEmpty,
                  alertOnChanges: search.alertOnChanges,
              }
            : { ...EMPTY_SAVED_SEARCH, schedule: allowedSchedules.includes("daily") ? "daily" : "manual" },
    });

    async function onSubmit(values: SavedSearchInput) {
        const result = await saveSavedSearchAction({ orgId, orgSlug, searchId: search?.id ?? null, search: values });
        if (!result.success) {
            toast.error(result.error);
            return;
        }
        toast.success(search ? "Se guardaron los cambios." : "Se creó la búsqueda.");
        router.push(`/organizations/${orgSlug}?busqueda=${result.searchId}`);
    }

    const { isSubmitting } = form.formState;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <SettingsSection title="Qué busca" description="Los procesos se evalúan contra esta descripción.">
                    <SettingsSectionBody>
                        <WhatFields
                            hasProfile={hasProfile}
                            profileSettingsHref={`/organizations/${orgSlug}/settings/company`}
                            disabled={isSubmitting}
                        />
                    </SettingsSectionBody>
                </SettingsSection>

                <SettingsSection title="Filtros" description="Opcionales. Limitan los procesos que se examinan.">
                    <SettingsSectionBody className="space-y-6">
                        <EntityFilterField options={filterOptions.entity} disabled={isSubmitting} />
                        <CheckboxFilterField name="modalities" label="Modalidades" options={filterOptions.modality} disabled={isSubmitting} />
                        <CheckboxFilterField
                            name="acquisitionTypes"
                            label="Tipos de adquisición"
                            options={filterOptions.acquisition_type}
                            disabled={isSubmitting}
                        />
                    </SettingsSectionBody>
                </SettingsSection>

                <SettingsSection title="Frecuencia y entrega">
                    <SettingsSectionBody>
                        <DeliveryFields allowedSchedules={allowedSchedules} disabled={isSubmitting} />
                    </SettingsSectionBody>
                </SettingsSection>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <LoaderCircle className="mr-2 size-4 animate-spin" />
                                Guardando…
                            </>
                        ) : search ? (
                            "Guardar cambios"
                        ) : (
                            "Crear búsqueda"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
