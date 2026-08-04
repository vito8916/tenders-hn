import { Suspense } from "react";

import {
	SettingsSection,
	SettingsSectionBody,
} from "@/components/settings/settings-section";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { AppearanceForm } from "@/components/settings/appearance-form";
import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { getCurrentUserWithProfile } from "@/lib/auth/get-current-user";

async function AccountSettingsContent() {
	const { profile } = await getCurrentUserWithProfile();

	return (
		<SettingsTemplatePage
			title="Account"
			description="Manage your personal profile, credentials, and appearance."
		>
			<SettingsSection
				title="Profile"
				description="How you appear to other members in this organization."
			>
				<SettingsSectionBody className="py-0">
					<ProfileForm profileInfo={profile} />
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection
				title="Password"
				description="Update the password used to sign in to your account."
			>
				<SettingsSectionBody className="py-0">
					<PasswordForm />
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection
				title="Appearance"
				description="Choose how the app looks on this device."
			>
				<SettingsSectionBody>
					<AppearanceForm />
				</SettingsSectionBody>
			</SettingsSection>
		</SettingsTemplatePage>
	);
}

export default function AccountSettingsPage() {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={3} />}>
			<AccountSettingsContent />
		</Suspense>
	);
}
