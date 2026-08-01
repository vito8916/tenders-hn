"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const pricingData = [
	"Seamless integration",
	"Real-time data visualization",
	"Advanced predictive analytics",
	"Collaborative environment",
	"Responsive customer support",
];

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			duration: 0.5,
			staggerChildren: 0.15,
			delayChildren: 0.2,
		},
	},
};

const headerVariants = {
	hidden: { opacity: 0, y: 25 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const cardVariants = {
	hidden: { opacity: 0, y: 30 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const pricingVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 },
	},
};

const featuresVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.08, delayChildren: 0.3 },
	},
};

const featureItemVariants = {
	hidden: { opacity: 0, x: -15 },
	visible: {
		opacity: 1,
		x: 0,
		transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
	},
};

const buttonVariants = {
	hidden: { opacity: 0, y: 15 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 },
	},
};

const badgeVariants = {
	hidden: { opacity: 0, scale: 0.8 },
	visible: {
		opacity: 1,
		scale: 1,
		transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 },
	},
};

const plans = [
	{
		name: "Solo",
		monthly: "$0",
		yearly: "$0",
		description: "For independent builders managing their first projects.",
		popular: false,
	},
	{
		name: "Team",
		monthly: "$19",
		yearly: "$180",
		description: "For crews that need shared projects, roles, and invitations.",
		popular: true,
	},
	{
		name: "Company",
		monthly: "$36",
		yearly: "$390",
		description: "For firms running multiple organizations and larger teams.",
		popular: false,
	},
];

export default function Pricing() {
	const [billingCycle, setBillingCycle] = useState("monthly");

	const handleOnClick = (plan: string) => {
		toast.success(`Get started clicked for ${plan}`, {
			description: `You've selected the ${billingCycle} ${plan} plan`,
		});
	};

	return (
		<section className="w-full py-12 sm:py-16 lg:py-20 bg-background">
			<motion.div
				className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0 }}
			>
				{/* Header */}
				<motion.div
					variants={headerVariants}
					className="max-w-2xl mx-auto text-center mb-12 sm:mb-16"
				>
					<Badge variant="secondary">Find Your Perfect Fit</Badge>

					<motion.h2
						variants={headerVariants}
						className="mt-6 mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight"
					>
						Choose your best plan
					</motion.h2>

					<motion.p
						variants={headerVariants}
						className="mb-8 text-muted-foreground text-base sm:text-lg"
					>
						Start free and grow as your team does. Every plan includes
						projects, members, and the activity log.
					</motion.p>

					<motion.div variants={headerVariants}>
						<Tabs
							value={billingCycle}
							onValueChange={setBillingCycle}
							className="w-full"
						>
							<TabsList className="grid w-full max-w-xs grid-cols-2 mx-auto">
								<TabsTrigger
									className="data-[state=active]:bg-primary dark:data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground text-foreground"
									value="monthly"
								>
									Monthly
								</TabsTrigger>
								<TabsTrigger
									className="data-[state=active]:bg-primary dark:data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:text-primary-foreground text-foreground"
									value="yearly"
								>
									Yearly
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</motion.div>
				</motion.div>

				{/* Cards */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
					{plans.map((plan) => (
						<motion.div
							key={plan.name}
							variants={cardVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, amount: 0 }}
							className={cn(
								"h-full",
								plan.popular && "md:-mt-4 md:mb-4"
							)}
						>
							<Card
								className={cn(
									"h-full flex flex-col px-4 transition-shadow duration-300 hover:shadow-lg",
									plan.popular &&
										"ring-2 ring-primary shadow-md"
								)}
							>
								<CardHeader>
									<div className="flex items-center justify-between">
										<CardTitle>{plan.name}</CardTitle>
										{plan.popular && (
											<motion.div variants={badgeVariants}>
												<Badge className="bg-primary text-primary-foreground border-primary/20">
													Most Popular
												</Badge>
											</motion.div>
										)}
									</div>
									<CardDescription>
										<motion.div
											variants={pricingVariants}
											className="flex items-end gap-1 mt-4 mb-2"
										>
											<span className="text-4xl sm:text-5xl font-bold text-foreground">
												{billingCycle === "monthly"
													? plan.monthly
													: plan.yearly}
											</span>
											<span className="text-muted-foreground pb-1">
												{billingCycle === "monthly" ? "/ month" : "/ year"}
											</span>
										</motion.div>
										{plan.description}
									</CardDescription>
								</CardHeader>

								<CardContent className="flex flex-col flex-1">
									<motion.ul
										variants={featuresVariants}
										className="space-y-3 flex-1"
									>
										{pricingData.map((text, index) => (
											<motion.li
												variants={featureItemVariants}
												className="flex items-center gap-3"
												key={`${text}-${index}`}
											>
												<Check className="h-4 w-4 text-green-500 shrink-0" />
												<span className="text-foreground text-sm sm:text-base">
													{text}
												</span>
											</motion.li>
										))}
									</motion.ul>

									<motion.div variants={buttonVariants} className="mt-8">
										<Button
											className="w-full"
											size="lg"
											variant={plan.popular ? "default" : "outline"}
											onClick={() => handleOnClick(plan.name)}
										>
											Get Started
										</Button>
									</motion.div>
								</CardContent>
							</Card>
						</motion.div>
					))}
				</div>
			</motion.div>
		</section>
	);
}
