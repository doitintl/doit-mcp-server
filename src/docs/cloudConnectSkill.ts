import { readSkillResource } from "../skills/index.js";

export const CLOUD_CONNECT_SKILL_URI = "skill://doit-cloud-connect/SKILL.md";
export const CLOUD_CONNECT_INSTRUCTIONS =
    "For DoiT Cloud Connect access setup, repair or disconnect, consult skill://doit-cloud-connect/SKILL.md or the connect_cloud prompt. Resolve fresh requirements, preserve the customer's IaC registration owner, dry-run changes and verify actual access; billing ingestion is separate.";

const instructions = readSkillResource(CLOUD_CONNECT_SKILL_URI).contents[0];
if (!("text" in instructions)) throw new Error("Cloud Connect skill instructions must be text");

/** Legacy prompt bridge; discovery and file delivery belong to the shared Skills registry. */
export const CLOUD_CONNECT_PROMPT = {
    name: "connect_cloud",
    description: "Set up, verify, repair or disconnect DoiT Cloud Connect through the customer's deployment workflow.",
    text: instructions.text.replace(/\]\((references|assets)\//g, "](skill://doit-cloud-connect/$1/"),
};
