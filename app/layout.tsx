import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://multi-tenant-supanext-kit.dev"),
  title: "Multi-Tenant SupaNext Kit",
  description:
    "Multi-tenant SaaS starter kit built with Next.js and Supabase.",
  openGraph: {
    title: "Multi-Tenant SupaNext Kit",
    description:
      "Multi-tenant SaaS starter kit built with Next.js and Supabase.",
    images: "/assets/images/bento-features.png",
    url: "https://multi-tenant-supanext-kit.dev",
    siteName: "Multi-Tenant SupaNext Kit",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: "/assets/images/bento-features.png",
    title: "Multi-Tenant SupaNext Kit",
    description:
      "Multi-tenant SaaS starter kit built with Next.js and Supabase.",
  },
};

/**
 * Root layout applied to the entire app (public + protected routes).
 * Sets fonts, theme provider, and global toasts.
 */
export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
      <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased  w-full min-h-screen`}
      >
      <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
      >
        <Toaster position="top-right" />
        {children}
      </ThemeProvider>
      </body>
      </html>
  );
}
