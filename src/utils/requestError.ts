// Internal error type: only sanitized, user-facing text crosses the request boundary.
// Never attach a Response, request options, original error, or cause to this error.
export class DoitRequestError extends Error {
    constructor(
        message: string,
        readonly status?: number
    ) {
        super(message);
    }
}

// A transport failure cannot establish whether a mutation reached the API.
export function requestRecoveryGuidance(method: string): string {
    return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
        ? "Try again later."
        : "The operation may already have been applied. Check its state before retrying; do not repeat it blindly.";
}

const STATUS_REASONS: Record<number, string> = {
    400: "Bad request. Check the supplied parameters.",
    401: "Unauthorized. Check your authentication credentials.",
    403: "Forbidden. Check your permissions for this operation.",
    404: "Resource not found. Check the resource identifier.",
    409: "Conflict. Check the current resource state.",
    412: "Precondition failed. Check the current resource version.",
    422: "Validation failed. Check the supplied parameters.",
    428: "Precondition required. Check the required request parameters.",
    429: "Rate limit exceeded.",
};

type Redactions = { secrets: string[]; headerValues: string[] };

function safeMessage(value: unknown, redactions: Redactions): string {
    if (typeof value !== "string") return "";
    let text = value.trim();
    // Do not forward HTML, serialized data, stack traces, or large diagnostic blobs.
    if (text.length > 1000 || /[\r\n{}]|<(?:!|\/?[a-z])[^>]*>|\bat \S+\s*\(|\b(?:stack trace|traceback)\b/i.test(text))
        return "";
    for (const secret of redactions.secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
        text = text.split(secret).join("[redacted]").split(encodeURIComponent(secret)).join("[redacted]");
    }
    for (const header of redactions.headerValues.filter(Boolean).sort((a, b) => b.length - a.length)) {
        for (const value of new Set([header, encodeURIComponent(header)])) {
            // Non-credential header values must not erase substrings in ordinary words.
            const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            text = text.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "g"), "[redacted]");
        }
    }
    return (
        text
            .replace(/\b(?:Bearer|Basic)\s+\S+/gi, "[redacted]")
            .replace(/\b(?:authorization|(?:set-)?cookie)\s*[:=].*$/gi, "[redacted]")
            .replace(
                /\b(?:authorization|cookie|password|secret|(?:api[_-]?key)|(?:access[_-]?token)|(?:refresh[_-]?token)|token|credential|(?:client[_-]?secret))\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/gi,
                "[redacted]"
            )
            .replace(/https?:\/\/\S+/gi, "[redacted URL]")
            .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
            // biome-ignore lint/suspicious/noControlCharactersInRegex: Strip controls from untrusted API text.
            .replace(/[\u0000-\u001f\u007f]/g, " ")
    );
}

// Recognize API error envelopes, never stringify arbitrary response objects. In
// particular, request/headers/data/stack/debug and response-header values stay private.
function errorDetails(body: unknown, redactions: Redactions, depth = 0): string[] {
    if (depth > 2 || !body || typeof body !== "object" || Array.isArray(body)) return [];
    const record = body as Record<string, unknown>;
    const messages: string[] = [];
    for (const key of ["message", "error", "detail", "title", "code"]) {
        const value = record[key];
        if (key === "error" && value && typeof value === "object") {
            messages.push(...errorDetails(value, redactions, depth + 1));
        } else {
            const values = Array.isArray(value) ? value.slice(0, 5) : [value];
            messages.push(...values.map((item) => safeMessage(item, redactions)).filter(Boolean));
        }
    }
    // The API's field-validation and Problem Details shapes. Ignore all other fields.
    for (const key of ["fields", "details", "errors"]) {
        if (!Array.isArray(record[key])) continue;
        for (const entry of record[key].slice(0, 5)) {
            if (!entry || typeof entry !== "object") continue;
            const message = safeMessage(key === "errors" ? entry.message : (entry.error ?? entry.issue), redactions);
            const field = safeMessage(entry.field, redactions);
            if (message) messages.push(field ? `${field}: ${message}` : message);
        }
    }
    return [...new Set(messages)];
}

export async function createHttpError(
    response: Response,
    token: string,
    headers: Record<string, string>,
    method: string
): Promise<DoitRequestError> {
    const redactions: Redactions = { secrets: [token], headerValues: [] };
    for (const [name, value] of Object.entries(headers)) {
        // Standard media types are useful validation hints, not credential material.
        if (/^(accept|content-type)$/i.test(name)) continue;
        if (/authorization|cookie|token|secret|key|credential/i.test(name)) {
            redactions.secrets.push(value, value.replace(/^(Bearer|Basic)\s+/i, ""));
        } else {
            redactions.headerValues.push(value);
        }
    }
    const fallback =
        STATUS_REASONS[response.status] ??
        (response.status >= 500 ? "The API is temporarily unavailable." : "The API request failed.");
    let detail = "";
    // Server errors can contain internal diagnostics even in a message field.
    if (response.status < 500) {
        try {
            const text = await response.text();
            try {
                detail = errorDetails(JSON.parse(text), redactions).join("; ");
            } catch {
                detail = safeMessage(text, redactions);
            }
        } catch {
            // A failed body read must not erase the known HTTP status.
        }
    } else {
        // Release the unread diagnostic body without retaining or exposing it.
        try {
            // A tee/proxy stream may not settle cancellation until its other reader closes.
            // Releasing it must not delay delivery of the already-known HTTP error.
            void response.body?.cancel().catch(() => {});
        } catch {
            // The known HTTP status is still sufficient to report this failure.
        }
    }
    const recovery = response.status >= 500 || response.status === 429 ? ` ${requestRecoveryGuidance(method)}` : "";
    return new DoitRequestError(
        `HTTP ${response.status}: ${(detail || fallback).slice(0, 1500)}${recovery}`,
        response.status
    );
}
