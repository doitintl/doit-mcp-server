import { ProtocolError, ProtocolErrorCode, type Server } from "@modelcontextprotocol/server";
import { z } from "zod";
import { CLOUD_CONNECT_SKILL, CLOUD_CONNECT_SKILL_FILES } from "./cloudConnectSkill.generated.js";

export { CLOUD_CONNECT_SKILL, CLOUD_CONNECT_SKILL_FILES };
export const CLOUD_CONNECT_SKILL_EXTENSION = { "io.modelcontextprotocol/skills": {} };
export const CLOUD_CONNECT_INSTRUCTIONS =
    "For DoiT Cloud Connect access setup, repair or disconnect, consult skill://doit-cloud-connect/SKILL.md or the connect_cloud prompt. Resolve fresh requirements, preserve the customer's IaC registration owner, dry-run changes and verify actual access; billing ingestion is separate.";
export const CLOUD_CONNECT_PROMPT = {
    name: "connect_cloud",
    description: "Set up, verify, repair or disconnect DoiT Cloud Connect through the customer's deployment workflow.",
    text: CLOUD_CONNECT_SKILL_FILES[CLOUD_CONNECT_SKILL.uri].text.replace(
        /\]\((references|assets)\//g,
        "](skill://doit-cloud-connect/$1/"
    ),
};
export const CLOUD_CONNECT_RESOURCES = Object.entries(CLOUD_CONNECT_SKILL_FILES).map(([uri, file]) => ({
    uri,
    name: uri === CLOUD_CONNECT_SKILL.uri ? CLOUD_CONNECT_SKILL.frontmatter.name : (uri.split("/").at(-1) ?? uri),
    description:
        uri === CLOUD_CONNECT_SKILL.uri ? CLOUD_CONNECT_SKILL.frontmatter.description : "Cloud Connect skill reference",
    mimeType: "text/markdown",
    size: file.size,
}));

export function readCloudConnectResource(uri: string) {
    const file = CLOUD_CONNECT_SKILL_FILES[uri];
    if (!file) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown Cloud Connect resource: ${uri}`);
    return {
        contents: [{ uri, mimeType: "text/markdown", text: file.text }],
        ttlMs: 300000,
        cacheScope: "public" as const,
    };
}
export function listCloudConnectSkills(cursor?: string) {
    if (cursor) throw new ProtocolError(ProtocolErrorCode.InvalidParams, "Unknown skill cursor");
    return {
        resultType: "complete" as const,
        skills: [CLOUD_CONNECT_SKILL],
        ttlMs: 300000,
        cacheScope: "public" as const,
    };
}
export function getCloudConnectSkill(uri: string) {
    if (uri !== CLOUD_CONNECT_SKILL.uri)
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown skill: ${uri}`);
    return {
        resultType: "complete" as const,
        skill: CLOUD_CONNECT_SKILL,
        ttlMs: 300000,
        cacheScope: "public" as const,
    };
}
/** Shared stdio/hosted extension handlers; the caller merges resources and capabilities. */
export function registerCloudConnectSkillHandlers(server: Server) {
    server.setRequestHandler(
        "skills/list",
        { params: z.object({ cursor: z.string().optional() }) },
        async ({ cursor }) => listCloudConnectSkills(cursor)
    );
    server.setRequestHandler("skills/get", { params: z.object({ uri: z.string() }) }, async ({ uri }) =>
        getCloudConnectSkill(uri)
    );
}
