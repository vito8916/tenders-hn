import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/marketing/auth-button";
import { EnvVarWarning } from "@/components/marketing/env-var-warning";
import SupaNextLogo from "@/components/supanext-logo";
import { hasEnvVars } from "@/lib/utils";

export default function Navbar() {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
			<nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
				<Link
					href="/"
					className="flex items-center gap-2.5 text-sm font-medium tracking-tight transition-opacity hover:opacity-70"
				>
					<SupaNextLogo className="h-5 w-auto" />
					<span className="hidden sm:inline">SupaNext Kit</span>
				</Link>

				<div className="flex items-center gap-3 text-sm">
					<Link
						href="#features"
						className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline"
					>
						Features
					</Link>
					<Link
						href="#pricing"
						className="hidden text-muted-foreground transition-colors hover:text-foreground md:inline"
					>
						Pricing
					</Link>
					{!hasEnvVars ? (
						<EnvVarWarning />
					) : (
						<Suspense
							fallback={
								<div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
							}
						>
							<AuthButton />
						</Suspense>
					)}
				</div>
			</nav>
		</header>
	);
}
