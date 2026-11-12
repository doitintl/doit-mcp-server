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
