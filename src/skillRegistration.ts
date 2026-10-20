import {
    CLIENT_CAPABILITIES_META_KEY,
    PROTOCOL_VERSION_META_KEY,
    ProtocolError,
    ProtocolErrorCode,
    type Server,
    type ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { type SkillRegistry, supportsSkills } from "./skills/index.js";

/** SDK-specific wiring belongs to this server, while discovery logic stays in core. */
export function registerSkillHandlers(server: Server, skills: SkillRegistry): void {
    const assertSkillClient = (context: ServerContext) => {
        const envelope = context.mcpReq.envelope as Record<string, unknown> | undefined;
        if (!supportsSkills(envelope?.[PROTOCOL_VERSION_META_KEY], envelope?.[CLIENT_CAPABILITIES_META_KEY]))
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
