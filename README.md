# DoiT MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) ![NPM Version](https://img.shields.io/npm/v/%40doitintl%2Fdoit-mcp-server?registry_uri=https%3A%2F%2Fregistry.npmjs.com%2F%40doitintl%2Fdoit-mcp-server)

DoiT MCP Server provides access to the DoiT API. This server enables LLMs like Claude to access DoiT platform data for troubleshooting and analysis.

![top-services](https://github.com/user-attachments/assets/749dd237-3021-439d-b447-64605393389d)

## Requirements

- Node.js v18 or higher
- DoiT API key with appropriate permissions

## Installation

To get your DoiT API key, visit the [API key section in your DoiT profile](https://help.doit.com/docs/general/profile#api-key).

There are several ways to install and configure the MCP server:

### DoiT MCP URL

The DoiT MCP server is available at: https://mcp.doit.com/sse

### Claude Desktop App

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.doit.com/sse"]
    }
  }
}
```

### AWS Q CLI

1. Create an API key in the [API section](https://app.doit.com/profile/api) of the DoiT Console.
2. Note the API key value for the below command.
3. Run the following command:

```bash
q mcp-server create --name doit-mcp-server --url https://mcp.doit.com/sse --api-key your_doit_api_key
```

4. Start q chat by running this command:

```bash
q chat
```

5. Ensure that it connects and lists it as doit-mcp-server loaded at the top of the chat session.

## STDIO - local server

### Claude Desktop App

To manually configure the MCP server for Claude Desktop App, add the following to your `claude_desktop_config.json` file or through "Settings" as described [here](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server):

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["-y", "@doitintl/doit-mcp-server@latest"],
      "env": {
        "DOIT_API_KEY": "your_doit_api_key"
      }
    }
  }
}
```

Make sure to replace the environment variables with your actual values:

- `DOIT_API_KEY`: Your DoiT API key with appropriate permissions
- `CUSTOMER_CONTEXT`: Your customer context identifier (optional) - Required for Do’ers

