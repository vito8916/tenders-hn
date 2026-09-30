"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { SettingsRow } from "@/components/settings/settings-section";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/use-mounted";

const themes = [
	{ value: "light", label: "Claro", appliedName: "claro", icon: Sun },
	{ value: "dark", label: "Oscuro", appliedName: "oscuro", icon: Moon },
	{ value: "system", label: "Sistema", appliedName: "del sistema", icon: Monitor },
] as const;

export function AppearanceForm() {
	const { theme, setTheme } = useTheme();
	const mounted = useMounted();

	if (!mounted) return null;

	return (
		<SettingsRow
			label="Tema"
			description="Elija el esquema de colores de la interfaz."
		>
			<div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
				{themes.map((option) => {
					const isActive = theme === option.value;

					return (
						<button
							key={option.value}
							type="button"
							onClick={() => {
								setTheme(option.value);
								toast("Tema actualizado", {
									description: `Se aplicó el tema ${option.appliedName}.`,
								});
							}}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
								isActive
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							<option.icon className="size-3.5" />
							{option.label}
						</button>
					);
				})}
			</div>
		</SettingsRow>
	);
}
