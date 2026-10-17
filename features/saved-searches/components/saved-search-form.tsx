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
import { Textarea } from "@/components/ui/textarea";
import { SettingsSection, SettingsSectionBody } from "@/components/settings/settings-section";
import { cn } from "@/lib/utils";
import { saveSavedSearchAction } from "../actions";
import {
    EMPTY_SAVED_SEARCH,
    savedSearchInputSchema,
    type FilterOptions,
    type SavedSearch,
    type SavedSearchInput,
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

function WhatFields({
    hasProfile,
    profileSettingsHref,
    disabled,
}: {
    hasProfile: boolean;
    profileSettingsHref: string;
    disabled?: boolean;
}) {
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
                label="Lo que no desea recibir en esta lista"
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

function AlertField({ disabled }: { disabled?: boolean }) {
    const form = useFormContext<SavedSearchInput>();

    return (
        <FormField
            control={form.control}
            name="alertOnChanges"
            render={({ field }) => (
                <FormItem>
                    <Label className="font-normal">
                        <Checkbox disabled={disabled} checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
                        Avisar cuando cambie una oportunidad ya enviada (fechas, documentos, etapa)
                    </Label>
                </FormItem>
            )}
        />
    );
}

/** A part of the form: a card on a page, a plain heading inside a dialog, which is already a card. */
function FormSection({
    title,
    description,
    plain,
    className,
    children,
}: {
    title: string;
    description: string;
    plain: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    if (!plain) {
        return (
            <SettingsSection title={title} description={description}>
                <SettingsSectionBody className={className}>{children}</SettingsSectionBody>
            </SettingsSection>
        );
    }
    return (
        <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
            <header>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </header>
            <div className={className}>{children}</div>
        </section>
    );
}

export function SavedSearchForm({
    orgId,
    orgSlug,
    search,
    filterOptions,
    hasProfile,
    onClose,
}: {
    orgId: string;
    orgSlug: string;
    search: SavedSearch | null;
    filterOptions: FilterOptions;
    hasProfile: boolean;
    /** Inside a dialog: closes it on «Cancelar» and once the list is saved. A page goes back instead. */
    onClose?: () => void;
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
                  alertOnChanges: search.alertOnChanges,
              }
            : EMPTY_SAVED_SEARCH,
    });

    async function onSubmit(values: SavedSearchInput) {
        const result = await saveSavedSearchAction({ orgId, orgSlug, searchId: search?.id ?? null, search: values });
        if (!result.success) {
            toast.error(result.error);
            return;
        }
        toast.success(search ? "Se guardaron los cambios." : "Se creó la lista.");
        onClose?.();
        router.push(`/organizations/${orgSlug}/lists/${result.searchId}`);
    }

    const { isSubmitting } = form.formState;
    const inDialog = onClose !== undefined;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormSection title="Qué busca" description="Los procesos se evalúan contra esta descripción." plain={inDialog}>
                    <WhatFields
                        hasProfile={hasProfile}
                        profileSettingsHref={`/organizations/${orgSlug}/settings/company`}
                        disabled={isSubmitting}
                    />
                </FormSection>

                <FormSection title="Filtros" description="Opcionales. Limitan los procesos que se examinan." plain={inDialog} className="space-y-6">
                    <EntityFilterField options={filterOptions.entity} disabled={isSubmitting} />
                    <CheckboxFilterField name="modalities" label="Modalidades" options={filterOptions.modality} disabled={isSubmitting} />
                    <CheckboxFilterField
                        name="acquisitionTypes"
                        label="Tipos de adquisición"
                        options={filterOptions.acquisition_type}
                        disabled={isSubmitting}
                    />
                </FormSection>

                <FormSection
                    title="Avisos"
                    description="Cuándo se actualizan las listas y se envía el correo con el Excel se define en Configuración › Reportes."
                    plain={inDialog}
                >
                    <AlertField disabled={isSubmitting} />
                </FormSection>

                <div className={cn("flex justify-end gap-2", inDialog && "border-t pt-6")}>
                    <Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose ?? (() => router.back())}>
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
                            "Crear lista"
                        )}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
