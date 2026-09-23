// Drains the notification email outbox (public.notification_deliveries).
// Invoked every minute by pg_cron (private.dispatch_notification_emails) when
// there is due work. Sends through Resend when RESEND_API_KEY is set, otherwise
// through the local Mailpit HTTP API (MAILPIT_URL) for development.

import { createClient } from "npm:@supabase/supabase-js@2";

type Delivery = {
  id: string;
  recipient: string;
  subject: string;
  title: string;
  body: string | null;
  action_url: string | null;
  attempts: number;
};

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const appUrl = (Deno.env.get("APP_URL") ?? "http://localhost:3001").replace(/\/$/, "");
const emailFrom = Deno.env.get("EMAIL_FROM") ?? "Tenders HN <onboarding@resend.dev>";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderEmail(delivery: Delivery) {
  const actionUrl = delivery.action_url ? `${appUrl}${delivery.action_url}` : null;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:28px">${escapeHtml(delivery.title)}</h1>
      ${delivery.body ? `<p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#374151">${escapeHtml(delivery.body)}</p>` : ""}
      ${actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;padding:10px 16px;border-radius:6px">Open</a>` : ""}
      <p style="margin:32px 0 0;font-size:12px;line-height:18px;color:#6b7280">You can change which emails you receive in your notification settings.</p>
    </div>
  </body>
</html>`;

  const text = [delivery.title, delivery.body, actionUrl].filter(Boolean).join("\n\n");

  return { html, text };
}

async function sendWithResend(delivery: Delivery, apiKey: string): Promise<string> {
  const { html, text } = renderEmail(delivery);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Resend drops repeated sends with the same key, so a reclaimed row is not emailed twice.
      "Idempotency-Key": delivery.id,
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [delivery.recipient],
      subject: delivery.subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`);
  }

  const { id } = await response.json();
  return id;
}

async function sendWithMailpit(delivery: Delivery, mailpitUrl: string): Promise<string> {
  const { html, text } = renderEmail(delivery);
  const response = await fetch(`${mailpitUrl.replace(/\/$/, "")}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: emailFrom.match(/<(.+)>/)?.[1] ?? emailFrom },
      To: [{ Email: delivery.recipient }],
      Subject: delivery.subject,
      HTML: html,
      Text: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mailpit ${response.status}: ${await response.text()}`);
  }

  const { ID } = await response.json();
  return ID;
}

function send(delivery: Delivery): Promise<string> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (resendApiKey) return sendWithResend(delivery, resendApiKey);

  const mailpitUrl = Deno.env.get("MAILPIT_URL");
  if (mailpitUrl) return sendWithMailpit(delivery, mailpitUrl);

  return Promise.reject(new Error("No email provider configured (RESEND_API_KEY or MAILPIT_URL)"));
}

async function processDelivery(delivery: Delivery): Promise<boolean> {
  try {
    const providerMessageId = await send(delivery);
    await supabase
      .from("notification_deliveries")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
        last_error: null,
        locked_at: null,
      })
      .eq("id", delivery.id)
      .throwOnError();
    return true;
  } catch (error) {
    const exhausted = delivery.attempts >= MAX_ATTEMPTS;
    const backoffMinutes = 2 ** delivery.attempts;
    await supabase
      .from("notification_deliveries")
      .update({
        status: exhausted ? "failed" : "pending",
        next_attempt_at: new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
        last_error: error instanceof Error ? error.message : String(error),
        locked_at: null,
      })
      .eq("id", delivery.id)
      .throwOnError();
    return false;
  }
}

Deno.serve(async (request) => {
  const expectedSecret = Deno.env.get("EMAIL_DISPATCHER_SECRET");
  if (!expectedSecret || request.headers.get("x-dispatcher-secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await supabase.rpc("claim_notification_deliveries", {
    batch_size: BATCH_SIZE,
  });

  if (error) {
    console.error("claim_notification_deliveries failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const deliveries = (data ?? []) as Delivery[];
  const results = await Promise.all(deliveries.map(processDelivery));
  const sent = results.filter(Boolean).length;

  return Response.json({ claimed: deliveries.length, sent, failed: deliveries.length - sent });
});
