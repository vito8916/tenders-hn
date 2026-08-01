"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { ImageUploadWithCrop } from "@/components/shared/image-upload-with-crop";

const ORG_LOGO_MAX_SIZE = 2 * 1024 * 1024;

interface OrganizationStepProps {
    logoFile: File | null;
    onLogoFileChange: (file: File | null) => void;
}

export function OrganizationStep({ logoFile, onLogoFileChange }: OrganizationStepProps) {
    const form = useFormContext();

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Add your organization</h2>
                <p className="text-muted-foreground mt-1">
                    We just need some basic info to get your organization set up. You&apos;ll be
                    able to edit this later.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <FormLabel>Logo</FormLabel>
                    <ImageUploadWithCrop
                        onFileSelect={onLogoFileChange}
                        selectedFile={logoFile}
                        maxFileSize={ORG_LOGO_MAX_SIZE}
                        shape="square"
                        size={64}
                    />
                    <p className="text-xs text-muted-foreground">
                        *.png, *.jpeg files up to 2 MB
                    </p>
                </div>

                <FormField
                    control={form.control}
                    name="orgName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name*</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="Constructora Norte"
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        const slug = e.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]/g, "-")
                                            .replace(/-+/g, "-")
                                            .replace(/^-|-$/g, "");
                                        form.setValue("orgSlug", slug);
                                    }}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="orgSlug"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Slug*</FormLabel>
                            <FormControl>
                                <InputGroup>
                                    <InputGroupAddon align="inline-start" className="pr-1">
                                        <InputGroupText className="pr-0.5!">
                                            /organizations/
                                        </InputGroupText>
                                    </InputGroupAddon>
                                    <InputGroupInput
                                        placeholder="acme-inc"
                                        className="pl-1"
                                        {...field}
                                    />
                                </InputGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
