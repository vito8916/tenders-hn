import Footer from "@/components/marketing/footer";
import Navbar from "@/components/marketing/navbar";
import React from "react";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      <main className="flex flex-col gap-8 items-center min-h-screen w-full">
        {children}
      </main>
      <Footer />
    </>
  );
}
