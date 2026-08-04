"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { CheckIcon } from "lucide-react";

import dashboard from "@/public/assets/images/feature1.webp";
import signup from "@/public/assets/images/feature2.webp";
import bentoFeatures from "@/public/assets/images/feature3.webp";
import preview from "@/public/assets/images/feature4.webp";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			duration: 0.5,
			staggerChildren: 0.15,
			delayChildren: 0.1,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const imageVariants = {
	hidden: { opacity: 0, scale: 0.96, y: 16 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const listVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.3 },
	},
};

const listItemVariants = {
	hidden: { opacity: 0, x: -12 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const features = [
	"One dashboard for every project in your organization",
	"Members with roles: owner, admin, member, and viewer",
	"Email invitations that get your whole team in, fast",
	"Project status at a glance: active, completed, archived",
	"Activity log so nothing gets lost as your team grows",
];

export default function Features1() {
	return (
		<section
			className="w-full border-b border-border/60 py-20 sm:py-28"
			id="features"
		>
			<motion.div
				className="mx-auto max-w-6xl px-4 sm:px-6"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.2 }}
			>
				<div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-20">
					<div className="flex flex-col">
						<motion.p
							variants={itemVariants}
							className="mb-4 font-mono text-xs uppercase tracking-widest text-accent-blue"
						>
							Platform
						</motion.p>

						<motion.h2
							variants={itemVariants}
							className="mb-6 text-3xl font-semibold tracking-tighter sm:text-4xl lg:text-5xl"
						>
							Your projects, your team,
							<br />
							one source of truth
						</motion.h2>

						<motion.p
							variants={itemVariants}
							className="mb-10 max-w-lg text-muted-foreground leading-relaxed"
						>
							A shared view of projects, progress, and organization settings
							— so everyone stays aligned without spreadsheets or scattered
							tools.
						</motion.p>

						<motion.ul
							variants={listVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, amount: 0.2 }}
							className="space-y-4"
						>
							{features.map((feature, i) => (
								<motion.li
									key={i}
									variants={listItemVariants}
									className="flex items-start gap-3"
								>
									<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
										<CheckIcon className="size-3 text-foreground" />
									</span>
									<span className="text-sm text-muted-foreground sm:text-base">
										{feature}
									</span>
								</motion.li>
							))}
						</motion.ul>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:gap-4">
						<div className="flex flex-col gap-3 sm:gap-4">
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0.2 }}
								className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
							>
								<Image
									src={dashboard.src}
									width={500}
									height={400}
									alt="Dashboard interface"
									className="h-auto w-full object-cover"
								/>
							</motion.div>
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0.2 }}
								className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
							>
								<Image
									src={signup.src}
									width={500}
									height={400}
									alt="Sign up interface"
									className="h-auto w-full object-cover"
								/>
							</motion.div>
						</div>

						<div className="flex flex-col gap-3 sm:gap-4 lg:mt-12">
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0.2 }}
								className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
							>
								<Image
									src={bentoFeatures.src}
									width={500}
									height={400}
									alt="Features overview"
									className="h-auto w-full object-cover"
								/>
							</motion.div>
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0.2 }}
								className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-xs"
							>
								<Image
									src={preview.src}
									width={500}
									height={400}
									alt="App preview"
									className="h-auto w-full object-cover"
								/>
							</motion.div>
						</div>
					</div>
				</div>
			</motion.div>
		</section>
	);
}
