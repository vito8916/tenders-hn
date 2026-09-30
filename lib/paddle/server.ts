import "server-only";
import { Environment, LogLevel, Paddle } from "@paddle/paddle-node-sdk";

/** Paddle's server SDK for the environment in NEXT_PUBLIC_PADDLE_ENV (sandbox unless "production"). */
export function getPaddle() {
    if (!process.env.PADDLE_API_KEY) {
        throw new Error("PADDLE_API_KEY is not set");
    }
    return new Paddle(process.env.PADDLE_API_KEY, {
        environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? Environment.production : Environment.sandbox,
        logLevel: LogLevel.error,
    });
}
