import { Suspense } from "react";
import type { ReactNode } from "react";

import { SettingsFormSkeleton } from "@/components/shared/settings-form-skeleton";

function SettingsLayoutSkeleton({ children }: { children: ReactNode }) {
	return (
		<div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
			<div className="mx-auto max-w-2xl">{children}</div>
		</div>
	);
}

async function SettingsLayoutContent({ children }: { children: ReactNode }) {
	return (
		<div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
			<div className="mx-auto max-w-2xl space-y-6">{children}</div>
		</div>
	);
}

export default function SettingsLayout({
	children,
}: {
	children: ReactNode;
	params: Promise<{ orgSlug: string }>;
}) {
	return (
		<Suspense
			fallback={
				<SettingsLayoutSkeleton>
					<SettingsFormSkeleton sections={2} />
				</SettingsLayoutSkeleton>
			}
		>
			<SettingsLayoutContent>{children}</SettingsLayoutContent>
		</Suspense>
	);
}
