import 'server-only';
import { Resend } from "resend";
import type { ReactElement } from "react";

/**
 * Thin wrapper around Resend so features never touch the client directly.
 * Requires RESEND_API_KEY and EMAIL_FROM (see .env.example).
 */
export async function sendEmail(params: {
    to: string | string[];
    subject: string;
    react: ReactElement;
}): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
        throw new Error(
            "Email is not configured: set RESEND_API_KEY and EMAIL_FROM in your environment"
        );
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
        from,
        to: params.to,
        subject: params.subject,
        react: params.react,
    });

    if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
    }
}
