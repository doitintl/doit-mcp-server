import { readSkillResource } from "../skills/index.js";

export const CLOUD_CONNECT_SKILL_URI = "skill://doit-cloud-connect/SKILL.md";
export const CLOUD_CONNECT_INSTRUCTIONS =
    "For DoiT Cloud Connect access setup, verification, repair or disconnect, consult skill://doit-cloud-connect/SKILL.md or the connect_cloud prompt. Identify the cloud provider and deployment method first. Use an existing target from the prompt or user selection; ask for missing target IDs before changes. Onboarding does not authorize creating cloud accounts, projects, subscriptions, tenants, organizations or management groups. AWS, Google Cloud and Azure management groups are supported. Google Cloud accepts organization, project and BigQuery dataset scopes. Azure accepts root or child management-group scopes; legacy tenant billing records are read-only. Use the registration response for the saved connection, binding and scope IDs; do not construct registration IDs. Resolve fresh requirements, preserve the customer's registration owner, preview changes and verify access; billing ingestion is separate.";

const instructions = readSkillResource(CLOUD_CONNECT_SKILL_URI).contents[0];
if (!("text" in instructions)) throw new Error("Cloud Connect skill instructions must be text");

/** Legacy prompt bridge; discovery and file delivery belong to the shared Skills registry. */
export const CLOUD_CONNECT_PROMPT = {
    name: "connect_cloud",
    description:
        "Choose the provider workflow for DoiT Cloud Connect setup, verification, repair or disconnect. AWS, Google Cloud and Azure management groups are supported.",
    text: instructions.text.replace(/\]\((references)\//g, "](skill://doit-cloud-connect/$1/"),
};
