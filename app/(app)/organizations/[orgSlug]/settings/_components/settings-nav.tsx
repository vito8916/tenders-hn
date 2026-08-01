"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav({ orgSlug }: { orgSlug: string }) {
    const pathname = usePathname();
    const base = `/organizations/${orgSlug}/settings`;

    const tabs = [
        { href: `${base}/account`, label: "Account" },
        { href: `${base}/organization`, label: "Organization" },
    ];

    return (
        <nav className="flex gap-1 border-b">
            {tabs.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                        "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                        pathname === tab.href
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}
