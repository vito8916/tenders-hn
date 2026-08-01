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
                <h2 className="text-2xl font-bold">Set up your profile</h2>
                <p className="text-muted-foreground mt-1">
                    Check if the profile information is correct. You&apos;ll be able to change this
                    later in the account settings page.
                </p>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <FormLabel>Profile picture</FormLabel>
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
                            <FormLabel>Name*</FormLabel>
                            <FormControl>
                                <Input placeholder="Your name" {...field} />
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
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                                <Input placeholder="+1234567890" {...field} />
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
                            <FormLabel>Email*</FormLabel>
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
