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

export type Bindings = Env & {
  OAUTH_PROVIDER: OAuthHelpers;
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
    return c.html("INVALID LOGIN", 401);
  }

  // The user must be successfully logged in and have approved the scopes, so we
  // can complete the authorization request
  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: apiKey,
    metadata: {
      label: "User label",
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

app.post("/customer-context", async (c) => {
  const { action, oauthReqInfo, apiKey } = await parseApproveFormBody(
    await c.req.parseBody()
  );

  let isDoitUser = false;
  const validatePromises = [
    handleValidateUserRequest({}, apiKey),
    handleValidateUserRequest(
      { customerContext: "EE8CtpzYiKp0dVAESVrB" }, // Validate doers
      apiKey
    ),
  ];

  return Promise.allSettled(validatePromises)
    .then(async (results) => {
      let allFailed = true;
      for (const res of results) {
        if (res.status === "fulfilled") {
          const result = res.value;
          if (result.content[0].text.includes("Domain: doit.com")) {
            isDoitUser = true;
          }
          if (!result.content[0].text.includes("Failed")) {
            allFailed = false;
          }
        }
      }
      if (allFailed) {
        return c.html(
          layout(
            await renderAuthorizationRejectedContent(
              oauthReqInfo?.redirectUri || "/"
            ),
            "MCP Remote Auth Demo - Authorization Status"
          )
        );
      }
      if (!isDoitUser) {
        // Forward to approve logic
        return await handleApprove(c);
      }
      const content = await renderCustomerContextScreen(
        action,
        oauthReqInfo,
        apiKey
      );
      return c.html(layout(content, "DoiT MCP Remote - Customer Context"));
    })
    .catch(async (error) => {
      return c.html(
        layout(
          await renderAuthorizationRejectedContent(
            oauthReqInfo?.redirectUri || "/"
          ),
          "MCP Remote Auth Demo - Authorization Status"
        )
      );
    });
});

// The /authorize page has a form that will POST to /approve
// This endpoint is responsible for validating any login information and
// then completing the authorization request with the OAUTH_PROVIDER
app.post("/approve", handleApprove);

export default app;
