"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
		transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const pricingData = [
	"Unlimited projects",
	"Role-based access control",
	"Email invitations",
	"Activity log & audit trail",
	"Multi-organization support",
];

const plans = [
	{
		name: "Hobby",
		monthly: "$0",
		yearly: "$0",
		description: "For independent builders managing their first projects.",
		popular: false,
	},
	{
		name: "Pro",
		monthly: "$19",
		yearly: "$180",
		description: "For crews that need shared projects, roles, and invitations.",
		popular: true,
	},
	{
		name: "Enterprise",
		monthly: "$36",
		yearly: "$390",
		description: "For firms running multiple organizations and larger teams.",
		popular: false,
	},
];

export default function Pricing() {
	const [billingCycle, setBillingCycle] = useState("monthly");

	return (
		<section
			className="w-full py-20 sm:py-28"
			id="pricing"
		>
			<motion.div
				className="mx-auto max-w-6xl px-4 sm:px-6"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.1 }}
			>
				<motion.div
					variants={itemVariants}
					className="mx-auto mb-16 max-w-2xl text-center"
				>
					<p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent-blue">
						Pricing
					</p>
					<h2 className="mb-4 text-3xl font-semibold tracking-tighter sm:text-4xl lg:text-5xl">
						Scale as you grow
					</h2>
					<p className="mb-8 text-muted-foreground">
						Start free and grow as your team does. Every plan includes projects,
						members, and the activity log.
					</p>

					<Tabs
						value={billingCycle}
						onValueChange={setBillingCycle}
						className="inline-flex"
					>
						<TabsList className="h-9 rounded-full border border-border bg-muted p-1">
							<TabsTrigger
								value="monthly"
								className="rounded-full px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs"
							>
								Monthly
							</TabsTrigger>
							<TabsTrigger
								value="yearly"
								className="rounded-full px-4 text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs"
							>
								Yearly
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</motion.div>

				<div className="grid grid-cols-1 items-stretch gap-px overflow-hidden rounded-lg border border-border/80 bg-border/80 md:grid-cols-3">
					{plans.map((plan) => (
						<motion.div
							key={plan.name}
							variants={itemVariants}
							className={cn(
								"flex flex-col bg-background p-8 lg:p-10",
								plan.popular && "relative md:-my-px md:border-x md:border-foreground/10"
							)}
						>
							{plan.popular && (
								<span className="mb-4 inline-flex w-fit items-center rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
									Most popular
								</span>
							)}

							<div className="mb-6">
								<h3 className="mb-1 font-medium">{plan.name}</h3>
								<p className="text-sm text-muted-foreground">{plan.description}</p>
							</div>

							<div className="mb-8 flex items-end gap-1">
								<span className="text-4xl font-semibold tracking-tighter sm:text-5xl">
									{billingCycle === "monthly" ? plan.monthly : plan.yearly}
								</span>
								<span className="pb-1 text-sm text-muted-foreground">
									{billingCycle === "monthly" ? "/ mo" : "/ yr"}
								</span>
							</div>

							<ul className="mb-8 flex-1 space-y-3">
								{pricingData.map((text, index) => (
									<li
										key={`${text}-${index}`}
										className="flex items-center gap-3 text-sm text-muted-foreground"
									>
										<Check className="size-4 shrink-0 text-foreground" />
										{text}
									</li>
								))}
							</ul>

							<Button
								className="w-full"
								size="lg"
								variant={plan.popular ? "default" : "outline"}
								asChild
							>
								<Link href="/sign-up">Get Started</Link>
							</Button>
						</motion.div>
					))}
				</div>
			</motion.div>
		</section>
	);
}
