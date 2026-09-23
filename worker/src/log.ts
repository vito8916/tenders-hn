type LogLevel = "info" | "warn" | "error";

// One JSON object per line so Railway (and any log search) can filter by field.
export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
    const line = JSON.stringify({ ...fields, time: new Date().toISOString(), level, message });

    if (level === "error") {
        console.error(line);
    } else {
        console.log(line);
    }
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
