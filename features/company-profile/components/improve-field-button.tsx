"use client";

import { useState, useTransition } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { LoaderCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { improveProfileFieldAction } from "../actions";
import { canImproveField, IMPROVEMENTS_PER_DAY, type CompanyProfileInput, type ImprovableField } from "../schemas";

export function ImproveFieldButton({
    field,
    orgId,
    initialRemaining,
    disabled,
}: {
    field: ImprovableField;
    orgId: string | null;
    initialRemaining: number;
    disabled?: boolean;
}) {
    const form = useFormContext<CompanyProfileInput>();
    const [description = "", offerings = [], exclusions = [], locations = []] = useWatch({
        control: form.control,
        name: ["description", "offerings", "exclusions", "locations"],
    });
    const [remaining, setRemaining] = useState(initialRemaining);
    const [isPending, startTransition] = useTransition();

    const setFieldValue = (value: string | string[]) => {
        const options = { shouldDirty: true, shouldValidate: true };
        if (field === "description") {
            if (typeof value === "string") form.setValue("description", value, options);
        } else if (Array.isArray(value)) {
            form.setValue(field, value, options);
        }
    };

    const improve = () =>
        startTransition(async () => {
            const previous = form.getValues(field);
            const result = await improveProfileFieldAction({
                field,
                orgId,
                profile: { description, offerings, exclusions, locations },
            });
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            setFieldValue(result.value);
            setRemaining(result.remaining);
            toast.success(
                result.remaining > 0
                    ? `Texto mejorado. Le quedan ${result.remaining} mejoras de este campo por hoy.`
                    : "Texto mejorado. Ya usó las mejoras de este campo por hoy.",
                { action: { label: "Deshacer", onClick: () => setFieldValue(previous) } },
            );
        });

    const hasSomethingToImprove = canImproveField(field, { description, offerings, exclusions });

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={improve}
            disabled={disabled || isPending || remaining === 0 || !hasSomethingToImprove}
            title={`Le quedan ${remaining} de ${IMPROVEMENTS_PER_DAY} mejoras de este campo por hoy.`}
        >
            {isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {isPending ? "Mejorando…" : "Mejorar con IA"}
            <span className="text-muted-foreground tabular-nums">
                {remaining}/{IMPROVEMENTS_PER_DAY}
            </span>
        </Button>
    );
}
