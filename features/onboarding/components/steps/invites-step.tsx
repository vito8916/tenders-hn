"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { ROLE_LABELS } from "@/features/memberships/schemas";

const MAX_INVITES = 10;

export function InvitesStep() {
    const form = useFormContext();
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "invites",
    });

    const canAddMore = fields.length < MAX_INVITES;

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Invite a su equipo</h2>
                <p className="text-muted-foreground mt-1">
                    Agregue a los miembros de su equipo para comenzar. Puede invitar a más personas más adelante.
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="grid grid-cols-[1fr_150px] gap-4 w-full max-w-xl">
                        <Label className="text-muted-foreground">Correo electrónico</Label>
                        <Label className="text-muted-foreground">Rol</Label>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        className="h-auto p-0 text-primary hover:bg-transparent hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() =>
                            append({ id: crypto.randomUUID(), email: "", role: "member" })
                        }
                        disabled={!canAddMore}
                    >
                        + Agregar invitación
                    </Button>
                </div>

                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-4 items-start max-w-xl">
                            <FormField
                                control={form.control}
                                name={`invites.${index}.email`}
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="colega@empresa.hn"
                                                type="email"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`invites.${index}.role`}
                                render={({ field }) => (
                                    <FormItem className="w-[150px]">
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                                                <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                                                <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {fields.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => remove(index)}
                                >
                                    <XIcon className="h-4 w-4" />
                                    <span className="sr-only">Quitar invitación</span>
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
