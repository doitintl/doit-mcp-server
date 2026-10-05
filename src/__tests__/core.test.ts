import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BEHAVIORAL_TEXT, schemaDescriptions } from "./behavioralText.js";

describe("core package API", () => {
    it("exposes transport-independent MCP building blocks", async () => {
        const coreModulePath = "../core.js";

        await expect(import(/* @vite-ignore */ coreModulePath)).resolves.toMatchObject({
            cloudOverviewTool: expect.objectContaining({ name: "get_cloud_overview" }),
            CloudOverviewArgumentsSchema: expect.any(Object),
            generateTools: expect.any(Function),
            COVERED_ENDPOINTS: expect.any(Set),
            executeToolHandler: expect.any(Function),
            handleChangeCustomerRequest: expect.any(Function),
            handleValidateUserRequest: expect.any(Function),
            parseValidatedUserResponse: expect.any(Function),
            prompts: expect.any(Array),
            promptsIncludingLegacyNames: expect.any(Array),
            resolvePromptMessages: expect.any(Function),
            configureDoiTApiBase: expect.any(Function),
            runWithConsoleEnv: expect.any(Function),
            runWithTracking: expect.any(Function),
            CLOUDFLOW_CODENODE_HINT: expect.any(String),
            CLOUDFLOW_BUILDER_HINT: expect.any(String),
            CLOUDFLOW_INSTRUCTIONS: expect.any(String),
            CLOUDFLOW_AUTHORING_GUIDE: expect.stringContaining("# CloudFlow authoring over MCP"),
            SERVER_INSTRUCTIONS: expect.any(String),
            SERVER_NAME_WEB: "Doit",
            SERVER_VERSION: expect.any(String),
            DEMO_TOKEN: "demo_key",
            generatedToolsOpenApiSpec: expect.objectContaining({
                openapi: expect.stringMatching(/^3\./),
            }),
        });
    });

    // The remote Worker registers tools with these Zod schemas, so their `.describe()` text is what
    // hosted clients see — a second copy beside each tool's raw `inputSchema`. Keep both clean.
    it("exported argument schemas carry no model-behavior instructions", async () => {
        const core: Record<string, unknown> = await import("../core.js");
        const schemas = Object.entries(core).filter(
            (entry): entry is [string, z.ZodType] => entry[1] instanceof z.ZodType
        );
        expect(schemas.length).toBeGreaterThan(50);
        for (const [name, schema] of schemas) {
            const jsonSchema = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
            for (const [path, text] of schemaDescriptions(jsonSchema, name)) {
                expect(text, path).not.toMatch(BEHAVIORAL_TEXT);
            }
        }
    });
});
