// Continuation tokens for results split across tool calls (see resultPaging.ts).
//
// The server keeps no state between tool calls, so a token carries everything the next call
// needs: the tool, the caller's original arguments, the upstream cursor that produced the page,
// and the position reached within it. It is HMAC-signed so a caller cannot alter the arguments
// or position, and so the server can tell its own tokens from upstream cursors.
//
// WebCrypto only: this runs under Node (stdio) and in filesystem-less consumers of the core export.

export const CONTINUATION_TOKEN_PREFIX = "dci1.";

/** Where the previous result stopped within the upstream page. */
export type ContinuationPosition = {
    /** `id` / `_id` of the last returned record, when records carry one. */
    afterId?: string;
    /** Zero-based index of the last returned record; the fallback when ids are missing or moved. */
    afterIndex?: number;
    /** Key of the last returned entry, for record maps keyed by id. */
    afterKey?: string;
};

export type ContinuationPayload = {
    v: 1;
    /** The tool the token belongs to; a token is never valid for another tool. */
    tool: string;
    /** The caller's arguments for the page, without any pageToken. */
    args: Record<string, unknown>;
    /** The upstream cursor that produced the page being continued; null for the first page. */
    upstream: string | null;
    position: ContinuationPosition;
};

export function isContinuationToken(value: unknown): value is string {
    return typeof value === "string" && value.startsWith(CONTINUATION_TOKEN_PREFIX);
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | undefined {
    if (!/^[A-Za-z0-9_-]*$/.test(text)) return undefined;
    const padded = text
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(text.length / 4) * 4, "=");
    try {
        return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    } catch {
        return undefined;
    }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signContinuation(payload: ContinuationPayload, secret: string): Promise<string> {
    const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(body));
    return `${CONTINUATION_TOKEN_PREFIX}${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Returns the payload of a token this server signed, or undefined for anything else: a foreign
 * string, a tampered body, a signature made with another secret, or a malformed payload.
 */
export async function verifyContinuation(token: string, secret: string): Promise<ContinuationPayload | undefined> {
    if (!isContinuationToken(token)) return undefined;
    const [body, signature, ...rest] = token.slice(CONTINUATION_TOKEN_PREFIX.length).split(".");
    if (!body || !signature || rest.length > 0) return undefined;
    const signatureBytes = fromBase64Url(signature);
    const bodyBytes = fromBase64Url(body);
    if (!signatureBytes || !bodyBytes) return undefined;
    // subtle.verify compares in constant time.
    const valid = await crypto.subtle.verify(
        "HMAC",
        await hmacKey(secret, "verify"),
        signatureBytes as BufferSource,
        encoder.encode(body)
    );
    if (!valid) return undefined;
    try {
        const payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as ContinuationPayload;
        if (
            payload?.v !== 1 ||
            typeof payload.tool !== "string" ||
            !payload.args ||
            typeof payload.args !== "object" ||
            Array.isArray(payload.args) ||
            !payload.position ||
            typeof payload.position !== "object"
        ) {
            return undefined;
        }
        return payload;
    } catch {
        return undefined;
    }
}
