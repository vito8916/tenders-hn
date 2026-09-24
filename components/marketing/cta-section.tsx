import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

import { RelevanceBadge } from "@/components/marketing/relevance-badge";
import { Button } from "@/components/ui/button";

export default function CtaSection() {
	return (
		<section className="py-20 md:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<div className="grid overflow-hidden rounded-2xl bg-muted/50 shadow-edge md:grid-cols-2">
					<div className="flex flex-col items-start gap-4 p-8 md:p-12">
						<h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
							Su próxima oportunidad ya puede estar publicada
						</h2>
						<p className="max-w-md text-base text-pretty text-muted-foreground">
							Cree su cuenta, describa lo que vende y reciba su primera lista corta.
						</p>
						<Button
							asChild
							size="lg"
							className="mt-4 h-11 transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] has-[>svg]:ps-6 has-[>svg]:pe-5"
						>
							<Link href="/sign-up">
								Solicitar acceso
								<ArrowRight />
							</Link>
						</Button>
					</div>

					<div aria-hidden className="relative hidden items-center px-12 select-none md:flex">
						<div className="w-full rounded-lg bg-background shadow-edge">
							<div className="flex items-center gap-2 border-b px-4 py-3">
								<Mail className="size-4 text-muted-foreground" strokeWidth={1.5} />
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">Nueva oportunidad para Soporte de software</p>
									<p className="text-[11px] text-muted-foreground">Tenders HN · 7:00</p>
								</div>
							</div>
							<div className="flex flex-col gap-2 px-4 py-4">
								<RelevanceBadge relevance="high" />
								<p className="text-sm font-medium">Adquisición de soporte funcional SAP</p>
								<p className="text-xs text-muted-foreground">
									Instituto Hondureño de Seguridad Social · Cierra 10 nov 2026
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
