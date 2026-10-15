import {
    CLIENT_CAPABILITIES_META_KEY,
    PROTOCOL_VERSION_META_KEY,
    ProtocolError,
    ProtocolErrorCode,
    type Server,
    type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { BUNDLED_SKILLS } from "./bundle.generated.js";
import { createSkillRegistry, type SkillRegistry } from "./registry.js";

export * from "./registry.js";

export const SKILL_REGISTRY = createSkillRegistry(BUNDLED_SKILLS);
const registry = SKILL_REGISTRY;
export const SKILL_RESOURCES = registry.resources;
export const listSkills = registry.listSkills;
export const getSkill = registry.getSkill;
export const readSkillResource = registry.readSkillResource;

/** Register only extension discovery; callers merge the registry's resources with their own. */
export function registerSkillHandlers(server: Server, skills: SkillRegistry = registry) {
    const assertSkillClient = (context: ServerContext) => {
        const envelope = context.mcpReq.envelope as Record<string, unknown> | undefined;
        const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as
            | { extensions?: Record<string, unknown> }
            | undefined;
        const extension = capabilities?.extensions?.["io.modelcontextprotocol/skills"];
        if (envelope?.[PROTOCOL_VERSION_META_KEY] !== "2026-07-28" || !extension || typeof extension !== "object")
            throw new ProtocolError(
                ProtocolErrorCode.MethodNotFound,
                "Skills discovery requires protocol 2026-07-28 and client Skills extension support"
            );
    };
    server.setRequestHandler(
        "skills/list",
        { params: z.object({ cursor: z.string().optional() }) },
        async ({ cursor }, context) => {
            assertSkillClient(context);
            return skills.listSkills(cursor);
        }
    );
    server.setRequestHandler("skills/get", { params: z.object({ uri: z.string() }) }, async ({ uri }, context) => {
        assertSkillClient(context);
        return skills.getSkill(uri);
    });
}
