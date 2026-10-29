import { CLOUD_CONNECT_SKILL_URI } from "./cloudConnectSkill.js";

export const CLOUDFLOW_GUIDE_URI = "doit://docs/cloudflow-authoring";

const CLOUDFLOW_GUIDE_POINTER = `Full CloudFlow authoring guide: MCP resource ${CLOUDFLOW_GUIDE_URI}.`;
const CLOUD_CONNECT_GUIDE_POINTER = `Full Cloud Connect workflow: MCP resource ${CLOUD_CONNECT_SKILL_URI}.`;

/**
 * Tool families whose workflow lives in a skill. A client with native Skills support discovers
 * the skill itself; any other client sees only tool metadata, so these tools name the resource.
 * Every key is asserted against the listed tools in the tests.
 */
export const SKILL_GUIDE_POINTERS: Record<string, string> = {
    build_cloud_flow: CLOUDFLOW_GUIDE_POINTER,
    refine_cloudflow: CLOUDFLOW_GUIDE_POINTER,
    export_cloudflow_flow: CLOUDFLOW_GUIDE_POINTER,
    import_cloudflow_flow: CLOUDFLOW_GUIDE_POINTER,
    test_run_cloudflow_flow: CLOUDFLOW_GUIDE_POINTER,
    get_cloud_connect_requirements: CLOUD_CONNECT_GUIDE_POINTER,
    register_cloud_connection: CLOUD_CONNECT_GUIDE_POINTER,
    update_cloud_connection: CLOUD_CONNECT_GUIDE_POINTER,
    remove_cloud_connection: CLOUD_CONNECT_GUIDE_POINTER,
    dry_run_cloud_connection_change: CLOUD_CONNECT_GUIDE_POINTER,
    verify_cloud_connect: CLOUD_CONNECT_GUIDE_POINTER,
};

/** Shared by stdio and /core consumers; pass the result of `supportsSkills` for the request. */
export function withSkillGuidePointers<T extends { name: string; description?: string }>(
    tools: readonly T[],
    skillsSupported: boolean
): T[] {
    if (skillsSupported) return [...tools];
    return tools.map((tool) => {
        const pointer = SKILL_GUIDE_POINTERS[tool.name];
        return pointer ? { ...tool, description: tool.description ? `${tool.description} ${pointer}` : pointer } : tool;
    });
}
