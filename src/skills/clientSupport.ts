/** Pure capability check; each transport supplies its client's negotiated metadata. */
export function supportsSkills(protocolVersion: unknown, capabilities: unknown): boolean {
    if (protocolVersion !== "2026-07-28" || !capabilities || typeof capabilities !== "object") return false;
    const extensions = (capabilities as { extensions?: Record<string, unknown> }).extensions;
    const skills = extensions?.["io.modelcontextprotocol/skills"];
    return skills !== null && typeof skills === "object" && !Array.isArray(skills);
}
