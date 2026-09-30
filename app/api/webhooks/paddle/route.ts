import { getPaddle } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Paddle notifications (plan §7.5). Only a 2xx within 5 seconds counts as
 * delivered; anything else is retried with the same event id, which
 * record_paddle_event stores once. The signature is checked on the raw body
 * before anything is read from it.
 */
export async function POST(request: Request) {
    const signature = request.headers.get("paddle-signature") ?? "";
    const rawBody = await request.text();

    if (!signature || !rawBody) {
        return Response.json({ error: "Missing signature or body" }, { status: 400 });
    }

    // A bad signature, a rotated secret, and a failed write all answer 500 so
    // Paddle retries: the three are indistinguishable from here.
    try {
        await getPaddle().webhooks.unmarshal(rawBody, process.env.PADDLE_WEBHOOK_SECRET ?? "", signature);

        // The raw payload, in Paddle's snake_case, is what the database function reads.
        const { error } = await createAdminClient().rpc("record_paddle_event", { event: JSON.parse(rawBody) });
        if (error) throw error;

        return Response.json({ received: true });
    } catch (error) {
        console.error("Paddle webhook error:", error);
        return Response.json({ error: "Internal error" }, { status: 500 });
    }
}
