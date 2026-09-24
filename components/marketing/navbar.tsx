import Link from "next/link";
import { Suspense } from "react";

import { AuthButton } from "@/components/marketing/auth-button";
import { EnvVarWarning } from "@/components/marketing/env-var-warning";
import SupaNextLogo from "@/components/supanext-logo";
import { hasEnvVars } from "@/lib/utils";

export const sectionLinks = [
	{ href: "/#funciones", label: "Funciones" },
	{ href: "/#como-funciona", label: "Cómo funciona" },
	{ href: "/#planes", label: "Planes" },
	{ href: "/#preguntas", label: "Preguntas" },
];

export default function Navbar() {
	return (
		<header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
			<nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
				<Link
					href="/"
					className="flex items-center gap-2.5 text-sm font-semibold tracking-tight transition-opacity duration-150 hover:opacity-70"
				>
					<SupaNextLogo className="h-5 w-auto" />
					Tenders HN
				</Link>

				<ul className="hidden items-center gap-1 text-sm md:flex">
					{sectionLinks.map((link) => (
						<li key={link.href}>
							<Link
								href={link.href}
								className="rounded-md px-3 py-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
							>
								{link.label}
							</Link>
						</li>
					))}
				</ul>

				{!hasEnvVars ? (
					<EnvVarWarning />
				) : (
					<Suspense fallback={<div className="h-8 w-40 animate-pulse rounded-md bg-muted" />}>
						<AuthButton />
					</Suspense>
				)}
			</nav>
		</header>
	);
}
