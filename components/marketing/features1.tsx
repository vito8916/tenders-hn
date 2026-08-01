"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import dashboard from "@/public/assets/images/feature1.webp";
import signup from "@/public/assets/images/feature2.webp";
import bentoFeatures from "@/public/assets/images/feature3.webp";
import preview from "@/public/assets/images/feature4.webp";

import { CheckIcon } from "lucide-react";
import { Badge } from "../ui/badge";

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

const itemVariants = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] },
	},
};

const imageVariants = {
	hidden: { opacity: 0, scale: 0.92, y: 20 },
	visible: {
		opacity: 1,
		scale: 1,
		y: 0,
		transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] },
	},
};

const listVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.5 },
	},
};

const listItemVariants = {
	hidden: { opacity: 0, x: -20 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.6, ease: [0.6, -0.05, 0.01, 0.99] },
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
		<section className="w-full py-16 sm:py-20 lg:py-24" id="features">
			<motion.div
				className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0 }}
			>
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center">
					{/* Text Content */}
					<div className="flex flex-col">
						<motion.div variants={itemVariants}>
							<Badge variant="secondary">Stay in Control</Badge>
						</motion.div>

						<motion.h2
							variants={itemVariants}
							className="mt-6 mb-6 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight"
						>
							Your projects, your team, one source of truth
						</motion.h2>

						<motion.p
							variants={itemVariants}
							className="mb-8 text-muted-foreground leading-relaxed text-base sm:text-lg"
						>
							Multi-Tenant SupaNext Kit gives your teams a shared view of projects, progress,
							and organization settings — so everyone stays aligned
							without juggling spreadsheets and scattered tools.
						</motion.p>

						<motion.ul
							variants={listVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, amount: 0 }}
							className="space-y-3"
						>
							{features.map((feature, i) => (
								<motion.li
									key={i}
									variants={listItemVariants}
									className="flex items-start gap-3"
								>
									<span className="mt-0.5 shrink-0 size-5 rounded-full bg-primary/15 flex items-center justify-center">
										<CheckIcon className="size-3 text-primary" />
									</span>
									<span className="text-sm sm:text-base">{feature}</span>
								</motion.li>
							))}
						</motion.ul>
					</div>

					{/* Image Grid */}
					<div className="grid grid-cols-2 gap-3 sm:gap-4">
						{/* Column 1 */}
						<div className="flex flex-col gap-3 sm:gap-4">
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0 }}
								className="overflow-hidden rounded-xl border border-border shadow-md"
							>
								<Image
									src={dashboard.src}
									width={500}
									height={400}
									alt="Dashboard interface"
									className="w-full h-auto object-cover"
								/>
							</motion.div>
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0 }}
								className="overflow-hidden rounded-xl border border-border shadow-md"
							>
								<Image
									src={signup.src}
									width={500}
									height={400}
									alt="Sign up interface"
									className="w-full h-auto object-cover"
								/>
							</motion.div>
						</div>

						{/* Column 2 — vertically offset on lg+ for staggered depth effect */}
						<div className="flex flex-col gap-3 sm:gap-4 lg:mt-10 xl:mt-16">
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0 }}
								className="overflow-hidden rounded-xl border border-border shadow-md"
							>
								<Image
									src={bentoFeatures.src}
									width={500}
									height={400}
									alt="Features overview"
									className="w-full h-auto object-cover"
								/>
							</motion.div>
							<motion.div
								variants={imageVariants}
								initial="hidden"
								whileInView="visible"
								viewport={{ once: true, amount: 0 }}
								className="overflow-hidden rounded-xl border border-border shadow-md"
							>
								<Image
									src={preview.src}
									width={500}
									height={400}
									alt="App preview"
									className="w-full h-auto object-cover"
								/>
							</motion.div>
						</div>
					</div>
				</div>
			</motion.div>
		</section>
	);
}
