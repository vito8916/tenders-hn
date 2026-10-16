"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { CheckoutEventNames, initializePaddle, type Environments, type Paddle } from "@paddle/paddle-js";
import { toast } from "sonner";

/**
 * Paddle.js, loaded once per page. The caller decides what happens after checkout.completed (the plan arrives later,
 * by webhook) and, optionally, when the checkout is closed without paying.
 */
export function usePaddle(onCheckoutCompleted: () => void, onCheckoutAbandoned?: () => void) {
    const [paddle, setPaddle] = useState<Paddle | null>(null);
    const handleCheckoutCompleted = useEffectEvent(onCheckoutCompleted);
    const handleCheckoutAbandoned = useEffectEvent(() => onCheckoutAbandoned?.());

    useEffect(() => {
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
        if (!token) return;
        let instance: Paddle | undefined;
        let completed = false;
        initializePaddle({
            token,
            environment: (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as Environments,
            checkout: { settings: { locale: "es", variant: "one-page", showAddDiscounts: true, allowLogout: false } },
            eventCallback: (event) => {
                if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
                    // Paddle's success screen would cover the page, which shows the plan being activated instead.
                    completed = true;
                    instance?.Checkout.close();
                    handleCheckoutCompleted();
                } else if (event.name === CheckoutEventNames.CHECKOUT_CLOSED && !completed) {
                    handleCheckoutAbandoned();
                } else if (event.name === CheckoutEventNames.CHECKOUT_ERROR) {
                    toast.error("No se pudo abrir el pago. Intente de nuevo en unos minutos.");
                }
            },
        }).then((initialized) => {
            instance = initialized;
            if (initialized) setPaddle(initialized);
        });
    }, []);

    return paddle;
}
