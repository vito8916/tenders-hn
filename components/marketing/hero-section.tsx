import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { ProductPreview } from "@/components/marketing/product-preview";
import { GridBackground } from "@/components/shared/grid-background";
import { Button } from "@/components/ui/button";

// Institutions with processes in the 22-23 Sep 2026 HonduCompras capture.
const publishingEntities = ["IHSS", "UNAH", "SESAL", "SIT", "BCH", "ENEE", "SEDUC", "SAR"];

function enterStep(step: number) {
	return { "--enter-step": step } as CSSProperties;
}

export default function HeroSection() {
	return (
		<section className="relative overflow-hidden">
			<GridBackground />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--accent-blue)_l_c_h_/_0.12),transparent)]" />

			<div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 text-center sm:px-6 md:pt-28">
				<p
					className="animate-enter mb-6 inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-edge backdrop-blur-sm"
					style={enterStep(0)}
				>
					<span className="size-1.5 rounded-full bg-accent-blue" />
					Piloto abierto · Procesos de HonduCompras
				</p>

				<h1
					className="animate-enter max-w-4xl text-4xl font-semibold tracking-tighter text-balance sm:text-5xl md:text-6xl"
					style={enterStep(1)}
				>
					Encuentre las licitaciones que sí son para su empresa
				</h1>

				<p
					className="animate-enter mt-6 max-w-2xl text-base text-pretty text-muted-foreground md:text-lg"
					style={enterStep(2)}
				>
					Revisamos cada proceso publicado en HonduCompras, leemos sus pliegos y
					anexos, y le entregamos una lista corta de oportunidades con el motivo
					de cada coincidencia.
				</p>

				<div
					className="animate-enter mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
					style={enterStep(3)}
				>
					<Button
						asChild
						size="lg"
						className="h-11 w-full has-[>svg]:ps-6 has-[>svg]:pe-5 transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] sm:w-auto"
					>
						<Link href="/sign-up">
							Solicitar acceso
							<ArrowRight />
						</Link>
					</Button>
					<Button
						asChild
						size="lg"
						variant="ghost"
						className="h-11 w-full px-6 shadow-edge transition-[scale,background-color] duration-150 ease-out active:scale-[0.96] sm:w-auto"
					>
						<Link href="#como-funciona">Ver cómo funciona</Link>
					</Button>
				</div>

				<div className="animate-enter mt-16 w-full md:mt-20" style={enterStep(4)}>
					<ProductPreview />
				</div>

				<div className="flex w-full flex-col items-center gap-5 border-b py-12 md:flex-row md:justify-between md:text-left">
					<p className="max-w-56 text-xs text-pretty text-muted-foreground">
						Procesos de todas las instituciones que publican en HonduCompras, como
					</p>
					<ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
						{publishingEntities.map((entity) => (
							<li
								key={entity}
								className="font-mono text-sm font-medium tracking-wider text-muted-foreground/70"
							>
								{entity}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
