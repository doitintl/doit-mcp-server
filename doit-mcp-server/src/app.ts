import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  layout,
  homeContent,
  parseApproveFormBody,
  renderAuthorizationRejectedContent,
  renderAuthorizationApprovedContent,
  renderLoggedInAuthorizeScreen,
  renderCustomerContextScreen,
} from "./utils";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { handleValidateUserRequest } from "../../src/tools/validateUser";
import { decodeJWT } from "../../src/utils/util";
import { DEMO_TOKEN } from "../../src/utils/demoData";
import type { DoitWorkerEnv } from "./runtimeEnv.js";
import { WIDGET_HTML } from "./widgetHtml";

export type Bindings = DoitWorkerEnv & {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
};


const app = new Hono<{
  Bindings: Bindings;
}>();

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization", "Cache-Control", "mcp-session-id"],
  })
);

// Handle preflight requests for SSE
app.options("/sse", (c) => {
  return c.text("", 200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Access-Control-Allow-Headers": "content-type, mcp-session-id",
  });
});

// Render a basic homepage placeholder to make sure the app is up
app.get("/", async (c) => {
  const content = await homeContent(c.req.raw);
  return c.html(layout(content, "DoiT MCP Remote - Home"));
});

// Serve the full widget HTML at a stable URL so the cached stub can fetch
// the latest version without requiring ChatGPT app re-registration.
app.get("/widget", (c) => {
  return c.body(WIDGET_HTML, 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
});

// Proxy images from storage.googleapis.com so the CSP-sandboxed widget can load them.
// Only allows the specific GCS bucket used for anomaly charts.
app.get("/proxy-image", async (c) => {
  const url = c.req.query("url");
  if (!url || !url.startsWith("https://storage.googleapis.com/me-doit-intl-com-gcp-anomalies/")) {
    return c.text("Forbidden", 403);
  }
  try {
    const resp = await fetch(url);
    if (!resp.ok) return c.text("Not found", 404);
    return c.body(resp.body as any, 200, {
      "Content-Type": resp.headers.get("Content-Type") || "image/png",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    });
  } catch {
    return c.text("Fetch error", 502);
  }
});

// Render an authorization page
// If the user is logged in, we'll show a form to approve the appropriate scopes
// If the user is not logged in, we'll show a form to both login and approve the scopes
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);

  const oauthScopes = [
    {
      name: "read_profile",
      description: "Read your DoiT Cloud Intelligence profile information",
    },
    { name: "read_data", description: "Access your DoiT Cloud Intelligence data (anomalies, reports, allocations, etc.)" },
    { name: "write_data", description: "Create and modify your DoiT Cloud Intelligence data" },
  ];

  const content = await renderLoggedInAuthorizeScreen(
    oauthScopes,
    oauthReqInfo
  );
  return c.html(layout(content, "DoiT MCP Remote - Authorization"));
});

// Reusable approve handler function
async function handleApprove(c: any) {
  const formBody = await c.req.parseBody();
  const { action, oauthReqInfo, apiKey, customerContext, isDoitUser } =
    await parseApproveFormBody(formBody);

  if (!oauthReqInfo) {
    const url = new URL(c.req.url);
    const base = url.origin;
    return c.html("INVALID LOGIN", 401, {
      "WWW-Authenticate": `Bearer resource_metadata=\"${base}/.well-known/oauth-authorization-server\"`,
    });
  }

  const jwtInfo = decodeJWT(apiKey);

  // The user must be successfully logged in and have approved the scopes, so we
  // can complete the authorization request
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: apiKey,
    metadata: {
      label: jwtInfo?.payload?.sub || "User label",
    },
    scope: oauthReqInfo.scope,
    props: {
      apiKey,
      customerContext,
      isDoitUser,
    },
  });

  // Defense-in-depth: verify the redirect URL uses https before redirecting.
  if (!redirectTo.startsWith("https://")) {
    return c.html("Invalid redirect URI", 400);
  }
  return c.redirect(redirectTo, 302);
}

// Helper function to render authorization rejection response.
// The redirect URI was already validated by the OAuthProvider during the
// authorization request, so we only need a basic protocol check here.
async function renderAuthorizationRejection(c: any, redirectUri: string) {
  try {
    const parsed = new URL(redirectUri);
    if (parsed.protocol === "https:") {
      parsed.searchParams.set("error", "access_denied");
      return c.redirect(parsed.toString(), 302);
    }
  } catch {
    // malformed URI — fall through to 403
  }
  return c.html("Authorization denied", 403);
}

app.post("/customer-context", async (c) => {
  const { action, oauthReqInfo, apiKey } = await parseApproveFormBody(
    await c.req.parseBody()
  );

  // Demo mode: bypass JWT validation and complete OAuth with demo props.
  // Gated behind DEMO_MODE_ENABLED env var so it can be disabled in production.
  if (apiKey === DEMO_TOKEN && (c.env as any).DEMO_MODE_ENABLED === "true") {
    if (!oauthReqInfo) return c.html("INVALID LOGIN", 401);
    const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
      request: oauthReqInfo,
      userId: DEMO_TOKEN,
      metadata: { label: "demo@acme.io" },
      scope: oauthReqInfo.scope,
      props: { apiKey: DEMO_TOKEN, customerContext: "demo", isDoitUser: "false" },
    });
    return c.redirect(redirectTo, 302);
  }

  try {
    const jwtInfo = decodeJWT(apiKey);
    const payload = jwtInfo?.payload;

    if (!jwtInfo || !payload) {
      // If the JWT is invalid, reject the authorization request
      return await renderAuthorizationRejection(
        c,
        oauthReqInfo?.redirectUri || "/"
      );
    }

    const doitEmployeeContext = payload.DoitEmployee
      ? {
          customerContext: "EE8CtpzYiKp0dVAESVrB",
        }
      : {};

    const validatePromise = await handleValidateUserRequest(
      doitEmployeeContext,
      apiKey
    );
    const result = validatePromise.content[0].text;

    if (!result.toLowerCase().includes(payload.sub)) {
      return await renderAuthorizationRejection(
        c,
        oauthReqInfo?.redirectUri || "/"
      );
    }

    if (!payload.DoitEmployee) {
      // For non-DoiT employees, extract the domain from the validate response
      // and use it as customerContext (the DoiT API identifies their account by domain).
      const domainMatch = result.match(/Domain:\s*(\S+)/);
      const customerContext = domainMatch ? domainMatch[1] : undefined;

      if (!oauthReqInfo) {
        return c.html("INVALID LOGIN", 401);
      }

      const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReqInfo,
        userId: apiKey,
        metadata: {
          label: payload?.sub || "User label",
        },
        scope: oauthReqInfo.scope,
        props: {
          apiKey,
          customerContext,
          isDoitUser: "false",
        },
      });
      return c.redirect(redirectTo, 302);
    }

    const content = await renderCustomerContextScreen(
      action,
      oauthReqInfo,
      apiKey
    );
    return c.html(layout(content, "DoiT MCP Remote - Customer Context"));
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return await renderAuthorizationRejection(
      c,
      oauthReqInfo?.redirectUri || "/"
    );
  }
});

// The /authorize page has a form that will POST to /approve
// This endpoint is responsible for validating any login information and
// then completing the authorization request with the OAUTH_PROVIDER
app.post("/approve", handleApprove);

// Note: /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource
// are handled in handleRequest() in index.ts to support all path prefixes (e.g. /sse/.well-known/...).

export default app;
