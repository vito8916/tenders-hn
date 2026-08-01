import Link from "next/link";
import { Suspense } from "react";
import { hasEnvVars } from "@/lib/utils";
import { AuthButton } from "@/components/marketing/auth-button";
import { EnvVarWarning } from "@/components/marketing/env-var-warning";

export default function Navbar() {
	return (
		<nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
			<div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
				<div className="flex gap-5 items-center font-semibold">
					<Link href={"/"}>Multi-Tenant SupaNext Kit</Link>
				</div>
				{!hasEnvVars ? (
					<EnvVarWarning />
				) : (
					<Suspense
						fallback={
							<div className="h-8 w-24 animate-pulse bg-muted rounded" />
						}
					>
						<AuthButton />
					</Suspense>
				)}
			</div>
		</nav>
	);
}
