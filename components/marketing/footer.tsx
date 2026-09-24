import Link from "next/link";
import { Suspense } from "react";

import { sectionLinks } from "@/components/marketing/navbar";
import { CopyrightYear } from "@/components/shared/copyright-year";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import SupaNextLogo from "@/components/supanext-logo";

const footerColumns = [
	{ title: "Producto", links: sectionLinks },
	{
		title: "Cuenta",
		links: [
			{ href: "/login", label: "Iniciar sesión" },
			{ href: "/sign-up", label: "Crear cuenta" },
		],
	},
	{
		title: "Fuente",
		links: [{ href: "http://sicc.honducompras.gob.hn/HC/Procesos/BusquedaHistorico.aspx", label: "HonduCompras" }],
	},
];

export default function Footer() {
	return (
		<footer className="w-full border-t">
			<div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
				<div className="flex flex-col items-start gap-3">
					<Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
						<SupaNextLogo className="h-4 w-auto" />
						Tenders HN
					</Link>
					<p className="max-w-64 text-sm text-pretty text-muted-foreground">
						Oportunidades de compras públicas en Honduras, priorizadas para su empresa.
					</p>
				</div>

				{footerColumns.map((column) => (
					<div key={column.title} className="flex flex-col gap-3">
						<p className="text-sm font-medium">{column.title}</p>
						<ul className="flex flex-col gap-2">
							{column.links.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
									>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>

			<div className="border-t">
				<div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
					<p>
						©{" "}
						<Suspense fallback={null}>
							<CopyrightYear />
						</Suspense>{" "}
						Tenders HN. No está afiliado a ONCAE ni a HonduCompras.
					</p>
					<ThemeSwitcher />
				</div>
			</div>
		</footer>
	);
}
