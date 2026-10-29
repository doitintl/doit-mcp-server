import { readSkillResource } from "../skills/index.js";

/**
 * Essential CloudFlow runtime contracts stay in tool metadata for clients without Skills support.
 * The full guide lives in the authoring skill and is bundled at build time, so both the skill
 * reference and the existing guide resource serve the same bytes without runtime filesystem access.
 */

/** Compact runtime contract included in generated import/export descriptions. */
export const CLOUDFLOW_CODENODE_HINT =
    'codeNode: JavaScript (default) uses $nodes["<node name>"] and $variables; Python uses nodes and variables. ' +
    "Upstream values are lists. A top-level return produces {message: value}; no return gives JS {} / Python {message: null}. " +
    "Bare input is not injected; accessing it as upstream data fails the node. A schema (JSON Schema string) is required.";

/** A saved draft and a completed test run establish different facts. */
export const CLOUDFLOW_BUILDER_HINT =
    "Generated codeNode code can pass validation and fail silently or error at run time, so a successful build shows only that a draft was saved. " +
    "export_cloudflow_flow returns the saved code; a completed test run's per-node output shows whether it works. Test runs execute real actions, including on drafts.";

/** Retry limits shared by hand-written and generated resource-creating tools. */
export const CLOUDFLOW_RETRY_HINT =
    "The API fingerprints MCP tracking parameters; a changed client/server version can cause a same-key conflict. " +
    "Keep the original request context and key. If an HTTP failure has only generic text, do not infer a status or retry automatically.";

/**
 * @deprecated Legacy summary retained for /core consumers; no longer sent as server instructions.
 * Load the doit-cloudflow-authoring skill for the authoring workflow.
 */
export const CLOUDFLOW_INSTRUCTIONS = `CloudFlow builds and imports save drafts; publishing activates schedules. Test runs execute real
cloud actions even on drafts; dryRun validates without dispatching. Approval-gated actions still
wait for approval. The authoring loop is build or clone -> export and inspect -> dry-run import ->
validate -> test-run when authorized -> read per-node output. A real export supplies node shapes.

codeNode defaults to JavaScript: $nodes["<node name>"] contains lists of upstream results;
$variables holds globalVariables/localVariables. Python uses nodes["<node name>"] and variables.
The code body ends in a top-level return; output is {message: value}. An uncalled function or
assignment without return produces {} in JavaScript or {message: null} in Python. Bare input
is not injected; accessing it as upstream data fails the node. A schema (JSON Schema string) is required.

Validation/import establish structure, not correct behavior. A completed test run's per-node
output shows behavior; input is recorded only for action nodes. Build returns flowId and
conversationId; refine normally returns answer/conversationId and may save nothing.`;

/** The full guide, served as an MCP resource for depth on request. */
const guide = readSkillResource("skill://doit-cloudflow-authoring/references/authoring-guide.md").contents[0];
if (!("text" in guide)) throw new Error("CloudFlow authoring guide must be text");
export const CLOUDFLOW_AUTHORING_GUIDE = guide.text;
