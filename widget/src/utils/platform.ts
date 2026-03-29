/**
 * Map platform identifiers to display names and monochrome SVG icon paths.
 */
export const PLATFORMS: Record<string, { name: string; icon: string }> = {
  "amazon-web-services": { name: "AWS", icon: "☁" },
  "google-cloud":        { name: "GCP", icon: "☁" },
  "google-cloud-project":{ name: "GCP", icon: "☁" },
  "microsoft-azure":     { name: "Azure", icon: "☁" },
  "g-suite":             { name: "Google Workspace", icon: "📧" },
  "office-365":          { name: "Microsoft 365", icon: "📧" },
  "open-ai":             { name: "OpenAI", icon: "🤖" },
};

export function getPlatformName(id: string): string {
  return PLATFORMS[id]?.name ?? id;
}

export function getPlatformIcon(id: string): string {
  return PLATFORMS[id]?.icon ?? "☁";
}
