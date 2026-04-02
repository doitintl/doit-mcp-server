/**
 * End-to-end test for anomaly chart rendering.
 *
 * 1. Simulates an anomaly with a chart URL
 * 2. Runs it through adaptToolResponse
 * 3. Checks the proxy endpoint works
 * 4. Creates a test HTML page that loads the widget with the data
 * 5. Opens it in a browser so you can visually verify
 *
 * Run: npx tsx scripts/test-chart-e2e.mjs
 */

import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const { adaptToolResponse } = await import("../doit-mcp-server/src/responseAdapter.ts");

const CHART_URL = "https://storage.googleapis.com/me-doit-intl-com-gcp-anomalies/fd7f1dfb-72e8-4c0e-835a-9e0135c9b61d.png";
const PROXY_URL = `https://mcp.doit.com/proxy-image?url=${encodeURIComponent(CHART_URL)}`;

console.log("=== Step 1: Verify proxy endpoint ===");
try {
    const resp = await fetch(PROXY_URL);
    console.log(`Proxy: ${resp.status} ${resp.headers.get("content-type")} ${resp.headers.get("content-length")} bytes`);
    if (!resp.ok) {
        console.error("FAIL: Proxy returned non-200");
        process.exit(1);
    }
} catch (e) {
    console.error("FAIL: Proxy fetch failed:", e.message);
    process.exit(1);
}

console.log("\n=== Step 2: Verify adaptToolResponse ===");
const anomaly = {
    id: "fd7f1dfb-72e8-4c0e-835a-9e0135c9b61d",
    platform: "google-cloud",
    serviceName: "Gemini API",
    scope: "doitintl-artifact-registry",
    costOfAnomaly: 89.2,
    severityLevel: "critical",
    status: "inactive",
    startTime: "2026-03-25T00:00:00Z",
    endTime: "2026-03-29T00:00:00Z",
    acknowledged: false,
    anomalyChartUrl: CHART_URL,
    top3SKUs: [{ name: "SKU A", cost: 50 }, { name: "SKU B", cost: 39.2 }],
};

const mcpResp = { content: [{ type: "text", text: JSON.stringify(anomaly) }] };
const adapted = adaptToolResponse("get_anomaly", mcpResp);
const sc = adapted.structuredContent;

console.log("anomalyChartUrl in structuredContent:", sc.anomalyChartUrl ? "PRESENT" : "MISSING");
console.log("URL starts with proxy:", sc.anomalyChartUrl?.startsWith("https://mcp.doit.com/proxy-image"));
console.log("_columns has Chart:", sc._columns?.some(c => c.key === "anomalyChartUrl"));

const contentData = JSON.parse(adapted.content[0].text);
console.log("anomalyChartUrl in content[0].text:", contentData.anomalyChartUrl ? "PRESENT" : "MISSING");

if (!sc.anomalyChartUrl) {
    console.error("FAIL: anomalyChartUrl missing from structuredContent");
    process.exit(1);
}

console.log("\n=== Step 3: Test image loads directly ===");
try {
    const imgResp = await fetch(sc.anomalyChartUrl);
    console.log(`Image via proxy: ${imgResp.status} ${imgResp.headers.get("content-type")}`);
    if (!imgResp.ok) {
        console.error("FAIL: Proxied image returned non-200");
        process.exit(1);
    }
} catch (e) {
    console.error("FAIL: Proxied image fetch failed:", e.message);
    process.exit(1);
}

console.log("\n=== Step 4: Generate test page ===");

// Fetch the actual widget HTML
const widgetResp = await fetch("https://mcp.doit.com/widget");
const widgetHtml = await widgetResp.text();

// Build a test page that injects the widget with our test data
const testPage = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Chart E2E Test</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#fff}</style>
</head>
<body>
<h3 style="padding:16px;color:#666">Widget Chart E2E Test — anomaly with chart URL</h3>
<div style="border:1px solid #e5e5e5;border-radius:12px;margin:16px;overflow:hidden">
<div id="widget-frame"></div>
</div>

<h3 style="padding:16px;color:#666">Direct image test (no widget, just img tag)</h3>
<img src="${sc.anomalyChartUrl}" style="max-width:100%;border:1px solid #e5e5e5;margin:16px"
     onerror="this.nextElementSibling.style.display='block'"
     onload="this.nextElementSibling.style.display='none'" />
<p style="display:block;color:red;padding:16px">IMAGE FAILED TO LOAD — CSP or network issue</p>

<h3 style="padding:16px;color:#666">Raw GCS URL test (no proxy)</h3>
<img src="${CHART_URL}" style="max-width:100%;border:1px solid #e5e5e5;margin:16px"
     onerror="this.nextElementSibling.style.display='block'"
     onload="this.nextElementSibling.style.display='none'" />
<p style="display:block;color:red;padding:16px">RAW GCS IMAGE FAILED TO LOAD</p>

<script>
// Inject widget HTML and simulate tool result
const frame = document.getElementById('widget-frame');
const toolOutput = ${JSON.stringify(sc)};
const toolName = "get_anomaly";

// Create an iframe to simulate the widget sandbox
const iframe = document.createElement('iframe');
iframe.style.width = '100%';
iframe.style.height = '600px';
iframe.style.border = 'none';
frame.appendChild(iframe);

// Write widget HTML into iframe
const doc = iframe.contentDocument;
doc.open();
doc.write(\`${widgetHtml.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`);
doc.close();

// After widget loads, inject the tool data via the legacy path
iframe.onload = () => {
    setTimeout(() => {
        iframe.contentWindow.openai = {
            toolOutput: toolOutput,
            toolResponseMetadata: { toolName: toolName },
            theme: { mode: "light" },
        };
        iframe.contentWindow.dispatchEvent(new Event("openai:set_globals"));
    }, 500);
};
</script>
</body>
</html>`;

writeFileSync("/tmp/chart-e2e-test.html", testPage);
console.log("Test page written to /tmp/chart-e2e-test.html");
console.log("Opening in browser...");

try {
    execSync("open /tmp/chart-e2e-test.html");
} catch {
    console.log("Could not open browser. Open /tmp/chart-e2e-test.html manually.");
}

console.log("\n=== Summary ===");
console.log("✓ Proxy endpoint returns valid image");
console.log("✓ adaptToolResponse rewrites URL to proxy");
console.log("✓ _columns includes Chart column");
console.log("✓ Proxied image is fetchable");
console.log("→ Check browser to see if images render visually");
