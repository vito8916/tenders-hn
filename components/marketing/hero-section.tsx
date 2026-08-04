"use client";
import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";

import { GridBackground } from "@/components/shared/grid-background";
import SupaNextLogo from "@/components/supanext-logo";
import { Button } from "@/components/ui/button";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			duration: 0.5,
			staggerChildren: 0.12,
			delayChildren: 0.1,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: [0.25, 0.46, 0.45, 0.94],
		},
	},
};

export default function HeroSection() {
	return (
		<section className="relative overflow-hidden border-b border-border/60">
			<GridBackground className="opacity-100" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(from_var(--accent-blue)_l_c_h_/_0.12),transparent)]" />

			<motion.div
				className="relative z-10 container mx-auto px-4 py-28 md:py-36 lg:py-44"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.3 }}
			>
				<div className="mx-auto flex max-w-4xl flex-col items-center text-center">
					<motion.div variants={itemVariants} className="mb-8">
						<SupaNextLogo className="h-8 w-auto" />
					</motion.div>

					<motion.div variants={itemVariants}>
						<p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
							<span className="size-1.5 rounded-full bg-accent-blue" />
							Multi-tenant SaaS starter kit
						</p>
					</motion.div>

					<motion.h1
						variants={itemVariants}
						className="mb-6 text-5xl font-semibold tracking-tighter md:text-7xl lg:text-8xl"
					>
						Build and ship
						<br />
						<span className="text-gradient-blue">faster than ever.</span>
					</motion.h1>

					<motion.p
						variants={itemVariants}
						className="mb-10 max-w-2xl text-base text-muted-foreground md:text-lg lg:text-xl"
					>
						Organizations, projects, roles, and invitations — everything you
						need to launch a production-ready multi-tenant app with Next.js and
						Supabase.
					</motion.p>

					<motion.div
						variants={itemVariants}
						className="flex flex-col items-center gap-3 sm:flex-row"
					>
						<Button asChild size="lg" className="h-11 px-6">
							<Link href="/login">
								Start Building
								<ArrowRight className="ml-1 size-4" />
							</Link>
						</Button>
						<Button variant="outline" size="lg" className="group h-11 px-6" asChild>
							<Link href="/sign-up">
								View Documentation
								<ExternalLink className="ml-1 size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
							</Link>
						</Button>
					</motion.div>

					<motion.div
						variants={itemVariants}
						className="mt-20 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
					>
						{["Next.js", "Supabase", "TypeScript", "Tailwind CSS"].map(
							(tech) => (
								<span
									key={tech}
									className="font-mono text-xs uppercase tracking-wider"
								>
									{tech}
								</span>
							)
						)}
					</motion.div>
				</div>
			</motion.div>
		</section>
	);
}
