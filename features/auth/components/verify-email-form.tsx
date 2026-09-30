"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { resendConfirmationEmailAction, verifyEmailAction } from "../actions";
import { VerifyEmailFormValues, verifyEmailSchema } from "../schemas";
import { useAuthNextPath } from "@/hooks/use-auth-next-path";

export function VerifyEmailForm({ email }: { email: string }) {
    const [isResending, setIsResending] = useState(false);
    const router = useRouter();
    const nextPath = useAuthNextPath();

    const form = useForm<VerifyEmailFormValues>({
        resolver: zodResolver(verifyEmailSchema),
        defaultValues: {
            email,
            token: "",
        },
    });

    async function onSubmit(data: VerifyEmailFormValues) {
        try {
            const result = await verifyEmailAction(data);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Correo electrónico confirmado");
            router.push(nextPath ?? "/organizations");
        } catch {
            toast.error("Algo salió mal. Intente de nuevo.");
        }
    }

    async function handleResend() {
        try {
            setIsResending(true);
            const result = await resendConfirmationEmailAction({ email });
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success("Le enviamos un código nuevo");
        } catch {
            toast.error("Algo salió mal. Intente de nuevo.");
        } finally {
            setIsResending(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-2xl">Confirme su correo electrónico</CardTitle>
                <CardDescription>
                    Ingrese el código de 6 dígitos que enviamos a <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="token"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código</FormLabel>
                                    <FormControl>
                                        <Input
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            placeholder="123456"
                                            className="text-center font-mono text-lg tracking-[0.5em]"
                                            autoFocus
                                            disabled={form.formState.isSubmitting}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Confirmando…
                                </>
                            ) : (
                                "Confirmar correo electrónico"
                            )}
                        </Button>
                    </form>
                </Form>

                <div className="text-center text-sm text-muted-foreground">
                    ¿No recibió el código?{" "}
                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0"
                        onClick={handleResend}
                        disabled={isResending || form.formState.isSubmitting}
                    >
                        {isResending ? "Enviando…" : "Enviar uno nuevo"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
