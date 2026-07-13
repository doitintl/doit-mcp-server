import { type ZodTypeAny, z } from "zod";

export type JsonSchema = {
    type?: string;
    format?: string;
    enum?: unknown[];
    items?: JsonSchema;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    description?: string;
    nullable?: boolean;
    oneOf?: JsonSchema[];
    anyOf?: JsonSchema[];
    allOf?: JsonSchema[];
    additionalProperties?: boolean | JsonSchema;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
};

function isStringEnum(values: unknown[]): values is string[] {
    return values.every((value) => typeof value === "string");
}

function unionOf(schemas: JsonSchema[]): ZodTypeAny {
    const zodTypes = schemas.map(schemaToZod);
    if (zodTypes.length === 1) {
        return zodTypes[0];
    }
    return z.union(zodTypes as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]);
}

export function schemaToZod(schema: JsonSchema | undefined): ZodTypeAny {
    if (!schema) {
        return z.unknown();
    }

    let zodType: ZodTypeAny;

    const isBinaryFile = schema.type === "string" && schema.format === "binary";

    if (schema.oneOf && schema.oneOf.length > 0) {
        zodType = unionOf(schema.oneOf);
    } else if (schema.anyOf && schema.anyOf.length > 0) {
        zodType = unionOf(schema.anyOf);
    } else if (schema.allOf && schema.allOf.length > 0) {
        zodType = schema.allOf.map(schemaToZod).reduce((merged, next) => z.intersection(merged, next));
    } else if (schema.enum && isStringEnum(schema.enum) && schema.enum.length > 0) {
        zodType = z.enum(schema.enum as [string, ...string[]]);
    } else if (schema.type === "string") {
        let stringType = z.string();
        if (schema.minLength !== undefined) {
            stringType = stringType.min(schema.minLength);
        }
        if (schema.maxLength !== undefined) {
            stringType = stringType.max(schema.maxLength);
        }
        if (schema.pattern !== undefined) {
            stringType = stringType.regex(new RegExp(schema.pattern));
        }
        zodType = stringType;
    } else if (schema.type === "number" || schema.type === "integer") {
        let numberType = z.number();
        if (schema.minimum !== undefined) {
            numberType = numberType.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
            numberType = numberType.max(schema.maximum);
        }
        zodType = numberType;
    } else if (schema.type === "boolean") {
        zodType = z.boolean();
    } else if (schema.type === "array") {
        zodType = z.array(schemaToZod(schema.items));
    } else if (schema.type === "object" && schema.properties) {
        const shape: Record<string, ZodTypeAny> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            const propType = schemaToZod(propSchema);
            shape[key] = schema.required?.includes(key) ? propType : propType.optional();
        }
        const objectType = z.object(shape);
        zodType =
            schema.additionalProperties === false
                ? objectType.strict()
                : typeof schema.additionalProperties === "object"
                  ? objectType.catchall(schemaToZod(schema.additionalProperties))
                  : objectType;
    } else if (schema.type === "object") {
        zodType =
            typeof schema.additionalProperties === "object"
                ? z.record(schemaToZod(schema.additionalProperties))
                : z.record(z.unknown());
    } else {
        zodType = z.unknown();
    }

    if (isBinaryFile) {
        zodType = zodType.describe(
            schema.description
                ? `${schema.description} (base64-encoded file content)`
                : "Base64-encoded file content to upload"
        );
    } else if (schema.description) {
        zodType = zodType.describe(schema.description);
    }

    if (schema.nullable) {
        zodType = zodType.nullable();
    }

    return zodType;
}
