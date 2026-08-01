import SupaNextLogo from "@/components/supanext-logo";
import { LogoutButton } from "@/components/shared/logout-button";
import { ChevronLeft } from "lucide-react";

export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="h-1 w-full bg-primary shrink-0" />
            <header className="flex items-center justify-between px-6 py-6">
                <LogoutButton
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground p-0 h-auto hover:bg-transparent font-normal gap-1"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Sign out
                </LogoutButton>
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 font-bold text-xl">
                    <SupaNextLogo className="h-8 w-8" />
                    <span>Multi-Tenant SupaNext Kit</span>
                </div>
                <div className="w-20" />
            </header>
            <main className="flex-1 w-full max-w-2xl mx-auto px-6 pb-12 flex flex-col items-center">
                {children}
            </main>
        </div>
    );
}
