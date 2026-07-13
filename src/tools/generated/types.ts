export const HTTP_METHODS = ["get", "put", "post", "delete", "patch"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type OperationMetadata = {
    method: HttpMethod;
    pathTemplate: string;
    pathParams: string[];
    queryParams: string[];
    headerParams: string[];
    bodyEncoding: "json" | "multipart";
    multipartFileFields: string[];
};

export type GeneratedTool = {
    name: string;
    description: string;
    zodSchema: import("zod").ZodObject<import("zod").ZodRawShape>;
    metadata: OperationMetadata;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        openWorldHint: boolean;
    };
    securitySchemes: [{ type: "oauth2"; scopes: string[] }];
};
