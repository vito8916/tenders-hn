"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil } from "lucide-react";
import {
    ProjectStatusSchema,
    ProjectVisibilitySchema,
    type Project,
} from "../schemas";
import { updateProjectAction } from "../actions";

const editProjectFormSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
    description: z.string().trim().max(2000),
    status: ProjectStatusSchema,
    visibility: ProjectVisibilitySchema,
});

type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

export function EditProjectDialog({ project, orgSlug }: { project: Project; orgSlug: string }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const form = useForm<EditProjectFormValues>({
        resolver: zodResolver(editProjectFormSchema),
        defaultValues: {
            name: project.name,
            description: project.description ?? "",
            status: project.status,
            visibility: project.visibility,
        },
    });

    async function onSubmit(values: EditProjectFormValues) {
        const result = await updateProjectAction({
            projectId: project.id,
            orgSlug,
            ...values,
        });

        if (!result.success) {
            toast.error(result.error ?? "Failed to update project");
            return;
        }

        toast.success("Project updated");
        setOpen(false);

        if (result.slug && result.slug !== project.slug) {
            router.push(`/organizations/${orgSlug}/projects/${result.slug}`);
        } else {
            router.refresh();
        }
    }

    const { isSubmitting } = form.formState;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Pencil className="mr-2 size-4" />
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit project</DialogTitle>
                    <DialogDescription>
                        Update the project details. Renaming changes its URL.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea rows={4} disabled={isSubmitting} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={isSubmitting}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ProjectStatusSchema.options.map((status) => (
                                                    <SelectItem key={status} value={status} className="capitalize">
                                                        {status}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="visibility"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Visibility</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={isSubmitting}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ProjectVisibilitySchema.options.map((visibility) => (
                                                    <SelectItem key={visibility} value={visibility} className="capitalize">
                                                        {visibility}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSubmitting}
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 size-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save changes"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
