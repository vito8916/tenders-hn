"use client";

import { catchError, type ErrorInfo } from "next/error";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function OrgErrorFallback(_props: Record<string, never>, { retry }: ErrorInfo) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border bg-background">
                <AlertCircle className="size-6 text-destructive" />
            </div>
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">Algo salió mal</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                    No pudimos cargar esta sección. Intente de nuevo en unos momentos.
                </p>
            </div>
            <Button onClick={() => retry()}>Intentar de nuevo</Button>
        </div>
    );
}

export default catchError(OrgErrorFallback);
