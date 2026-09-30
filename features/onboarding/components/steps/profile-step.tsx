"use client";

import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ImageUploadWithCrop } from "@/components/shared/image-upload-with-crop";

interface ProfileStepProps {
    defaultAvatarUrl?: string | null;
    avatarFile: File | null;
    onAvatarFileChange: (file: File | null) => void;
}

export function ProfileStep({
    defaultAvatarUrl,
    avatarFile,
    onAvatarFileChange,
}: ProfileStepProps) {
    const form = useFormContext();

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Configure su perfil</h2>
                <p className="text-muted-foreground mt-1">
                    Revise que los datos de su perfil sean correctos. Podrá cambiarlos más adelante
                    en la configuración de su cuenta.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <FormLabel>Foto de perfil</FormLabel>
                    <ImageUploadWithCrop
                        onFileSelect={onAvatarFileChange}
                        selectedFile={avatarFile}
                        currentImageUrl={defaultAvatarUrl}
                        maxFileSize={2 * 1024 * 1024}
                        shape="circle"
                        size={96}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nombre*</FormLabel>
                            <FormControl>
                                <Input placeholder="Su nombre" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Teléfono</FormLabel>
                            <FormControl>
                                <Input placeholder="+50499998888" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Correo electrónico*</FormLabel>
                            <FormControl>
                                <Input readOnly disabled className="bg-muted" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
