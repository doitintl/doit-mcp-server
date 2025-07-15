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

export type Bindings = Env & {
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
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cache-Control"],
  })
);

// Handle preflight requests for SSE
app.options("/sse", (c) => {
  return c.text("", 200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
  });
});

// Render a basic homepage placeholder to make sure the app is up
app.get("/", async (c) => {
  const content = await homeContent(c.req.raw);
  return c.html(layout(content, "DoiT MCP Remote - Home"));
});

// Render an authorization page
// If the user is logged in, we'll show a form to approve the appropriate scopes
// If the user is not logged in, we'll show a form to both login and approve the scopes
app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);

  const oauthScopes = [
    {
      name: "read_profile",
      description: "Read your DoiT basic profile information",
    },
    { name: "read_data", description: "Access your DoiT data" },
    { name: "write_data", description: "Create and modify your DoiT data" },
  ];

  const content = await renderLoggedInAuthorizeScreen(
    oauthScopes,
    oauthReqInfo
  );
  return c.html(layout(content, "DoiT MCP Remote - Authorization"));
});

// Reusable approve handler function
async function handleApprove(c: any) {
  const { action, oauthReqInfo, apiKey, customerContext, isDoitUser } =
    await parseApproveFormBody(await c.req.parseBody());

  if (!oauthReqInfo) {
    // Add WWW-Authenticate header with resource_metadata
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

  return c.html(
    layout(
      await renderAuthorizationApprovedContent(redirectTo),
      "MCP Remote Auth Demo - Authorization Status"
    )
  );
}

// Helper function to render authorization rejection response
async function renderAuthorizationRejection(c: any, redirectUri: string) {
  return c.html(
    layout(
      await renderAuthorizationRejectedContent(redirectUri),
      "DoiT MCP Remote - Authorization Status"
    )
  );
}

app.post("/customer-context", async (c) => {
  const { action, oauthReqInfo, apiKey } = await parseApproveFormBody(
    await c.req.parseBody()
  );

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
      // request validation for non-doit employees
      return await handleApprove(c);
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
  // Extract base URL (protocol + host)
  const url = new URL(c.req.url);
  const base = url.origin;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    scopes_supported: ["*"],
    code_challenge_methods_supported: ["S256"],
  });
});

export default app;
