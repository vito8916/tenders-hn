"use client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	ListCheckIcon,
	ShieldCheckIcon,
	CreditCardIcon,
	DatabaseIcon,
	RocketIcon,
	ZapIcon,
} from "lucide-react";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { duration: 0.5, staggerChildren: 0.1, delayChildren: 0.2 },
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
		<section className="py-16 sm:py-20 lg:py-28">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<motion.div
					className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start"
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0 }}
				>
					{/* Header — occupies 1 col at every breakpoint: no orphaned cards */}
					<motion.div variants={itemVariants} className="flex flex-col gap-6">
						<Badge className="text-xs font-medium uppercase w-fit">
							<ListCheckIcon className="h-4 w-4 mr-2" />
							Features
						</Badge>
						<div className="space-y-3">
							<h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
								Built for multi-tenant SaaS teams
							</h2>
							<p className="text-muted-foreground lg:text-lg">
								Everything your organization needs to keep projects on
								track — without spreadsheets, group chats, or guesswork.
							</p>
						</div>
					</motion.div>

					{/* Feature Cards */}
					{featuresList.map((feature, index) => (
						<motion.div key={index} variants={itemVariants}>
							<Card className="group border-border/50 transition-all hover:border-border hover:shadow-md h-full">
								<CardHeader className="space-y-4">
									<div className="grid size-12 shrink-0 place-content-center rounded-md border bg-background group-hover:border-primary/20 transition-colors">
										<feature.icon className="h-6 w-6 text-primary" />
									</div>
								</CardHeader>
								<CardContent className="space-y-3">
									<h3 className="font-semibold text-lg tracking-tight">
										{feature.title}
									</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">
										{feature.description}
									</p>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</motion.div>
			</div>
		</section>
	);
};
