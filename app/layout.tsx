import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Revisamos cada proceso publicado en HonduCompras y le entregamos una lista corta de oportunidades para su empresa, con el motivo de cada coincidencia.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"),
  title: "Tenders HN · Licitaciones de Honduras para su empresa",
  description,
  openGraph: {
    title: "Tenders HN",
    description,
    siteName: "Tenders HN",
    locale: "es_HN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tenders HN",
    description,
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
      <html lang="es" suppressHydrationWarning>
      <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased w-full min-h-screen`}
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
