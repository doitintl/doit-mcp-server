import { aws_global_resource_id, gcp_global_resource_id } from "./filterFields.js";

// Argument for a prompt when using the GetPromptRequestSchema
export type PromptArgument = {
    name: string;
    description: string;
    required?: boolean;
};

export type PromptRole = "user" | "assistant";

export type Prompt = {
    name: string;
    description: string;
    text: string;
    role?: PromptRole;
    arguments?: PromptArgument[];
};

export const prompts: Prompt[] = [
    {
        name: "Filter Fields Reference",
        description: "Filter fields explanation for GCP and AWS resources",
        text: `Filter fields explanation: ${gcp_global_resource_id}\n\n ${aws_global_resource_id}\n\n`,
    },
    {
        name: "Generate Report Document",
        description: "Generate a document with report results table",
        text: `Create a document (Artifacts) with a table to display the report results. include insights and recommendations if possible. (Do not generate code, only a document)`,
    },
    {
        name: "Query Best Practice",
        description: "Best practice reminder for running queries",
        text: `Before running a query, always check the filter fields explanation dimensions and allocations.`,
    },
    {
        name: "Document Output Reminder",
        description: "Reminder to generate documents not code",
        text: `Do not generate code, only a document.`,
    },
    {
        name: "Generate Report Command",
        description: "Template for generating cost reports",
        text: `To create a cost report, first check if you need specific dimensions with:\nlist_dimensions(filter: "type:fixed") and allocations with list_allocations(filter: "type:fixed")\n\nThen check if there is similar reports with list_reports and get_report_results. when you understand the structure Then run a query like:\nrun_query({\n  config: {\n    dataSource: "billing",\n    metric: { type: "basic", value: "cost" },\n    timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },\n    group: [{ id: "service_description", type: "fixed", limit: { metric: { type: "basic", value: "cost" }, sort: "desc", value: 10 } }]\n  }\n})`,
    },
    {
        name: "Generate Anomalies Document",
        description: "Generate a document with anomalies table",
        text: `Create a document (Artifacts) with a table to display the list of anomalies. Include the following columns: ID, Type, Status, Severity, Created At, and Description. Add insights and recommendations if available. (Do not generate code, only a document)`,
    },
    {
        name: "Dimension Usage Guidance",
        description: "Guidance for using dimensions effectively",
        text: `Use the list_dimensions tool to explore available dimensions. Select dimensions that best match your reporting needs. Combine multiple dimensions for more granular analysis, and always review the filter fields reference for optimal filtering.`,
    },
    {
        name: "Create Ticket",
        description: "Best practice for creating support tickets",
        text: `Before creating a ticket, ask the user if the ticket body is clear and if they want to add more details.`,
    },
    {
        name: "Generate Invoice Details Document",
        description: "Generate a document with invoice details table",
        text: `Create a document (Artifacts) with a table to display invoice details. Include the following columns: Invoice ID, Invoice Date, Due Date, Status, Total Amount, Balance Amount, Currency, and URL. For line items, create a separate table with columns: Description, Details, Price, Quantity, Type, and Currency. Add any relevant payment status or due date alerts. (Do not generate code, only a document)`,
    },
    {
        name: "Allocations Usage Guidance",
        description: "Guidance for using allocations effectively",
        text: `Use the list_allocations tool to explore available allocations. Select allocations that best match your reporting needs, and always review the filter fields reference for optimal filtering.`,
    },
    {
        name: "Allow Artifacts",
        description: "Allow document artifacts in the response",
        text: `Allow only document artifacts in the response.`,
    },
    {
        name: "Trigger CloudFlow flow",
        description:
            "Trigger a flow defined in CloudFlow by its flow ID, optionally passing a JSON payload as the request body if the flow requires it",
        text: `Trigger a CloudFlow by its flow ID, the user should provide the flow ID and an optional request body JSON if the flow requires it. Request the user to provide the flow ID before triggering the flow.`,
    },
];
