import { Suspense } from "react";

import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences-form";
import { listNotificationPreferencesService } from "@/features/notifications/services";
import { SettingsTemplatePage } from "@/features/settings/components/settings-template-shell";
import { getCurrentUser } from "@/lib/auth/get-current-user";

async function NotificationsSettingsContent() {
	const { sub: userId } = await getCurrentUser();
	const preferences = await listNotificationPreferencesService({ userId });

	return (
		<SettingsTemplatePage
			title="Notificaciones"
			description="Elija cómo quiere enterarse de la actividad. Estas preferencias aplican a su cuenta en todas sus organizaciones."
		>
			<NotificationPreferencesForm preferences={preferences} />
		</SettingsTemplatePage>
	);
}

export default function NotificationsSettingsPage() {
	return (
		<Suspense fallback={<SettingsFormSkeleton sections={2} />}>
			<NotificationsSettingsContent />
		</Suspense>
	);
}
