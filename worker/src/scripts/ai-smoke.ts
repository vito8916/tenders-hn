// Calls each enabled AI role once through AI Gateway and records the calls in
// ai_usage_events. Usage: pnpm --filter worker ai:smoke [--all-chat]
import { experimental_evaluate as evaluate, generateText } from "ai";
import { Pool } from "pg";
import { CHAT_MODEL_CANDIDATES, modelForRole, type AiRole } from "@/lib/ai/models";
import { env } from "../env";
import { errorMessage } from "../log";

if (!env.AI_GATEWAY_API_KEY) {
    console.error("AI_GATEWAY_API_KEY is not set. Add it to worker/.env.local.");
    process.exit(1);
}

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 1 });

interface SmokeResult {
    role: AiRole;
    model: string;
    status: "succeeded" | "failed";
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    output: string;
}

async function check(
    role: AiRole,
    requestedModel: string,
    call: () => Promise<{ model: string; inputTokens?: number; outputTokens?: number; output: string }>,
): Promise<SmokeResult> {
    const startedAt = performance.now();
    let result: SmokeResult;

    try {
        const response = await call();
        result = { role, status: "succeeded", latencyMs: Math.round(performance.now() - startedAt), ...response };
    } catch (error) {
        result = {
            role,
            model: requestedModel,
            status: "failed",
            latencyMs: Math.round(performance.now() - startedAt),
            output: errorMessage(error),
        };
    }

    await pool.query(
        `insert into public.ai_usage_events (role, model, input_tokens, output_tokens, latency_ms, status, error, reference)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            result.role,
            result.model,
            result.inputTokens ?? null,
            result.outputTokens ?? null,
            result.latencyMs,
            result.status,
            result.status === "failed" ? result.output : null,
            { type: "smoke_test" },
        ],
    );

    return result;
}

const evaluateModel = modelForRole("evaluate");
const results: SmokeResult[] = [
    await check("evaluate", evaluateModel, async () => {
        const { answers, usage, response } = await evaluate({
            model: evaluateModel,
            state: {
                empresa: "Vendemos soporte funcional SAP, licencias de software y desarrollo de integraciones.",
                proceso: "LPN-008-2026 IHSS: contratación de servicios de soporte funcional SAP para el año 2026.",
            },
            questions: {
                en_alcance: {
                    type: "boolean",
                    instructions: "¿El objeto del proceso corresponde a lo que vende la empresa?",
                },
                fuerza: {
                    type: "score",
                    instructions: "¿Qué tan fuerte es la coincidencia entre el proceso y la oferta de la empresa?",
                    criteria: ["ninguna", "débil", "parcial", "fuerte"],
                },
            },
        });

        return {
            model: response.modelId,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            output: `en_alcance=${answers.en_alcance.probability.toFixed(3)} fuerza=${answers.fuerza.score}`,
        };
    }),
];

const chatModels = process.argv.includes("--all-chat")
    ? [...new Set([modelForRole("chat"), ...CHAT_MODEL_CANDIDATES])]
    : [modelForRole("chat")];

for (const model of chatModels) {
    results.push(
        await check("chat", model, async () => {
            const { text, usage, response } = await generateText({
                model,
                prompt: "Responde en una sola oración: ¿qué es una licitación pública?",
                maxOutputTokens: 256,
            });

            return {
                model: response.modelId,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                output: text.trim().slice(0, 120),
            };
        }),
    );
}

await pool.end();

console.table(results);

if (results.some((result) => result.status === "failed")) {
    process.exit(1);
}
