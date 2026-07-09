import { z } from "zod";

import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../../utils/util.js";
import type { GeneratedTool } from "./types.js";

const GENERATED_REQUEST_TIMEOUT_MS = 30000;

function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * File fields carry base64-encoded content (not a local path) so the same generated tool
 * works identically on stdio and the Worker — the Worker has no access to a caller's
 * local filesystem, so "read this path" isn't a viable contract on that transport.
 */
function buildMultipartBody(bodyFields: Record<string, unknown>, fileFields: string[]): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(bodyFields)) {
        if (fileFields.includes(key)) {
            // Uint8Array's `buffer` is typed as the broader ArrayBufferLike (which also
            // covers SharedArrayBuffer); base64ToBytes always allocates a plain
            // (non-shared) one. Cast to ArrayBuffer rather than BlobPart — this file is
            // type-checked under both the DOM lib (stdio) and the Workers lib, and only
            // ArrayBuffer is a recognized global in both.
            formData.append(key, new Blob([base64ToBytes(String(value)).buffer as ArrayBuffer]), key);
        } else {
            formData.append(key, String(value));
        }
    }
    return formData;
}

export async function handleGeneratedOperationRequest(tool: GeneratedTool, args: any, token: string) {
    try {
        const parsed = tool.zodSchema.parse(args ?? {}) as Record<string, unknown>;
        const customerContext = (args?.customerContext as string | undefined) || process.env.CUSTOMER_CONTEXT;
        const { metadata } = tool;

        let requestPath = metadata.pathTemplate;
        for (const paramName of metadata.pathParams) {
            requestPath = requestPath.replace(`{${paramName}}`, encodeURIComponent(String(parsed[paramName])));
        }

        const queryParams = new URLSearchParams();
        for (const paramName of metadata.queryParams) {
            if (parsed[paramName] !== undefined) {
                queryParams.set(paramName, String(parsed[paramName]));
            }
        }
        if (customerContext) {
            queryParams.set("customerContext", customerContext);
        }
        const queryString = queryParams.toString();
        const url = `${DOIT_API_BASE}${requestPath}${queryString ? `?${queryString}` : ""}`;

        const headers: Record<string, string> = {};
        for (const paramName of metadata.headerParams) {
            if (parsed[paramName] !== undefined) {
                headers[paramName] = String(parsed[paramName]);
            }
        }

        const bodyFields = Object.fromEntries(
            Object.entries(parsed).filter(
                ([key]) =>
                    !metadata.pathParams.includes(key) &&
                    !metadata.queryParams.includes(key) &&
                    !metadata.headerParams.includes(key)
            )
        );
        const hasBody = Object.keys(bodyFields).length > 0;
        const body = !hasBody
            ? undefined
            : metadata.bodyEncoding === "multipart"
              ? buildMultipartBody(bodyFields, metadata.multipartFileFields)
              : bodyFields;

        const data = await makeDoitRequest<string>(url, token, {
            method: metadata.method.toUpperCase(),
            body,
            appendParams: false,
            parseAs: "text",
            timeoutMs: GENERATED_REQUEST_TIMEOUT_MS,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
        });

        if (data === null) {
            return createErrorResponse(`Failed to call ${metadata.method.toUpperCase()} ${metadata.pathTemplate}`);
        }
        return createSuccessResponse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, `calling generated tool ${tool.name}`);
    }
}
