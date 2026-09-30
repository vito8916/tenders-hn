"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { forgotPasswordSchema, ForgotPasswordFormValues } from "../schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { forgotPasswordAction } from "../actions";
import { toast } from "sonner";

export function ForgotPasswordForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
    const [success, setSuccess] = useState(false);

    const form = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    async function onSubmit(data: ForgotPasswordFormValues) {
        try {
            const result = await forgotPasswordAction(data);

            if (result.error) {
                toast.error(result.error);
                return;
            }

            form.reset();
            toast.success("Le enviamos un correo para restablecer su contraseña");
            setSuccess(true);
        } catch {
            toast.error("Algo salió mal. Intente de nuevo.");
        }
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Restablecer contraseña</CardTitle>
                    <CardDescription>
                        Ingrese su correo electrónico y le enviaremos un enlace para restablecer su contraseña.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="space-y-4">
                            <div className="p-4 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                                Le enviamos un correo con un enlace para restablecer su contraseña. Revise su bandeja de
                                entrada y siga las instrucciones.
                            </div>
                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4">
                                    Volver a iniciar sesión
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Correo electrónico</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="nombre@empresa.hn"
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
                                            Enviando…
                                        </>
                                    ) : (
                                        "Restablecer contraseña"
                                    )}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
            <div className="text-center text-xs text-muted-foreground">
                También puede{" "}
                <Link href="/login" className="underline underline-offset-4 hover:text-primary">
                    iniciar sesión
                </Link>{" "}
                o{" "}
                <Link href="/sign-up" className="underline underline-offset-4 hover:text-primary">
                    crear una cuenta
                </Link>{" "}
                si aún no tiene una.
            </div>
        </div>
    );
}
