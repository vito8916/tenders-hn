"use client";
import { motion } from "framer-motion";
import {
	CreditCardIcon,
	DatabaseIcon,
	ListCheckIcon,
	RocketIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "lucide-react";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.5, staggerChildren: 0.08, delayChildren: 0.1 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const featuresList = [
	{
		icon: ShieldCheckIcon,
		title: "Roles That Match the Site",
		description:
			"Owners, admins, members, and viewers — each person sees and does exactly what their role allows, enforced down to the database.",
	},
	{
		icon: ZapIcon,
		title: "Team Invitations",
		description:
			"Invite field crews and office staff by email. They join your organization with the right role in one click.",
	},
	{
		icon: CreditCardIcon,
		title: "Project Tracking",
		description:
			"Every project with its status, visibility, and history — from active works to completed and archived ones.",
	},
	{
		icon: DatabaseIcon,
		title: "Multi-Organization",
		description:
			"Run several companies or divisions from one account. Data stays isolated per organization, always.",
	},
	{
		icon: RocketIcon,
		title: "Activity Log",
		description:
			"An audit trail of what happened and when — projects created, members joining, settings changed.",
	},
];

export default function Features() {
	return (
		<section className="border-b border-border/60 py-20 sm:py-28">
			<div className="mx-auto max-w-6xl px-4 sm:px-6">
				<motion.div
					className="grid items-start gap-px overflow-hidden rounded-lg border border-border/80 bg-border/80 md:grid-cols-2 lg:grid-cols-3"
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.1 }}
				>
					<motion.div
						variants={itemVariants}
						className="flex flex-col gap-4 bg-background p-8 lg:p-10"
					>
						<div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted">
							<ListCheckIcon className="size-5 text-foreground" />
						</div>
						<div className="space-y-3">
							<p className="font-mono text-xs uppercase tracking-widest text-accent-blue">
								Features
							</p>
							<h2 className="text-2xl font-semibold tracking-tighter lg:text-3xl">
								Built for multi-tenant SaaS teams
							</h2>
							<p className="text-sm text-muted-foreground leading-relaxed">
								Everything your organization needs to keep projects on track —
								without spreadsheets, group chats, or guesswork.
							</p>
						</div>
					</motion.div>

					{featuresList.map((feature, index) => (
						<motion.div
							key={index}
							variants={itemVariants}
							className="group flex flex-col gap-4 bg-background p-8 transition-colors hover:bg-accent/30 lg:p-10"
						>
							<div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted transition-colors group-hover:border-foreground/20">
								<feature.icon className="size-5 text-foreground" />
							</div>
							<div className="space-y-2">
								<h3 className="font-medium tracking-tight">{feature.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
}
