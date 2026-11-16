// Stateless, HMAC-signed continuation tokens for results split across tool calls (resultPaging.ts).
// WebCrypto only: this also runs in filesystem-less consumers of the core export.

export const CONTINUATION_TOKEN_PREFIX = "dci1.";

export type ContinuationPosition = {
    afterId?: string;
    /** Fallback when records have no id or the id has moved. */
    afterIndex?: number;
    afterKey?: string;
};

export type ContinuationPayload = {
    v: 2;
    tool: string;
    args: Record<string, unknown>;
    upstream: string | null;
    position: ContinuationPosition;
    /** Unix seconds after which the token is refused. */
    exp: number;
    /** `hashScope` of the consumer's scope (the principal and context the token was issued for), or null. */
    scope: string | null;
};

/** What the splitter knows about a continuation; the signer adds the version, expiry and scope. */
export type ContinuationDraft = Pick<ContinuationPayload, "tool" | "args" | "upstream" | "position">;

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

/** Opaque digest of a consumer scope, so the token reveals nothing about the principal. */
export async function hashScope(scope: string): Promise<string> {
    return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(scope))));
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
    return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signContinuation(payload: ContinuationPayload, secret: string): Promise<string> {
    const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), encoder.encode(body));
    return `${CONTINUATION_TOKEN_PREFIX}${body}.${toBase64Url(new Uint8Array(signature))}`;
}

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
            payload?.v !== 2 ||
            typeof payload.tool !== "string" ||
            typeof payload.exp !== "number" ||
            (payload.scope !== null && typeof payload.scope !== "string") ||
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
