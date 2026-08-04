import SupaNextLogo from "@/components/supanext-logo";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { CopyrightYear } from "@/components/shared/copyright-year";
import { LogoutButton } from "@/components/shared/logout-button";
import Link from "next/link";
import { Suspense } from "react";

export default function OrganizationsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center">
            <header className="flex flex-col items-center justify-center pt-12 pb-8">
                <div className="flex items-center gap-2 font-bold text-xl">
                    <SupaNextLogo className="h-8 w-8" />
                    <span>Multi-Tenant SupaNext Kit</span>
                </div>
            </header>
            <main className="flex-1 w-full max-w-3xl px-6 flex flex-col items-center">
                {children}
            </main>
            <footer className="w-full py-8 flex items-center justify-center gap-6 text-sm text-muted-foreground mt-auto">
                <span>&copy; <Suspense fallback={null}><CopyrightYear /></Suspense> Multi-Tenant SupaNext Kit</span>
                <Link href="#" className="hover:underline hover:text-foreground transition-colors">Terms of Use</Link>
                <Link href="#" className="hover:underline hover:text-foreground transition-colors">Privacy Policy</Link>
                <div className="flex items-center gap-4 ml-2">
                    <LogoutButton variant="ghost" className="text-muted-foreground hover:text-foreground p-0 h-auto hover:bg-transparent font-normal">Sign out</LogoutButton>
                    <ThemeSwitcher />
                </div>
            </footer>
        </div>
    );
}
