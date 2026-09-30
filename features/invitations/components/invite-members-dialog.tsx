"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, UserPlus, X } from "lucide-react";
import { ROLE_LABELS } from "@/features/memberships/schemas";
import { inviteItemSchema, type InviteRole } from "../schemas";
import { inviteMembersAction } from "../actions";

interface InviteRow {
    email: string;
    role: InviteRole;
}

const MAX_INVITES = 10;

export function InviteMembersDialog({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState<InviteRow[]>([{ email: "", role: "member" }]);
    const [isPending, startTransition] = useTransition();

    function updateRow(index: number, patch: Partial<InviteRow>) {
        setRows((current) =>
            current.map((row, i) => (i === index ? { ...row, ...patch } : row))
        );
    }

    function removeRow(index: number) {
        setRows((current) => current.filter((_, i) => i !== index));
    }

    function handleSubmit() {
        const invites = rows.filter((row) => row.email.trim() !== "");
        if (invites.length === 0) {
            toast.error("Agregue al menos un correo electrónico");
            return;
        }

        for (const invite of invites) {
            const parsed = inviteItemSchema.safeParse(invite);
            if (!parsed.success) {
                toast.error(`Correo electrónico no válido: ${invite.email}`);
                return;
            }
        }

        startTransition(async () => {
            const result = await inviteMembersAction({ orgId, orgSlug, invites });

            if (!result.success) {
                toast.error(result.error ?? "No se pudieron enviar las invitaciones");
                return;
            }

            if (result.failedEmails && result.failedEmails.length > 0) {
                toast.warning(
                    `Se crearon las invitaciones, pero no se pudo enviar el correo a ${result.failedEmails.join(", ")}. Reenvíelo desde la lista de invitaciones pendientes.`
                );
            } else {
                toast.success("Invitaciones enviadas");
            }

            setRows([{ email: "", role: "member" }]);
            setOpen(false);
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <UserPlus className="mr-2 size-4" />
                    Invitar miembros
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Invitar miembros</DialogTitle>
                    <DialogDescription>
                        Cada persona recibirá un correo electrónico con un enlace para unirse a esta organización.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {rows.map((row, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                type="email"
                                placeholder="colega@empresa.hn"
                                value={row.email}
                                disabled={isPending}
                                onChange={(event) => updateRow(index, { email: event.target.value })}
                            />
                            <Select
                                value={row.role}
                                disabled={isPending}
                                onValueChange={(value) => updateRow(index, { role: value as InviteRole })}
                            >
                                <SelectTrigger className="w-36 shrink-0" size="sm" aria-label="Rol">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                                    <SelectItem value="member">{ROLE_LABELS.member}</SelectItem>
                                    <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                disabled={isPending || rows.length === 1}
                                onClick={() => removeRow(index)}
                            >
                                <X className="size-4" />
                                <span className="sr-only">Quitar fila</span>
                            </Button>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending || rows.length >= MAX_INVITES}
                        onClick={() => setRows((current) => [...current, { email: "", role: "member" }])}
                    >
                        <Plus className="mr-1 size-4" />
                        Agregar otro
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                Enviando…
                            </>
                        ) : (
                            "Enviar invitaciones"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
