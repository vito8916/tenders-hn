"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoaderCircle } from "lucide-react";
import { SettingsSectionFooter } from "@/components/settings/settings-section";
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { updateOrganizationAction } from "../actions";
import { organizationNameField, organizationSlugField, type Organization } from "../schemas";

const organizationSettingsSchema = z.object({
    name: organizationNameField,
    slug: organizationSlugField,
});

type OrganizationSettingsValues = z.infer<typeof organizationSettingsSchema>;

export function OrganizationSettingsForm({ organization }: { organization: Organization }) {
    const router = useRouter();
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const form = useForm<OrganizationSettingsValues>({
        resolver: zodResolver(organizationSettingsSchema),
        defaultValues: {
            name: organization.name,
            slug: organization.slug,
        },
    });

    async function onSubmit(values: OrganizationSettingsValues) {
        const formData = new FormData();
        formData.set("name", values.name);
        formData.set("slug", values.slug);
        if (logoFile) {
            formData.set("orgLogoFile", logoFile);
        }

        const result = await updateOrganizationAction(formData, organization.id);

        if (!result.success) {
            toast.error(result.error ?? "No se pudo actualizar la organización.");
            return;
        }

        toast.success("Se actualizó la organización.");

        if (result.slug && result.slug !== organization.slug) {
            router.push(`/organizations/${result.slug}/settings/organization`);
        } else {
            router.refresh();
        }
    }

    const { isSubmitting } = form.formState;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-5 px-6 py-6">
                <div className="space-y-2">
                    <FormLabel>Logo</FormLabel>
                    <OrganizationLogoUpload
                        currentLogoUrl={organization.orgLogoUrl}
                        onFileSelect={setLogoFile}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre</FormLabel>
                            <FormControl>
                                <Input disabled={isSubmitting} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Identificador en la URL</FormLabel>
                            <FormControl>
                                <Input disabled={isSubmitting} {...field} />
                            </FormControl>
                            <FormDescription>
                                Se usa en la dirección web. Si lo cambia, los enlaces existentes a esta organización dejarán de funcionar.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                </div>

                <SettingsSectionFooter>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <LoaderCircle className="mr-2 size-4 animate-spin" />
                            Guardando…
                        </>
                    ) : (
                        "Guardar"
                    )}
                </Button>
                </SettingsSectionFooter>
            </form>
        </Form>
    );
}
