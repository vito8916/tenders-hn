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

  // Same design as emails/organization-invitation.tsx and supabase/templates/*.html; keep them in step.
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(delivery.title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(delivery.body ?? delivery.title)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:20px 32px;border-bottom:1px solid #f4f4f5;font-family:${font};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;color:#09090b;">
                      Tenders<span style="color:#2563eb;"> HN</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px;font-family:${font};">
                      <h1 style="margin:0 0 12px;font-size:22px;line-height:30px;font-weight:600;letter-spacing:-0.01em;color:#09090b;">${escapeHtml(delivery.title)}</h1>
                      ${delivery.body ? `<p style="margin:0 0 28px;font-size:15px;line-height:24px;color:#3f3f46;">${escapeHtml(delivery.body)}</p>` : ""}
                      ${
                        actionUrl
                          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td bgcolor="#09090b" style="border-radius:8px;">
                            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 24px;font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Ver en Tenders HN</a>
                          </td>
                        </tr>
                      </table>`
                          : ""
                      }
                      <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #f4f4f5;font-size:13px;line-height:20px;color:#71717a;">Recibe este correo por sus preferencias de notificación. Puede cambiarlas en Configuración → Notificaciones.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 0 0;font-family:${font};font-size:12px;line-height:18px;color:#a1a1aa;">
                Tenders HN · Oportunidades de compras públicas en Honduras
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
