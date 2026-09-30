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
			title="Cuenta"
			description="Administre su perfil, su contraseña y la apariencia de la aplicación."
		>
			<SettingsSection
				title="Perfil"
				description="Así lo ven los demás miembros de esta organización."
			>
				<SettingsSectionBody className="py-0">
					<ProfileForm profileInfo={profile} />
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection
				title="Contraseña"
				description="Cambie la contraseña con la que inicia sesión."
			>
				<SettingsSectionBody className="py-0">
					<PasswordForm />
				</SettingsSectionBody>
			</SettingsSection>

			<SettingsSection
				title="Apariencia"
				description="Elija cómo se ve la aplicación en este dispositivo."
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
