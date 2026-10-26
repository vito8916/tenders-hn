"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addNoteAction, deleteNoteAction } from "../actions";
import type { OpportunityNote } from "../schemas";

const writtenAt = new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Tegucigalpa" });

/** The team's notes on the opportunity, with author and date; authors, owners, and admins delete them. */
export function OpportunityNotes({
    orgId,
    orgSlug,
    processId,
    notes,
    userId,
    canTrack,
    canDeleteAny,
}: {
    orgId: string;
    orgSlug: string;
    processId: string;
    notes: OpportunityNote[];
    userId: string;
    canTrack: boolean;
    canDeleteAny: boolean;
}) {
    const [body, setBody] = useState("");
    const [isPending, startTransition] = useTransition();

    const add = () =>
        startTransition(async () => {
            const result = await addNoteAction({ orgId, orgSlug, processId, body });
            if (!result.success) {
                toast.error(result.error ?? "No se pudo guardar la nota.");
                return;
            }
            setBody("");
        });
    const remove = (noteId: string) =>
        startTransition(async () => {
            const result = await deleteNoteAction({ orgId, orgSlug, noteId });
            if (!result.success) toast.error(result.error ?? "No se pudo borrar la nota.");
        });

    return (
        <div className="space-y-3">
            {notes.length > 0 ? (
                <ul className="space-y-2">
                    {notes.map((note) => (
                        <li key={note.id} className="space-y-1 rounded-lg border p-3 text-sm">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                    {note.authorName ?? "Exmiembro"} · {writtenAt.format(new Date(note.createdAt))}
                                </p>
                                {canTrack && (note.authorId === userId || canDeleteAny) ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="-mt-1 -mr-1 size-7"
                                        disabled={isPending}
                                        onClick={() => remove(note.id)}
                                        aria-label="Borrar la nota"
                                    >
                                        <Trash2 />
                                    </Button>
                                ) : null}
                            </div>
                            <p className="whitespace-pre-line">{note.body}</p>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground">Sin notas del equipo.</p>
            )}
            {canTrack ? (
                <div className="space-y-2">
                    <Textarea
                        value={body}
                        maxLength={2000}
                        rows={2}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Por ejemplo: pedimos cotización al proveedor el lunes"
                        aria-label="Nueva nota"
                    />
                    <Button size="sm" variant="secondary" disabled={isPending || body.trim() === ""} onClick={add}>
                        Agregar nota
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
