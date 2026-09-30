"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignInFormValues, signInSchema } from "../schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Eye, EyeOff, GithubIcon, Loader2 } from "lucide-react";
import { signInAction, signInWithOAuthAction } from "../actions";
import { useAuthNextPath, authPathWithNext } from "@/hooks/use-auth-next-path";

export function LoginForm({
    className,
    ...props
}: React.ComponentPropsWithoutRef<"div">) {
    const [showPassword, setShowPassword] = useState(false);
    const [isOauthLoading, setIsOauthLoading] = useState<"github" | "google" | null>(null);
    const router = useRouter();
    const nextPath = useAuthNextPath();
    const destination = nextPath ?? "/organizations";

    // Initialize form with Zod validation.
    const form = useForm<SignInFormValues>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    // Submit handler calls server action and handles UI feedback.
    async function onSubmit(data: SignInFormValues) {
        try {
            const result = await signInAction(data);

            if (result.code === "email_not_confirmed") {
                const verifyParams = new URLSearchParams({ email: data.email });
                if (nextPath) verifyParams.set("next", nextPath);
                toast.info("Confirme su correo electrónico para continuar");
                router.push(`/verify-email?${verifyParams}`);
                return;
            }

            if (result.error) {
                toast.error(result.error);
                return;
            }

            if (result.data) {
                // On success, inform the user and navigate to the destination.
                toast.success("Sesión iniciada");
                router.push(destination);
            }
        } catch {
            toast.error("Algo salió mal. Intente de nuevo.");
        }
    }

    async function handleOAuth(provider: "github" | "google") {
        try {
            setIsOauthLoading(provider);
            const result = await signInWithOAuthAction(provider, destination);
            if (result?.error) {
                toast.error(result.error);
                return;
            }
            if (result?.url) {
                window.location.href = result.url;
            }
        } catch {
            toast.error("No se pudo iniciar sesión con el proveedor. Intente de nuevo.");
        } finally {
            setIsOauthLoading(null);
        }
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Iniciar sesión</CardTitle>
                    <CardDescription>
                        Ingrese su correo electrónico y contraseña para acceder a su cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
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

                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center justify-between">
                                                <FormLabel>Contraseña</FormLabel>
                                                <Link
                                                    href="/forgot-password"
                                                    className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
                                                >
                                                    ¿Olvidó su contraseña?
                                                </Link>
                                            </div>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input
                                                        type={showPassword ? "text" : "password"}
                                                        placeholder="Ingrese su contraseña"
                                                        disabled={form.formState.isSubmitting}
                                                        {...field}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        disabled={form.formState.isSubmitting}
                                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                                    >
                                                        {showPassword ? (
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        ) : (
                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={form.formState.isSubmitting}
                                >
                                    {form.formState.isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Iniciando sesión…
                                        </>
                                    ) : (
                                        "Iniciar sesión"
                                    )}
                                </Button>
                            </form>
                        </Form>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    O continúe con
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="outline" disabled={form.formState.isSubmitting || isOauthLoading !== null} onClick={() => handleOAuth("github")}>
                                <GithubIcon className="mr-2 h-4 w-4" />
                                GitHub
                            </Button>
                            <Button variant="outline" disabled={form.formState.isSubmitting || isOauthLoading !== null} onClick={() => handleOAuth("google")}>
                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                    <path
                                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                        fill="currentColor"
                                    />
                                </svg>
                                Google
                            </Button>
                        </div>

                        <div className="text-center text-sm">
                            ¿No tiene una cuenta?{" "}
                            <Link
                                href={authPathWithNext("/sign-up", nextPath)}
                                className="underline underline-offset-4 hover:text-primary"
                            >
                                Crear cuenta
                            </Link>
                        </div>
                </CardContent>
            </Card>
        </div>
    );
}
