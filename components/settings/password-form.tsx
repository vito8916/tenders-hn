"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
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
import { updatePasswordAction } from "@/features/auth/actions";
import {
	passwordFormSchema,
	type PasswordFormValues,
} from "@/lib/validations/settings";

const defaultValues: Partial<PasswordFormValues> = {
	password: "",
	confirmPassword: "",
};

export function PasswordForm() {
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<PasswordFormValues>({
		resolver: zodResolver(passwordFormSchema),
		defaultValues,
		mode: "onChange",
	});

	async function onSubmit(values: PasswordFormValues) {
		setIsLoading(true);
		try {
			const result = await updatePasswordAction(values);

			if (result.error) {
				toast.error(result.error);
				return;
			}

			if (result.data) {
				toast.success("Password updated successfully");
				form.reset(defaultValues);
			}
		} catch (error) {
			console.error("Password update error:", error);
			toast.error("Failed to update password. Please try again later.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)}>
				<div className="space-y-5 px-6 py-6">
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>New password</FormLabel>
								<FormControl>
									<Input type="password" placeholder="••••••••" {...field} />
								</FormControl>
								<FormDescription>
									At least 8 characters with uppercase, lowercase, number, and
									special character.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Confirm password</FormLabel>
								<FormControl>
									<Input type="password" placeholder="••••••••" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
				<SettingsSectionFooter>
					<Button type="submit" disabled={isLoading}>
						{isLoading ? (
							<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						Update password
					</Button>
				</SettingsSectionFooter>
			</form>
		</Form>
	);
}
