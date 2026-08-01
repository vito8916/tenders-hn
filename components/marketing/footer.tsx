import React from "react";
import { ThemeSwitcher } from "@/components/shared/theme-switcher";

export default function Footer() {
    return (
        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
            <p>
                © {new Date().getFullYear()}{" "}
                <span className="font-bold">Multi-Tenant SupaNext Kit</span>
            </p>
            <ThemeSwitcher />
        </footer>
    );
}
