"use client";

import { useTheme } from "next-themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
    { value: "light" as const, label: "Light" },
    { value: "dark" as const, label: "Dark" },
    { value: "system" as const, label: "System" },
];

export function ThemeStep() {
    const { theme, setTheme } = useTheme();
    const currentTheme = theme || "system";

    return (
        <div className="w-full space-y-8">
            <div>
                <h2 className="text-2xl font-bold">Choose your theme</h2>
                <p className="text-muted-foreground mt-1">
                    Select the theme for the application. You&apos;ll be able to change this later.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {themes.map(({ value, label }) => {
                    const isSelected = currentTheme === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTheme(value)}
                            className={cn(
                                "flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition-colors",
                                isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-muted-foreground/50"
                            )}
                        >
                            <div
                                className={cn(
                                    "relative w-full aspect-square rounded-lg border overflow-hidden flex items-center justify-center",
                                    value === "light" && "bg-white border-border",
                                    value === "dark" && "bg-muted border-border",
                                    value === "system" &&
                                        "bg-linear-to-r from-white to-muted border-border"
                                )}
                            >
                                <span
                                    className={cn(
                                        "text-2xl font-bold",
                                        value === "light" && "text-black",
                                        value === "dark" && "text-white",
                                        value === "system" && "text-foreground"
                                    )}
                                >
                                    Aa
                                </span>
                                {isSelected && (
                                    <div className="absolute bottom-2 right-2 rounded-full bg-primary p-1">
                                        <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-medium">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
