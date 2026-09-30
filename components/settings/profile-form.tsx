"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { SettingsSectionFooter } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction } from "@/features/profiles/actions";
import { Profile } from "@/features/profiles/schemas";
import { profileSchema, ProfileFormValues } from "@/lib/validations/settings";

export function ProfileForm({ profileInfo }: { profileInfo: Profile }) {
	const router = useRouter();

	const form = useForm<ProfileFormValues>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			fullName: profileInfo?.fullName || "",
			email: profileInfo?.email || "",
			bio: profileInfo?.bio || "",
		},
		mode: "onChange",
	});

	async function onSubmit(values: ProfileFormValues) {
		try {
			const result = await updateProfileAction(values);

			if (result.error) {
				toast.error(result.error);
				return;
			}

			if (result.success) {
				toast.success(result.success);
			}
		} catch (error) {
			console.error("Profile update error:", error);
			toast.error("No se pudo actualizar el perfil. Intente de nuevo más tarde.");
		} finally {
			router.refresh();
		}
	}

	const { isSubmitting } = form.formState;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-5 px-6 py-6">
					<FormField
						control={form.control}
						name="fullName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Nombre</FormLabel>
								<FormControl>
									<Input placeholder="Su nombre" {...field} />
								</FormControl>
								<FormDescription>
									Así lo verán los demás miembros.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Correo electrónico</FormLabel>
								<FormControl>
									<Input
										placeholder="Su correo electrónico"
										{...field}
										disabled
										readOnly
									/>
								</FormControl>
								<FormDescription>
									Aquí le enviamos las notificaciones.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="bio"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Biografía</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Cuéntenos un poco sobre usted"
										className="resize-none"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									Máximo 500 caracteres.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<SettingsSectionFooter>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting ? (
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Guardar
					</Button>
				</SettingsSectionFooter>
			</form>
		</Form>
	);
}
