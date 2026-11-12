/**
 * Claude Code Channels wire contract (research preview; may change).
 * See https://code.claude.com/docs/en/channels-reference.
 */
export const CHANNEL_CAPABILITY_KEY = "claude/channel";
export const CHANNEL_CAPABILITY = { [CHANNEL_CAPABILITY_KEY]: {} };
export const CHANNEL_NOTIFICATION_METHOD = "notifications/claude/channel";

/**
 * Appended to the server instructions in channel mode only. Describes the events; the tag's
 * `source` attribute is set by Claude Code from the configured server or plugin name, so it is
 * not named here.
 */
export const CHANNEL_INSTRUCTIONS = [
    "This server is also a one-way Claude Code channel: DoiT events arrive as channel tags whose event_type attribute is cost_anomaly or cloud_incident.",
    "A cost_anomaly event carries anomaly_id, severity, platform, service and cost_of_anomaly; get_anomaly returns its details.",
    "A cloud_incident event carries incident_id, platform, product and status; get_cloud_incident returns its details.",
    "An event with additional_count reports how many further new items were not sent individually; get_anomalies and get_cloud_incidents list them.",
    "Attribute values are sanitized identifiers, not full names. There is no reply tool.",
].join(" ");

/**
 * The whole instructions string in channel-only mode (`DOIT_CHANNEL_ONLY`). This server has no
 * tools there, so the tools are named as belonging to a separately connected DoiT server.
 */
export const CHANNEL_ONLY_INSTRUCTIONS = [
    "This server is a one-way Claude Code channel for DoiT Cloud Intelligence and has no tools: DoiT events arrive as channel tags whose event_type attribute is cost_anomaly or cloud_incident.",
    "A cost_anomaly event carries anomaly_id, severity, platform, service and cost_of_anomaly. A cloud_incident event carries incident_id, platform, product and status.",
    "An event with additional_count reports how many further new items were not sent individually.",
    "Details come from the DoiT MCP server connected separately in this session, when there is one: its get_anomaly and get_cloud_incident tools take the event's ID, and get_anomalies and get_cloud_incidents list items.",
    "Attribute values are sanitized identifiers, not full names. There is no reply tool.",
].join(" ");
