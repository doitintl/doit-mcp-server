import { TicketStatus } from "../common/types.js";
import { formatEnumValues } from "../utils/util.js";
import { aws_global_resource_id, gcp_global_resource_id } from "./filterFields.js";
import type { Prompt } from "./types.js";

const TOOL_LIST_TICKETS = "list_tickets";
const TOOL_LIST_PRODUCTS = "list_products";
const TOOL_LIST_PLATFORMS = "list_platforms";
const VALID_TICKET_STATUSES = formatEnumValues(Object.values(TicketStatus) as string[]);

const PLATFORM_PRODUCT_RESOLUTION = `If platform or product criteria are provided, first call related tool (for platform \`${TOOL_LIST_PLATFORMS}\` and for product \`${TOOL_LIST_PRODUCTS}\`) to retrieve the available values, then find the closest matching platform or product to what the user entered before applying the filter. If the provided platform or product does not match to the values returned by the tools, provide the list of valid values to the user and ask for clarification.`;
const EXPERT_INQUIRY_TERMINOLOGY_GUIDE =
    "Use the term 'expert inquiry' to refer to a ticket or 'expert inquiries' to refer to tickets in messages";

const EXPERT_INQUIRIES_PROMPT_TEXT = `List recent expert inquiries from the DoiT support API by calling the \`${TOOL_LIST_TICKETS}\` tool. First list the tickets with the specified status if provided, otherwise status that is not \`closed\`, show the list maximum of 20 tickets, or the limit argument if specified. If more specific criteria like platform or product are provided, show tickets that match the criteria first, followed by a brief summary of the rest. ${PLATFORM_PRODUCT_RESOLUTION} ${EXPERT_INQUIRY_TERMINOLOGY_GUIDE}`;
const SEARCH_EXPERT_INQUIRIES_PROMPT_TEXT = `Search expert inquiries from the DoiT support API by calling the \`${TOOL_LIST_TICKETS}\` tool with a pageSize=100 to retrieve a set of results. Search through the returned tickets, to find tickets where subject or body matches the provided keyword. If platform or product are provided, further narrow the matches to tickets related to those criteria. ${PLATFORM_PRODUCT_RESOLUTION} Present the matching expert inquiries prominently. If no match found, call the tool again page by page (using pageToken) to fetch more results until a match found or no more results. Do not retrieve more than 5 pages in a single response. If you reach this limit and still want to search further, first ask the user for explicit confirmation before continuing with additional pages. At the end, include a brief summary with statistics about the full set of tickets searched (e.g. total retrieved, how many matched, ticket status breakdown). ${EXPERT_INQUIRY_TERMINOLOGY_GUIDE}`;

/**
 * The prompts exposed by the MCP server, using snake_case names only.
 *
 * NOTE: New prompts should be added directly to this array using snake_case names,
 * e.g. { name: "my_new_prompt", description: "...", text: "..." }
 */
export const prompts: Prompt[] = [
    {
        name: "cloud_overview",
        description: "Get a high-level overview dashboard of your entire cloud infrastructure",
        messages: [
            {
                role: "user",
                text:
                    "Call get_cloud_overview to retrieve a high-level overview of my cloud infrastructure. " +
                    "Once the widget is displayed, respond with a single sentence summarising the key findings " +
                    "(e.g. total spend, top cloud, any active anomalies or incidents). " +
                    "Do NOT list individual rows or enumerate costs — the widget shows the details.",
            },
        ],
    },
    {
        name: "expert_inquiries",
        description: "List recent DoiT expert inquiries, optionally filtered locally by specified criteria",
        messages: [{ role: "user", text: EXPERT_INQUIRIES_PROMPT_TEXT }],
        arguments: [
            { name: "status", description: `Optional, status (${VALID_TICKET_STATUSES})` },
            { name: "platform", description: "Optional, related platform" },
            { name: "product", description: "Optional, related product" },
            { name: "limit", description: "Optional, number of items" },
        ],
    },
    {
        name: "search_expert_inquiries",
        description: "Search DoiT expert inquiries by keyword, optionally filtered by platform and product",
        messages: [{ role: "user", text: SEARCH_EXPERT_INQUIRIES_PROMPT_TEXT }],
        arguments: [
            { name: "keyword", description: "Keyword to search for in ticket subject and body", required: true },
            { name: "platform", description: "Optional, filter matches by related platform" },
            { name: "product", description: "Optional, filter matches by related product" },
        ],
    },
    {
        name: "filter_fields_reference",
        description: "Filter fields explanation for GCP and AWS resources",
        text: `Filter fields explanation: ${gcp_global_resource_id}\n\n ${aws_global_resource_id}\n\n`,
    },
    {
        name: "generate_report_command",
        description: "Template for generating cost reports",
        text: `To create a cost report, first check if you need specific dimensions with:\nlist_dimensions(filter: "type:fixed") and allocations with list_allocations(filter: "type:fixed")\n\nThen check if there are similar reports with list_reports and get_report_results. When you understand the structure, run a query like:\nrun_query({\n  config: {\n    dataSource: "billing",\n    metric: { type: "basic", value: "cost" },\n    timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },\n    group: [{ id: "service_description", type: "fixed", limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } }]\n  }\n})`,
    },
    {
        name: "trigger_cloudflow_flow",
        description:
            "Trigger a flow defined in CloudFlow by its flow ID, optionally passing a JSON payload as the request body if the flow requires it",
        text: "Trigger a CloudFlow by its flow ID by calling the trigger_cloud_flow tool passing the flow ID. The user should provide the flow ID and an optional request body JSON if the flow requires it. Request the user to provide the flow ID before triggering the flow if not set.",
        arguments: [
            { name: "flowID", description: "The ID of the flow to trigger" },
            {
                name: "requestBodyJson",
                description: "The request body JSON to pass to the flow",
            },
        ],
    },
];

/**
 * Alias kept for backward compatibility with consumers (e.g. the remote Worker) that still
 * import `promptsIncludingLegacyNames`. The dual human-readable/snake_case registration has
 * been removed, so this is now identical to `prompts`.
 */
export const promptsIncludingLegacyNames: Prompt[] = prompts;
