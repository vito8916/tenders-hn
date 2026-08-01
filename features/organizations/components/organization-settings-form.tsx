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
import { OrganizationLogoUpload } from "./organization-logo-upload";
import { updateOrganizationAction } from "../actions";
import type { Organization } from "../schemas";

const organizationSettingsSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Organization name must be at least 2 characters")
        .max(100, "Organization name cannot exceed 100 characters"),
    slug: z
        .string()
        .trim()
        .min(2, "Slug must be at least 2 characters")
        .max(50, "Slug cannot exceed 50 characters")
        .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
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
            toast.error(result.error ?? "Failed to update organization");
            return;
        }

        toast.success("Organization updated");

        if (result.slug && result.slug !== organization.slug) {
            router.push(`/organizations/${result.slug}/settings/organization`);
        } else {
            router.refresh();
        }
    }

    const { isSubmitting } = form.formState;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                            <FormLabel>Name</FormLabel>
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
                            <FormLabel>Slug</FormLabel>
                            <FormControl>
                                <Input disabled={isSubmitting} {...field} />
                            </FormControl>
                            <FormDescription>
                                Used in URLs. Changing it breaks existing links to this organization.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <LoaderCircle className="mr-2 size-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Save changes"
                    )}
                </Button>
            </form>
        </Form>
    );
}
