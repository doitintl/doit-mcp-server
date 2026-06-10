import {
  handleValidateUserRequest,
  parseValidatedUserResponse,
} from "../../../src/tools/validateUser.js";
import { decodeJWT } from "../../../src/utils/util.js";

// DoiT internal customer id used as the default context for DoiT employees,
// matching main (app.ts handleCustomerContext).
const DOIT_EMPLOYEE_DEFAULT_CONTEXT = "EE8CtpzYiKp0dVAESVrB";

export type LegacyApiKeyIdentity = {
  email: string;
  customerContext: string;
  isDoitEmployee: boolean;
};

// Validate a DoiT API key passed in the Authorization header and resolve the
// caller's identity, mirroring main's flow:
//   1. DoiT API keys are JWTs carrying `sub` (email) and `DoitEmployee`. Decode the
//      claims locally (the DoiT API verifies the key's signature in step 2).
//   2. Validate the key against /auth/v1/validate -> { domain, email }. Employees
//      validate against the DoiT internal customer context.
//   3. Anti-forgery: require validated email === JWT `sub`.
//   4. Derive context: employees default to the DoiT internal id (and may switch via
//      change_customer); regular customers are scoped to their own domain.
// Returns null for any non-JWT / invalid / rejected / mismatched key.
export async function validateLegacyApiKey(
  token: string
): Promise<LegacyApiKeyIdentity | null> {
  try {
    const payload = decodeJWT(token)?.payload;
    if (!payload) {
      return null;
    }
    const isDoitEmployee = payload.DoitEmployee === true;
    const sub = typeof payload.sub === "string" ? payload.sub : "";

    const validateContext = isDoitEmployee
      ? { customerContext: DOIT_EMPLOYEE_DEFAULT_CONTEXT }
      : {};
    const response = await handleValidateUserRequest(validateContext, token);
    const validated = parseValidatedUserResponse(
      response as Parameters<typeof parseValidatedUserResponse>[0]
    );

    if (validated.email.toLowerCase() !== sub.toLowerCase()) {
      console.error("[mcp] legacy api key email/sub mismatch", {
        validatedEmail: validated.email,
        jwtSub: sub,
      });
      return null;
    }

    return {
      email: validated.email,
      isDoitEmployee,
      customerContext: isDoitEmployee
        ? DOIT_EMPLOYEE_DEFAULT_CONTEXT
        : validated.domain,
    };
  } catch (error) {
    console.error("[mcp] legacy api key validation failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
