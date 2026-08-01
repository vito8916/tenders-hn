"use client";
import Image from "next/image";
import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import SupaNextLogo from "@/components/supanext-logo";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			duration: 0.6,
			staggerChildren: 0.2,
			delayChildren: 0.3,
		},
	},
};
const backgroundVariants = {
	hidden: {
		opacity: 0,
		scale: 0.8,
		rotate: 0,
	},
	visible: {
		opacity: 1,
		scale: 1,
		rotate: 0,
		transition: {
			duration: 1,
			ease: [0.6, -0.05, 0.01, 0.99],
		},
	},
};

const itemVariants = {
	hidden: {
		opacity: 0,
		y: 30,
	},
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.8,
			ease: [0.6, -0.05, 0.01, 0.99],
		},
	},
};

const logoVariants = {
	hidden: {
		opacity: 0,
		scale: 0.8,
		rotate: -10,
	},
	visible: {
		opacity: 1,
		scale: 1,
		rotate: 0,
		transition: {
			duration: 1,
			ease: [0.6, -0.05, 0.01, 0.99],
		},
	},
};

const buttonVariants = {
	hidden: {
		opacity: 0,
		y: 20,
		scale: 0.9,
	},
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			duration: 0.6,
			ease: [0.6, -0.05, 0.01, 0.99],
		},
	},
};

const techStackVariants = {
	hidden: { opacity: 0, y: 40 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.8,
			staggerChildren: 0.1,
			delayChildren: 0.5,
		},
	},
};

const techItemVariants = {
	hidden: {
		opacity: 0,
		scale: 0.5,
		rotate: -15,
	},
	visible: {
		opacity: 1,
		scale: 1,
		rotate: 0,
		transition: {
			duration: 0.6,
			ease: [0.6, -0.05, 0.01, 0.99],
		},
	},
};

export default function HeroSection() {
	return (
		<section className="relative overflow-hidden py-32 px-4">
			<div className="absolute inset-x-0 top-0 flex h-full w-full items-center justify-center opacity-100">
				<motion.div variants={backgroundVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
                <Image
					priority
					alt="background"
					src="/assets/images/square-alt-grid.svg"
					width={1200}
					height={800}
					className="[mask-image:radial-gradient(75%_75%_at_center,white,transparent)] opacity-90"
				/>
                </motion.div>
			</div>
			<motion.div
				className="relative z-10 container"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.3 }}
			>
				<div className="mx-auto flex max-w-5xl flex-col items-center">
					<div className="flex flex-col items-center gap-6 text-center">
						<motion.div variants={logoVariants}>
							<SupaNextLogo />
						</motion.div>
						<motion.div variants={itemVariants}>
							<h1 className="mb-6 text-5xl font-medium tracking-tight md:text-7xl ">
								Control your SaaS <br />{" "}
								<span className="text-primary">end to end</span>
							</h1>
							<p className="mx-auto max-w-3xl text-muted-foreground lg:text-xl">
								Multi-Tenant SupaNext Kit helps teams track projects, members, and
								organization settings from one place — built for
								multi-tenant apps from day one.
							</p>
						</motion.div>
						<motion.div variants={buttonVariants} className="mt-6 flex justify-center gap-3">
							<Button asChild>
								<Link href="/login">Get Started</Link>
							</Button>
							<Button variant="outline" className="group" asChild>
								<Link href="/sign-up">
									Create account
									<ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
								</Link>
							</Button>
						</motion.div>
						<motion.div variants={itemVariants} className="mt-20 flex flex-col items-center gap-5">
							<p className="font-medium text-muted-foreground lg:text-left">
								Built with open-source technologies
							</p>
							<motion.div variants={techStackVariants} className="flex flex-wrap items-center justify-center gap-4">
								<motion.div variants={techItemVariants}>
									<Button
										variant="outline"
										size="icon"
										className="group h-12 w-12"
										asChild
									>
										<Link
											href="https://nextjs.org/"
											target="_blank"
										>
											<Image
												src="/assets/icons/brands/nextjs_icon_dark.svg"
												alt="Next.js logo"
												width={24}
												height={24}
												className="h-6 saturate-0 transition-all group-hover:saturate-100"
											/>
										</Link>
									</Button>
								</motion.div>
								<motion.div variants={techItemVariants}>
									<Button
										variant="outline"
										size="icon"
										className="group h-12 w-12"
										asChild
									>
										<Link
											href="https://www.typescriptlang.org/"
											target="_blank"
										>
											<Image
												src="/assets/icons/brands/typescript.svg"
												alt="TypeScript logo"
												width={24}
												height={24}
												className="h-6 saturate-0 transition-all group-hover:saturate-100"
											/>
										</Link>
									</Button>
								</motion.div>
								<motion.div variants={techItemVariants}>
									<Button
										variant="outline"
										size="icon"
										className="group h-12 w-12"
										asChild
									>
										<Link
											href="https://supabase.com/"
											target="_blank"
										>
											<Image
												src="/assets/icons/brands/supabase.svg"
												alt="Supabase logo"
												width={24}
												height={24}
												className="h-6 saturate-0 transition-all group-hover:saturate-100"
											/>
										</Link>
									</Button>
								</motion.div>
								<motion.div variants={techItemVariants}>
									<Button
										variant="outline"
										size="icon"
										className="group h-12 w-12"
										asChild
									>
										<Link
											href="https://ui.shadcn.com/"
											target="_blank"
										>
											<Image
												src="/assets/icons/brands/ui_light.svg"
												alt="Shadcn/ui logo"
												width={24}
												height={24}
												className="h-6 saturate-0 transition-all group-hover:saturate-100"
											/>
										</Link>
									</Button>
								</motion.div>
							</motion.div>
						</motion.div>
					</div>
				</div>
			</motion.div>
		</section>
	);
}