NOTE: you need to [restart Claude for Desktop](https://modelcontextprotocol.io/quickstart/user#3-restart-claude) after updating the configuration for changes to take effect.

### Cursor

Don't forget to replace the `env` values in that command with your actual values.

If you have the latest version (v0.47 and above) of Cursor, you can create an `mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "doit_mcp_server": {
      "command": "npx",
      "args": ["-y", "@doitintl/doit-mcp-server@latest"],
      "env": {
        "DOIT_API_KEY": "your_doit_api_key"
      }
    }
  }
}
```

### Clone to Local Repository

If you want to clone and run this MCP server directly from the source code, follow these steps:

1. **Clone the repository**

```bash
git clone https://github.com/doitintl/doit-mcp-server
cd doit-mcp-server
```

2. **Install dependencies**

```bash
yarn install
```

3. **Build the project**

```bash
yarn build
```

4. **Run the server**

```bash
node dist/index.js
```

## Tools

This MCP server provides many tools including the following:

- [`get_cloud_incidents`](https://developer.doit.com/reference/listknownissues): Retrieve cloud incidents from various platforms
- [`get_cloud_incident`](https://developer.doit.com/reference/getknownissue): Get details about a specific cloud incident by ID
- [`get_anomalies`](https://developer.doit.com/reference/listanomalies): Retrieve anomalies detected in cloud resources
- [`get_anomaly`](https://developer.doit.com/reference/getanomaly): Get details about a specific anomaly by ID
- [`list_assets`](https://developer.doit.com/reference/listassets): Returns a list of all available customer assets such as Google Cloud billing accounts, G Suite/Workspace subscriptions, etc.
- [`get_asset`](https://developer.doit.com/reference/getasset): Returns details of a specific customer asset by ID, including properties such as customer domain, subscription, and reseller information
- [`trigger_cloud_flow`](https://developer.doit.com/reference/triggercloudflow): Triggers a CloudFlow by its flow ID, optionally passing a JSON payload as the request body
- [`list_cloudflow_connections`](https://developer.doit.com/reference/listcloudflowconnections): Returns a cursor-paginated list of CloudFlow cloud provider connections (GCP/AWS), with their config and status; supports `maxResults` (1–100, default 50) and `pageToken`
- [`get_cloudflow_connection`](https://developer.doit.com/reference/getcloudflowconnection): Returns the details of a specific CloudFlow connection by `connectionId`, including its GCP/AWS configuration, collaborators, and status
- [`create_cloudflow_connection`](https://developer.doit.com/reference/createcloudflowconnection): Creates a new CloudFlow cloud provider connection; requires a `name` and exactly one of `gcpConfig` or `awsConfig`, with optional `description`, `collaborators`, and `enabled`
- [`update_cloudflow_connection`](https://developer.doit.com/reference/updatecloudflowconnection): Updates an existing CloudFlow connection by `connectionId` — rename, re-describe, enable/disable, change collaborators, or update its GCP/AWS configuration (at most one of `gcpConfig` or `awsConfig` per request)
- [`list_cloudflow_templates`](https://developer.doit.com/reference/listcloudflowtemplates): Returns a cursor-paginated catalogue of available CloudFlow templates (read-only blueprints), with their id, name, description, and instructions; supports `maxResults` (1–500, default 50) and `pageToken`
- [`get_cloudflow_template`](https://developer.doit.com/reference/getcloudflowtemplate): Returns the details of a specific CloudFlow template by `templateId`, including its name, description, and configuration instructions
- [`find_cloud_diagrams`](https://developer.doit.com/reference/findclouddiagrams): Returns diagram URLs matching the provided resource IDs from the DoiT Cloud Diagrams API
- [`get_cloud_diagrams_stats`](https://developer.doit.com/reference/getclouddiagramsstats): Returns activity statistics for your cloud diagrams over a time period (`start`/`end` RFC3339 date-times) — node create/update/delete change counts grouped by cloud service, plus each diagram's import/sync state
- [`search_cloud_diagrams`](https://developer.doit.com/reference/searchclouddiagrams): Searches your cloud diagrams and components by name or property, returning matching layers (`scheme`), components, and property-matched components (`prop`); optionally scope to a layer with `ss_id` and page with `from`/`size`
- [`get_cloud_diagram_cost_snapshot`](https://developer.doit.com/reference/getclouddiagramcostsnapshot): Returns a bounded cost snapshot for a cloud diagram layer (`layerId`) over a `startDate`/`endDate` (YYYY-MM-DD) — total spend, period-over-period trend percentage, top resources and services by cost, and a cost trend (optionally bucketed by `interval`: day/week/month)
- [`get_cloud_diagram_resource_relationships`](https://developer.doit.com/reference/getclouddiagramresourcerelationships): Returns how a resource (`resourceId`) in a cloud diagram layer (`layerId`) connects to other resources — the anchor plus related resources with relation type and hop distance; optionally tune `direction` (downstream/upstream/both), `depth` (direct/transitive), and `kind` (edges/group_members/both)
- [`list_cloud_diagram_activity_groups`](https://developer.doit.com/reference/listclouddiagramactivitygroups): Lists the change history of a cloud diagram layer (`ss_id`) grouped by snapshot, ordered by timestamp descending; each group references a snapshot and contains the individual activity records (node/link/group/attachment create/update/delete) that belong to it. Page with `offset`/`limit` and filter by `tags`
- [`list_cloud_diagram_node_activities`](https://developer.doit.com/reference/listclouddiagramnodeactivities): Lists individual activity records (`NODE_CREATE`/`NODE_UPDATE`/`NODE_DELETE`) for a single component node (`ss_id` + `nodeId`) in a cloud diagram layer, ordered by timestamp descending, each including the user who made the change. Page with `offset`/`limit`
- [`get_cloud_diagram_components`](https://developer.doit.com/reference/getclouddiagramcomponents): Returns all cloud diagrams (schemes) with their connected layers (statussheets) and optionally their component data. This is the primary discovery endpoint — use it to look up layer IDs required by other diagram endpoints. Optionally filter by `scheme_ids` or `layer_ids`, and set `include_components=true` to include nodes, elements, groups, links, etc.
- [`list_reports`](https://developer.doit.com/reference/listreports): Lists Cloud Analytics reports that your account has access to
- [`run_query`](https://developer.doit.com/reference/query): Runs a report query with the specified configuration without persisting it
- [`get_report_results`](https://developer.doit.com/reference/getreport): Get the results of a specific report by ID
- [`get_report_config`](https://developer.doit.com/reference/getreportconfig): Get the configuration of a specific Cloud Analytics report by ID
- [`create_report`](https://developer.doit.com/reference/createreport): Creates a new Cloud Analytics report with the specified configuration
- [`update_report`](https://developer.doit.com/reference/updatereport): Updates an existing Cloud Analytics report with the specified configuration
- [`validate_user`](https://developer.doit.com/reference/validate): Validates the current API user and returns domain and email information
- [`list_dimensions`](https://developer.doit.com/reference/listdimensions): Lists Cloud Analytics dimensions that your account has access to
- [`get_dimension`](https://developer.doit.com/reference/getdimensions): Get a specific Cloud Analytics dimension by type and ID
- [`list_tickets`](https://developer.doit.com/reference/idoftickets): List support tickets from DoiT using the support API
- [`get_ticket`](https://developer.doit.com/reference/idofticketget): Get details of a specific support ticket by its ID
- [`list_ticket_comments`](https://developer.doit.com/reference/idofticketcommentslist): List all comments on a support ticket by its ID. Customers see only public comments; DoiT employees see both public and private comments
- [`create_ticket_comment`](https://developer.doit.com/reference/idofticketcommentspost): Add a comment to an existing support ticket. For customers, comments are always public. For DoiT employees, comments can be marked as private internal notes
- [`list_invoices`](https://developer.doit.com/reference/listinvoices): List all current and historical invoices for your organization from the DoiT API
- [`get_invoice`](https://developer.doit.com/reference/getinvoice): Retrieve the full details of an invoice specified by the invoice number from the DoiT API
- [`list_allocations`](https://developer.doit.com/reference/listallocations): List allocations for report or run_query configuration that your account has access to from the DoiT API
- [`get_allocation`](https://developer.doit.com/reference/getallocation): Get a specific allocation by ID from the DoiT API
- [`create_allocation`](https://developer.doit.com/reference/createallocation): Create a new allocation
- [`update_allocation`](https://developer.doit.com/reference/updateallocation): Update an existing allocation
- [`list_alerts`](https://developer.doit.com/reference/listalerts): Returns a list of alerts that your account has access to
- [`get_alert`](https://developer.doit.com/reference/getalert): Returns a specific alert by ID.
- [`create_alert`](https://developer.doit.com/reference/createalert): Creates a new alert to notify when cloud costs exceed defined thresholds
- [`update_alert`](https://developer.doit.com/reference/updatealert): Updates an existing alert by ID
- [`list_budgets`](https://developer.doit.com/reference/listbudgets): Returns the list of budgets that the user has access to
- [`get_budget`](https://developer.doit.com/reference/getbudget): Returns the details and current utilization of a specified budget
- [`create_budget`](https://developer.doit.com/reference/createbudget): Creates a new budget to track actual cloud spend against planned spend
- [`update_budget`](https://developer.doit.com/reference/updatebudget): Updates an existing budget
- [`list_annotations`](https://developer.doit.com/reference/listannotations): Returns a list of annotations that your account has access to
- [`get_annotation`](https://developer.doit.com/reference/getannotation): Returns a specific annotation by ID
- [`create_annotation`](https://developer.doit.com/reference/createannotation): Creates a new annotation with content, timestamp, and optional report/label associations
- [`update_annotation`](https://developer.doit.com/reference/updateannotation): Updates an existing annotation by ID
- [`list_commitments`](https://developer.doit.com/reference/listcommitments): Returns a list of commitments (reserved capacity or spend agreements) with cloud providers
- [`get_commitment`](https://developer.doit.com/reference/getcommitment): Returns details of a specific commitment by ID, including periods and attainment data
- [`ask_ava_sync`](https://developer.doit.com/reference/askavasync): Ask DoiT AVA, the cloud cost and infrastructure expert, a question about the user's DoiT account, cloud spending, or optimization opportunities. Note: AVA can take a long time to respond for complex questions.
- [`list_organizations`](https://developer.doit.com/reference/listorganizations): Returns a list of organizations accessible to the authenticated user
- [`list_platforms`](https://developer.doit.com/reference/listplatforms): Returns a list of all available platforms
- [`list_users`](https://developer.doit.com/reference/listusers): Returns a list of all users in the organization
- [`update_user`](https://developer.doit.com/reference/updateuser): Updates user information including name, job function, phone, language, and role
- [`invite_user`](https://developer.doit.com/reference/inviteuser): Invites a new user to the organization by email, optionally assigning a role and organization
- [`list_roles`](https://developer.doit.com/reference/listroles): Returns a list of all IAM roles, including both preset and custom roles
- [`list_products`](https://developer.doit.com/reference/listproducts): Lists products available for different platforms, optionally filtered by platform name
- [`list_datahub_datasets`](https://developer.doit.com/reference/listdatahubdatasets): Returns a list of all DataHub datasets for the customer
- [`get_datahub_dataset`](https://developer.doit.com/reference/getdatahubdataset): Returns details of a specific DataHub dataset by name
- [`create_datahub_dataset`](https://developer.doit.com/reference/createdatahubdataset): Creates a new DataHub dataset with a name and optional description
- [`update_datahub_dataset`](https://developer.doit.com/reference/updatedatahubdataset): Updates an existing DataHub dataset's description
- [`send_datahub_events`](https://developer.doit.com/reference/datahubevents): Sends one or more DataHub events for ingestion (1–50,000 events per call)
- [`list_labels`](https://developer.doit.com/reference/listlabels): Returns a list of labels that the user has access to
- [`get_label`](https://developer.doit.com/reference/getlabel): Returns details of a specific label by ID
- [`create_label`](https://developer.doit.com/reference/createlabel): Creates a new label with a name and color
- [`update_label`](https://developer.doit.com/reference/updatelabel): Updates an existing label's name or color
- [`get_label_assignments`](https://developer.doit.com/reference/getlabelassignments): Returns the list of objects assigned to a specific label
- [`assign_objects_to_label`](https://developer.doit.com/reference/assignobjectstolabel): Assigns or unassigns objects to a label
- [`list_folders`](https://developer.doit.com/reference/listfolders): Returns the Cloud Analytics folders the user has access to
- [`get_folder`](https://developer.doit.com/reference/getfolder): Returns details of a specific Cloud Analytics folder by ID or name
- [`create_folder`](https://developer.doit.com/reference/createfolder): Creates a new Cloud Analytics folder; optionally place it under a parent folder
- [`update_folder`](https://developer.doit.com/reference/updatefolder): Renames, re-describes, or moves (reparents) an existing Cloud Analytics folder
- [`list_themes`](https://developer.doit.com/reference/listcustomthemes): Returns the custom color themes defined for your account
- [`get_theme`](https://developer.doit.com/reference/getcustomtheme): Returns details of a specific custom color theme by ID or name
- [`get_active_theme`](https://developer.doit.com/reference/getactivetheme): Returns the color theme currently active for the authenticated user (the sentinel `"default"` means the built-in default is in use)
- [`set_active_theme`](https://developer.doit.com/reference/setactivetheme): Sets the active color theme for the authenticated user; pass the sentinel `"default"` to revert to the built-in default
- [`update_theme`](https://developer.doit.com/reference/updatecustomtheme): Updates an existing custom color theme (rename, change primary color, or replace the color palette) by ID or name
- [`create_theme`](https://developer.doit.com/reference/createcustomtheme): Creates a new custom color theme (name, primary color, and light/dark color palettes); requires Cloud Analytics Admin permission
- [`list_account_team`](https://developer.doit.com/reference/listaccountteam): Returns the DoiT account managers assigned to the customer, including name, email, role, and Calendly link
- [`get_resource_permissions`](https://developer.doit.com/reference/getresourcepermission-2): Returns the sharing settings (per-user roles and public visibility) for a specific alert, budget, report, or allocation
- [`update_resource_permissions`](https://developer.doit.com/reference/updateresourcepermissions): Updates the sharing settings for a specific alert, budget, report, or allocation. Accepts an optional `permissions` array of per-user role entries (owner/editor/viewer) and an optional `public` visibility level (`"editor"`, `"viewer"`, or `null` for private)
- [`get_aws_account`](https://developer.doit.com/reference/getawsaccount): Returns the CloudConnect details of a connected AWS account (role ARN, billing S3 bucket, enabled and supported features) by AWS account ID
- [`get_cloud_connect_supported_features`](https://developer.doit.com/reference/getcloudconnectsupportedfeatures): Returns the DoiT CloudConnect features supported for a connected cloud account (AWS account ID or Azure tenant ID) and whether the required permissions are present
- [`get_insight`](https://developer.doit.com/reference/getinsightresult): Returns the metadata and aggregate summary (savings, risk counts, status) of a single optimization insight identified by its source and key


## Usage Examples

Here are some common queries you can ask using the DoiT MCP server:

### Cost Analysis and Savings

- "What are my Flexsave savings?" - This will analyze your Flexsave cost optimization savings across your cloud accounts.
- "What are my top 3 AWS services by cost?" - This will run a Cloud Analytics query to identify your highest-spending AWS services.

### Reports and Analytics

- "List all my available reports" - This will show all Cloud Analytics reports you have access to.
- "Show me the results of my 'Monthly Cost Overview' report" - This will fetch and display results from a specific report.

### Anomaly Detection

- "What are my recent GCP anomalies?" - This will show recent cost or usage anomalies detected in your Google Cloud Platform accounts.
- "Show me details about anomaly ABC123" - This will provide detailed information about a specific anomaly.

### Invoices

- "List all my invoices" - This will show all current and historical invoices for your organization.
- "Show me details for invoice INV-2024-001" - This will provide full details for a specific invoice, including line items and payment status.

These examples demonstrate basic usage patterns. You can combine and modify these queries based on your needs. The MCP server will interpret your natural language queries and use the appropriate tools to fetch the requested information.

## Environment Variables

- `DOIT_API_KEY`: Your DoiT API key (required)
- `CUSTOMER_CONTEXT`: Your customer context identifier (optional)
