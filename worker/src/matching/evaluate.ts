// The only module that calls Jev (plan §5.2): experimental_evaluate may change
// in patch releases, so an API change touches this file alone.
import { createHash } from "node:crypto";
import { experimental_evaluate as evaluate } from "ai";
import type { Pool } from "pg";
import { modelForRole } from "@/lib/ai/models";
import type { ProcessDetail } from "../honducompras/parse";
import { errorMessage } from "../log";
import { buildState, type Fragment, type MatchProfile, type RetrievalMatch } from "./state";

// Bump when a question, its instructions, or its levels change: stored
// evaluations then no longer match and candidates are evaluated again.
export const QUESTIONS_VERSION = "v1";

export const QUESTIONS = {
    in_scope: {
        type: "boolean",
        instructions:
            "¿Lo que solicita el proceso corresponde a los productos o servicios que ofrece la empresa? " +
            "Cuenta aunque sea solo una parte del proceso (un lote, una línea o un componente). " +
            "Si lo solicitado es algo que la empresa indicó que no desea, no corresponde.",
        criteria: {
            true: "La empresa podría ofertar al menos una parte de lo solicitado.",
            false: "Nada de lo solicitado corresponde a lo que la empresa ofrece.",
        },
    },
    match_strength: {
        type: "score",
        instructions: "¿Qué tan fuerte es la coincidencia entre lo que solicita el proceso y la oferta de la empresa?",
        criteria: [
            "Ninguna: el proceso no pide nada de lo que la empresa ofrece.",
            "Débil: la relación es lejana o se limita a palabras en común.",
            "Parcial: una parte del proceso (lote, línea o componente) corresponde a la oferta.",
            "Fuerte: el objeto principal del proceso es lo que la empresa ofrece.",
        ],
    },
    insufficient_evidence: {
        type: "boolean",
        instructions:
            "¿La información del proceso es demasiado escasa o genérica para decidir si corresponde a la oferta de la empresa? " +
            "Por ejemplo, un objeto como «Compra Menor» sin productos descritos ni documentos.",
    },
} as const;

export interface EvaluateMatchInput {
    processId: string;
    profile: MatchProfile;
    match: RetrievalMatch;
    // Retrieval's fragments for this process, best first.
    chunkIds: number[];
}

/**
 * Evaluates one candidate with Jev and stores the result in match_evaluations.
 * An input already evaluated successfully (same model, questions, profile,
 * process data, and evidence) is not sent again.
 * @throws Error when Jev fails; the failure is recorded first so the caller can retry
 */
export async function evaluateMatch(
    pool: Pool,
    input: EvaluateMatchInput,
): Promise<{ evaluationId: string; reused: boolean } | null> {
    const model = modelForRole("evaluate");

    const { rows: processRows } = await pool.query<{
        current_version_id: string | null;
        expediente: string;
        title: string;
        buyer_entity: string;
        purchase_unit: string | null;
        modality: string | null;
        acquisition_type: string | null;
        stage: string | null;
        closes_at: Date | null;
        products: ProcessDetail["products"] | null;
        document_count: number;
    }>(
        `select p.current_version_id, p.expediente, p.title, p.buyer_entity, p.purchase_unit,
                p.modality, p.acquisition_type, p.stage, p.closes_at,
                v.detail -> 'products' as products,
                (select count(*)::int from public.source_documents d where d.process_id = p.id and d.removed_at is null) as document_count
         from public.procurement_processes p
         left join public.process_versions v on v.id = p.current_version_id
         where p.id = $1`,
        [input.processId],
    );
    const process = processRows[0];
    if (!process?.current_version_id) {
        return null;
    }

    const { rows: fragmentRows } = await pool.query<Fragment>(
        `select c.id::int as "chunkId", d.title as "documentTitle", c.page_start as "pageStart", c.page_end as "pageEnd", c.content
         from unnest($1::bigint[]) with ordinality as wanted (id, position)
         join public.document_chunks c on c.id = wanted.id
         join public.document_versions dv on dv.id = c.document_version_id
         join public.source_documents d on d.id = dv.document_id
         order by wanted.position`,
        [input.chunkIds],
    );

    const { state, evidence } = buildState({
        profile: input.profile,
        process: {
            expediente: process.expediente,
            title: process.title,
            buyerEntity: process.buyer_entity,
            purchaseUnit: process.purchase_unit,
            modality: process.modality,
            acquisitionType: process.acquisition_type,
            stage: process.stage,
            closesAt: process.closes_at?.toISOString() ?? null,
            products: process.products ?? [],
            documentCount: process.document_count,
        },
        match: input.match,
        fragments: fragmentRows,
    });
    const inputHash = createHash("sha256").update(JSON.stringify({ model, questionsVersion: QUESTIONS_VERSION, state })).digest("hex");

    const { rows: existing } = await pool.query<{ id: string }>(
        "select id from public.match_evaluations where input_hash = $1 and status = 'succeeded'",
        [inputHash],
    );
    if (existing[0]) {
        return { evaluationId: existing[0].id, reused: true };
    }

    const row = {
        inputHash,
        processId: input.processId,
        processVersionId: process.current_version_id,
        model,
        request: { state, questions: QUESTIONS },
        evidence,
    };
    const startedAt = performance.now();
    const result = await evaluate({ model, state, questions: QUESTIONS }).catch(async (error: unknown) => {
        await storeEvaluation(pool, {
            ...row,
            latencyMs: Math.round(performance.now() - startedAt),
            status: "failed",
            error: errorMessage(error),
        });
        throw error;
    });

    const evaluationId = await storeEvaluation(pool, {
        ...row,
        responseModel: result.response.modelId,
        answers: result.answers,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Math.round(performance.now() - startedAt),
        status: "succeeded",
    });
    return { evaluationId, reused: false };
}

async function storeEvaluation(
    pool: Pool,
    evaluation: {
        inputHash: string;
        processId: string;
        processVersionId: string;
        model: string;
        responseModel?: string;
        request: unknown;
        evidence: unknown;
        answers?: unknown;
        inputTokens?: number;
        outputTokens?: number;
        latencyMs: number;
        status: "succeeded" | "failed";
        error?: string;
    },
): Promise<string> {
    // The evaluation and its usage event are written together; a retry of a
    // failed input updates the same row and counts the attempt.
    const { rows } = await pool.query<{ id: string }>(
        `with evaluation as (
           insert into public.match_evaluations
             (input_hash, process_id, process_version_id, model, response_model, questions_version, request, evidence,
              answers, input_tokens, output_tokens, latency_ms, status, error)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           on conflict (input_hash) do update
           set response_model = excluded.response_model, answers = excluded.answers,
               input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
               latency_ms = excluded.latency_ms, status = excluded.status, error = excluded.error,
               attempts = match_evaluations.attempts + 1, evaluated_at = now()
           returning id
         ),
         usage as (
           insert into public.ai_usage_events (role, model, input_tokens, output_tokens, latency_ms, status, error, reference)
           select 'evaluate', coalesce($5, $4), $10, $11, $12, $13, $14, jsonb_build_object('type', 'match_evaluation', 'id', id)
           from evaluation
         )
         select id from evaluation`,
        [
            evaluation.inputHash,
            evaluation.processId,
            evaluation.processVersionId,
            evaluation.model,
            evaluation.responseModel ?? null,
            QUESTIONS_VERSION,
            evaluation.request,
            evaluation.evidence,
            evaluation.answers ?? null,
            evaluation.inputTokens ?? null,
            evaluation.outputTokens ?? null,
            evaluation.latencyMs,
            evaluation.status,
            evaluation.error ?? null,
        ],
    );
    return rows[0].id;
}
