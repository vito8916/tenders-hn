import React, { Suspense } from "react";

import { CopyrightYear } from "@/components/shared/copyright-year";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import SupaNextLogo from "@/components/supanext-logo";

export default function Footer() {
	return (
		<footer className="w-full border-t border-border/60">
			<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-12 sm:flex-row sm:px-6">
				<div className="flex items-center gap-2.5">
					<SupaNextLogo className="h-4 w-auto opacity-60" />
					<p className="text-xs text-muted-foreground">
						©{" "}
						<Suspense fallback={null}>
							<CopyrightYear />
						</Suspense>{" "}
						SupaNext Kit
					</p>
				</div>
				<ThemeSwitcher />
			</div>
		</footer>
	);
}
