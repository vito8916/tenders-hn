import React, { Suspense } from "react";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { CopyrightYear } from "@/components/shared/copyright-year";

export default function Footer() {
    return (
        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
            <p>
                © <Suspense fallback={null}><CopyrightYear /></Suspense>{" "}
                <span className="font-bold">Multi-Tenant SupaNext Kit</span>
            </p>
            <ThemeSwitcher />
        </footer>
    );
}
