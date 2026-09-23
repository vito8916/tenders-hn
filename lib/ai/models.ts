// Model registry shared by the web app and the worker.
// Keep this file free of package imports: the worker's Docker image only
// installs the worker's dependencies, and it imports this file directly.

export const AI_ROLES = ["evaluate", "chat", "embed", "rerank", "vision", "extract"] as const;

export type AiRole = (typeof AI_ROLES)[number];

// AI Gateway model ids. null means the role is not enabled yet; each default is
// chosen by its evaluation set (documentation/mvp-implementation-plan.md §5).
const DEFAULT_MODELS: Record<AiRole, string | null> = {
    evaluate: "typesafe-ai/jev",
    // Provisional until the chat evaluation set picks a default (decision O5).
    chat: "anthropic/claude-sonnet-5",
    embed: null,
    rerank: null,
    vision: null,
    extract: null,
};

// Chat models the evaluation compares; any gateway model id can be added.
export const CHAT_MODEL_CANDIDATES = [
    "anthropic/claude-sonnet-5",
    "openai/gpt-6-luna",
    "deepseek/deepseek-v4.1-flash"
] as const;

/**
 * Resolves the gateway model id for a role. `AI_MODEL_<ROLE>` (e.g.
 * `AI_MODEL_CHAT`) overrides the default per environment.
 * @throws Error if the role has no model configured
 */
export function modelForRole(
    role: AiRole,
    env: Record<string, string | undefined> = process.env,
): string {
    const model = env[`AI_MODEL_${role.toUpperCase()}`]?.trim() || DEFAULT_MODELS[role];

    if (!model) {
        throw new Error(`AI role "${role}" has no model configured (set AI_MODEL_${role.toUpperCase()})`);
    }

    return model;
}
