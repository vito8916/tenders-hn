import React from "react";
import Link from "next/link";

import { GridBackground } from "@/components/shared/grid-background";
import SupaNextLogo from "@/components/supanext-logo";

/**
 * Minimal layout for auth pages (login, sign-up, password flows).
 * Centers content and shows the brand logo.
 */
export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
			<GridBackground className="opacity-60" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--accent-blue)_l_c_h_/_0.08),transparent)]" />

			<div className="relative z-10 flex w-full max-w-sm flex-col gap-8">
				<Link
					href="/"
					className="flex items-center justify-center gap-2 transition-opacity hover:opacity-70"
				>
					<SupaNextLogo className="h-7 w-auto" />
				</Link>
				{children}
			</div>
		</div>
	);
}
