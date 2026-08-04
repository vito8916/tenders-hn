import Footer from "@/components/marketing/footer";
import Navbar from "@/components/marketing/navbar";
import React from "react";

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
