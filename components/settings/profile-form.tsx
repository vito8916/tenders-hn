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
			toast.error("Failed to update profile. Please try again later.");
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
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input placeholder="Your name" {...field} />
								</FormControl>
								<FormDescription>
									This is your public display name.
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
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input
										placeholder="Your email"
										{...field}
										disabled
										readOnly
									/>
								</FormControl>
								<FormDescription>
									Your email address is used for notifications.
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
								<FormLabel>Bio</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Tell us a little bit about yourself"
										className="resize-none"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									You can <span>@mention</span> other users and organizations.
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
						Save
					</Button>
				</SettingsSectionFooter>
			</form>
		</Form>
	);
}
