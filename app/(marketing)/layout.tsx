import Footer from "@/components/marketing/footer";
import Navbar from "@/components/marketing/navbar";
import React from "react";

export default function MarketingLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="flex min-h-screen w-full flex-col">
			<Navbar />
			<main className="flex-1">{children}</main>
			<Footer />
		</div>
	);
}
