import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { ViewProps } from "../router";
import { Layout } from "../components/Layout";
import { getBridge } from "../bridge";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Col { name: string; type: string; }
interface QuerySection { columns: Col[]; rows: unknown[][]; }

interface OverviewData {
  costByCloud: QuerySection;
  topServices: QuerySection;
  topProjects: QuerySection;
  anomalies:   unknown[];
  incidents:   unknown[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAIN_CLOUDS = new Set(["amazon-web-services", "google-cloud", "microsoft-azure"]);

/** Human-readable display names for known cloud / SaaS provider IDs */
const PROVIDER_NAMES: Record<string, string> = {
  "amazon-web-services": "AWS",
  "google-cloud":        "GCP",
  "microsoft-azure":     "Azure",
  "cursor":              "Cursor",
  "github":              "GitHub",
  "openai":              "OpenAI",
  "mongodb":             "MongoDB",
  "anthropic":           "Anthropic",
  "datadog":             "Datadog",
  "snowflake":           "Snowflake",
  "cloudflare":          "Cloudflare",
  "vercel":              "Vercel",
  "netlify":             "Netlify",
  "heroku":              "Heroku",
  "elastic":             "Elastic",
  "confluent":           "Confluent",
  "grafana":             "Grafana",
  "pagerduty":           "PagerDuty",
  "twilio":              "Twilio",
  "sendgrid":            "SendGrid",
  "stripe":              "Stripe",
  "okta":                "Okta",
  "auth0":               "Auth0",
  "splunk":              "Splunk",
  "new-relic":           "New Relic",
  "sumologic":           "Sumo Logic",
  "hashicorp":           "HashiCorp",
};

const CLOUD_COLORS: Record<string, string> = {
  "amazon-web-services": "#FF9900",
  "google-cloud":        "#4285F4",
  "microsoft-azure":     "#0078D4",
};

const SEV_COLORS: Record<string, string> = {
  critical: "var(--dci-danger)", high: "var(--dci-danger)",
  medium:   "var(--dci-warning)", low: "var(--dci-text-secondary)",
};

const STATUS_COLORS: Record<string, string> = {
  active:     "var(--dci-danger)",
  ongoing:    "var(--dci-danger)",
  monitoring: "var(--dci-warning)",
  resolved:   "var(--dci-success)",
  archived:   "var(--dci-text-secondary)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCost(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

/** Suppress API catch-all rows like "∑ Other services" */
function isOther(s: string): boolean {
  return s.startsWith("∑") || s.toLowerCase().startsWith("other");
}

function providerName(id: string): string {
  if (id in PROVIDER_NAMES) return PROVIDER_NAMES[id];
  // Smart-capitalise unknown IDs: "some-provider" → "Some Provider"
  return id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function providerColor(id: string): string {
  return CLOUD_COLORS[id] ?? "var(--dci-text-secondary)";
}

function findCostIdx(cols: Col[]): number {
  return cols.findIndex(c =>
    c.type?.toUpperCase().includes("FLOAT") ||
    c.type?.toUpperCase().includes("NUMERIC") ||
    c.name.toLowerCase() === "cost"
  );
}

function findCloudIdx(cols: Col[]): number {
  return cols.findIndex(c => c.name.toLowerCase() === "cloud_provider");
}

/** Aggregate daily rows into a per-cloud total map */
function aggregateByCloud(cols: Col[], rows: unknown[][]): Map<string, number> {
  const cloudIdx = findCloudIdx(cols);
  const costIdx  = findCostIdx(cols);
  if (cloudIdx < 0 || costIdx < 0) return new Map();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const cloud = String(r[cloudIdx] ?? "");
    if (isOther(cloud)) continue;
    totals.set(cloud, (totals.get(cloud) ?? 0) + (Number(r[costIdx]) || 0));
  }
  return totals;
}

// ── SubCard ────────────────────────────────────────────────────────────────────

function SubCard({ title, children, flex }: { title: string; children: ComponentChildren; flex?: string }) {
  return (
    <div style={{
      flex: flex ?? "1 1 calc(50% - 6px)",
      minWidth: "160px",
      background: "var(--dci-bg)",
      border: "1px solid var(--dci-border)",
      borderRadius: "8px",
      padding: "12px 14px",
      boxSizing: "border-box",
    }}>
      <div style={{
        fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.07em", color: "var(--dci-text-secondary)", marginBottom: "10px",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── CostByCloud ────────────────────────────────────────────────────────────────

function CostByCloud({ section }: { section: QuerySection }) {
  const totals = aggregateByCloud(section.columns, section.rows);
  const rows = Array.from(totals.entries())
    .map(([cloud, cost]) => ({ cloud, cost }))
    .filter(r => r.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  if (!rows.length) return null;

  const total = rows.reduce((s, r) => s + r.cost, 0);
  const max   = rows[0].cost;

  return (
    <SubCard title="Cloud spend · last 30 days" flex="1 1 100%">
      <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--dci-text)", marginBottom: "12px" }}>
        {formatCost(total)}
      </div>
      {rows.map(({ cloud, cost }) => {
        const pct   = Math.max(3, (cost / max) * 100);
        const color = providerColor(cloud);
        const name  = providerName(cloud);
        return (
          <div key={cloud} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
            <span style={{
              width: "72px", minWidth: "72px", fontSize: "0.68rem", fontWeight: MAIN_CLOUDS.has(cloud) ? 700 : 400,
              color, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {name}
            </span>
            <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--dci-bg-secondary)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: "4px", background: color }} />
            </div>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--dci-text)", width: "58px", textAlign: "right", flexShrink: 0 }}>
              {formatCost(cost)}
            </span>
          </div>
        );
      })}
    </SubCard>
  );
}

// ── GroupedTable ───────────────────────────────────────────────────────────────

function GroupedTable({ section, title, nameCol }: { section: QuerySection; title: string; nameCol: string }) {
  const [expanded, setExpanded] = useState(false);

  const cloudIdx = findCloudIdx(section.columns);
  const nameIdx  = section.columns.findIndex(c => c.name.toLowerCase() === nameCol);
  const costIdx  = findCostIdx(section.columns);
  if (cloudIdx < 0 || nameIdx < 0 || costIdx < 0) return null;

  // Aggregate daily rows → (cloud → name → cost)
  const aggMap = new Map<string, Map<string, number>>();
  for (const row of section.rows) {
    const cloud = String(row[cloudIdx] ?? "");
    const name  = String(row[nameIdx]  ?? "");
    const cost  = Number(row[costIdx]) || 0;
    if (isOther(cloud) || isOther(name)) continue;
    if (!aggMap.has(cloud)) aggMap.set(cloud, new Map());
    const inner = aggMap.get(cloud)!;
    inner.set(name, (inner.get(name) ?? 0) + cost);
  }

  // Sort all clouds by total cost
  const allClouds = Array.from(aggMap.keys()).sort((a, b) => {
    const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((s, v) => s + v, 0);
    return sum(aggMap.get(b)!) - sum(aggMap.get(a)!);
  });

  const mainClouds  = allClouds.filter(c => MAIN_CLOUDS.has(c));
  const otherClouds = allClouds.filter(c => !MAIN_CLOUDS.has(c));
  const visibleClouds = expanded ? allClouds : mainClouds;

  if (!allClouds.length) return null;

  return (
    <SubCard title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {visibleClouds.map(cloud => {
          const rows = Array.from(aggMap.get(cloud)!.entries())
            .map(([name, cost]) => ({ name, cost }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 5);
          return (
            <div key={cloud}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: providerColor(cloud), marginBottom: "4px" }}>
                {providerName(cloud)}
              </div>
              {rows.map(({ name, cost }) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", padding: "2px 0", borderBottom: "1px solid var(--dci-border)" }}>
                  <span style={{ color: "var(--dci-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "6px" }}>
                    {name || "—"}
                  </span>
                  <span style={{ color: "var(--dci-text-secondary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {formatCost(cost)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {otherClouds.length > 0 && (
        <button
          onClick={() => setExpanded(o => !o)}
          style={{
            marginTop: "8px", background: "none", border: "none", padding: "2px 0",
            cursor: "pointer", fontSize: "0.65rem", color: "var(--dci-text-secondary)",
            display: "flex", alignItems: "center", gap: "3px",
          }}
        >
          <span style={{ fontSize: "0.55rem" }}>{expanded ? "▾" : "▸"}</span>
          {expanded ? "Show less" : `Show ${otherClouds.length} more provider${otherClouds.length > 1 ? "s" : ""}`}
        </button>
      )}
    </SubCard>
  );
}

// ── AnomaliesList ──────────────────────────────────────────────────────────────

function AnomaliesList({ items }: { items: unknown[] }) {
  if (!items.length) return null;
  const bridge = getBridge();

  return (
    <SubCard title="Cost anomalies">
      {items.slice(0, 5).map((item: any, i) => {
        const sev       = String(item.severityLevel ?? "").toLowerCase();
        const sevColor  = SEV_COLORS[sev] ?? "var(--dci-text-secondary)";
        const clickable = !!bridge && !!item.id;
        const handleClick = clickable
          ? () => bridge!.sendFollowUpMessage({ prompt: `Show details for anomaly ${item.id}`, scrollToBottom: true })
          : undefined;

        return (
          <div
            key={i}
            onClick={handleClick}
            style={{
              padding: "6px 0",
              borderBottom: "1px solid var(--dci-border)",
              cursor: clickable ? "pointer" : "default",
            }}
            onMouseEnter={clickable ? e => { (e.currentTarget as HTMLDivElement).style.background = "var(--dci-bg-secondary)"; } : undefined}
            onMouseLeave={clickable ? e => { (e.currentTarget as HTMLDivElement).style.background = ""; } : undefined}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--dci-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {item.serviceName || item.platform || "—"}
              </span>
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: sevColor, flexShrink: 0 }}>
                {item.costOfAnomaly != null ? formatCost(Number(item.costOfAnomaly)) : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
              <span style={{
                fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                color: sevColor,
                background: `color-mix(in srgb, ${sevColor} 12%, transparent)`,
                padding: "1px 5px", borderRadius: "3px",
              }}>
                {sev || "—"}
              </span>
              <span style={{ fontSize: "0.62rem", color: "var(--dci-text-secondary)" }}>
                {providerName(item.platform ?? "")}
              </span>
              {clickable && (
                <span style={{ fontSize: "0.6rem", color: "var(--dci-text-secondary)", marginLeft: "auto" }}>Details →</span>
              )}
            </div>
          </div>
        );
      })}
    </SubCard>
  );
}

// ── IncidentsList ──────────────────────────────────────────────────────────────

function IncidentsList({ items }: { items: unknown[] }) {
  if (!items.length) return null;
  const bridge = getBridge();

  return (
    <SubCard title="Cloud incidents">
      {items.slice(0, 5).map((item: any, i) => {
        const status      = String(item.status ?? "").toLowerCase();
        const statusColor = STATUS_COLORS[status] ?? "var(--dci-text-secondary)";
        const clickable   = !!bridge && !!item.id;
        const handleClick = clickable
          ? () => bridge!.sendFollowUpMessage({ prompt: `Show details for cloud incident ${item.id}`, scrollToBottom: true })
          : undefined;

        return (
          <div
            key={i}
            onClick={handleClick}
            style={{
              padding: "6px 0",
              borderBottom: "1px solid var(--dci-border)",
              cursor: clickable ? "pointer" : "default",
            }}
            onMouseEnter={clickable ? e => { (e.currentTarget as HTMLDivElement).style.background = "var(--dci-bg-secondary)"; } : undefined}
            onMouseLeave={clickable ? e => { (e.currentTarget as HTMLDivElement).style.background = ""; } : undefined}
          >
            <div style={{ fontSize: "0.7rem", color: "var(--dci-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.title || item.product || "—"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
              <span style={{
                fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                color: statusColor,
                background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                padding: "1px 5px", borderRadius: "3px",
              }}>
                {status || "—"}
              </span>
              {item.platform && (
                <span style={{ fontSize: "0.62rem", color: "var(--dci-text-secondary)" }}>
                  {providerName(item.platform)}
                </span>
              )}
              {clickable && (
                <span style={{ fontSize: "0.6rem", color: "var(--dci-text-secondary)", marginLeft: "auto" }}>Details →</span>
              )}
            </div>
          </div>
        );
      })}
    </SubCard>
  );
}

// ── Dashboard row ──────────────────────────────────────────────────────────────

function Row({ children }: { children: ComponentChildren }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
      {children}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function CloudOverview({ data }: ViewProps) {
  const d = data as unknown as OverviewData;

  const hasCost      = (d.costByCloud?.rows?.length ?? 0) > 0;
  const hasServices  = (d.topServices?.rows?.length ?? 0) > 0;
  const hasProjects  = (d.topProjects?.rows?.length ?? 0) > 0;
  const hasAnomalies = (d.anomalies?.length ?? 0) > 0;
  const hasIncidents = (d.incidents?.length ?? 0) > 0;

  if (!hasCost && !hasServices && !hasProjects && !hasAnomalies && !hasIncidents) {
    return (
      <Layout>
        <p style={{ color: "var(--dci-text-secondary)", fontSize: "0.8rem" }}>No cloud data available.</p>
      </Layout>
    );
  }

  return (
    <Layout padding="12px">
      {/* Row 1: Cloud Spend */}
      {hasCost && (
        <Row>
          <CostByCloud section={d.costByCloud} />
        </Row>
      )}

      {/* Row 2: Top Services + Top Projects */}
      {(hasServices || hasProjects) && (
        <Row>
          {hasServices && <GroupedTable section={d.topServices} title="Top services" nameCol="service_description" />}
          {hasProjects && <GroupedTable section={d.topProjects} title="Top projects / accounts" nameCol="project_id" />}
        </Row>
      )}

      {/* Row 3: Anomalies + Incidents */}
      {(hasAnomalies || hasIncidents) && (
        <Row>
          {hasAnomalies && <AnomaliesList items={d.anomalies} />}
          {hasIncidents && <IncidentsList items={d.incidents} />}
        </Row>
      )}
    </Layout>
  );
}
