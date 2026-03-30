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
import { WIDGET_HTML } from "./widgetHtml";

export type Bindings = Env & {
  OAUTH_PROVIDER: OAuthHelpers;
  OAUTH_KV: KVNamespace;
};

// ChatGPT redirect URI allowlist (prefix + exact matches for OAuth 2.1 compliance)
const CHATGPT_REDIRECT_URI_PREFIXES = [
  "https://chatgpt.com/connector/oauth/",
];
const CHATGPT_REDIRECT_URI_EXACT = [
  "https://chatgpt.com/connector_platform_oauth_redirect",
  "https://platform.openai.com/apps-manage/oauth",
];

/**
 * Returns true if the given redirect URI is allowed for ChatGPT OAuth flows.
 */
function isChatGPTRedirectUri(redirectUri: string): boolean {
  if (CHATGPT_REDIRECT_URI_EXACT.includes(redirectUri)) return true;
  return CHATGPT_REDIRECT_URI_PREFIXES.some((prefix) =>
    redirectUri.startsWith(prefix)
  );
}

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
    // Add WWW-Authenticate header with resource_metadata
    const url = new URL(c.req.url);
    const base = url.origin;
    // Allow ChatGPT redirect URIs: log for observability, return proper error
    const redirectUri = (formBody.redirect_uri as string) || "";
    if (isChatGPTRedirectUri(redirectUri)) {
      console.log("ChatGPT OAuth flow detected for redirect_uri:", redirectUri);
    }
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

  // Use HTTP 302 redirect so ChatGPT's OAuth popup receives the authorization code.
  // A JS-based redirect (window.location.href) is blocked in sandboxed iframes.
  return c.redirect(redirectTo, 302);
}

// Helper function to render authorization rejection response
async function renderAuthorizationRejection(c: any, redirectUri: string) {
  // Use HTTP 302 so ChatGPT's OAuth popup receives the error response.
  const url = new URL(redirectUri.startsWith("http") ? redirectUri : `https://example.com${redirectUri}`);
  url.searchParams.set("error", "access_denied");
  return c.redirect(url.toString(), 302);
}

app.post("/customer-context", async (c) => {
  const { action, oauthReqInfo, apiKey } = await parseApproveFormBody(
    await c.req.parseBody()
  );

  // Demo mode: bypass JWT validation and complete OAuth with demo props.
  if (apiKey === DEMO_TOKEN) {
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

      const jwtInfoForApprove = decodeJWT(apiKey);
      const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReqInfo,
        userId: apiKey,
        metadata: {
          label: jwtInfoForApprove?.payload?.sub || "User label",
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

// Add /.well-known/oauth-authorization-server endpoint
app.get("/.well-known/oauth-authorization-server", (c) => {
  const host = c.req.header("host") || new URL(c.req.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const base = `${isLocal ? "http" : "https"}://${host}`;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    scopes_supported: ["read_profile", "read_data", "write_data"],
    code_challenge_methods_supported: ["S256"],
  });
});

// Add /.well-known/oauth-protected-resource endpoint (required by OAuth 2.1 / ChatGPT)
// Uses Host header (not url.origin) because wrangler dev rewrites request.url to the
// route pattern host regardless of the actual incoming host (tunnel URL, prod, etc).
app.get("/.well-known/oauth-protected-resource", (c) => {
  const host = c.req.header("host") || new URL(c.req.url).host;
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const base = `${isLocal ? "http" : "https"}://${host}`;
  return c.json({
    resource: base,
    authorization_servers: [base],
    scopes_supported: ["read_profile", "read_data", "write_data"],
  });
});

export default app;
