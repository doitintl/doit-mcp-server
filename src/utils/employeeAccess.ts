import { handleValidateUserRequest, parseValidatedUserResponse } from "../tools/validateUser.js";

export const EMPLOYEE_ONLY_TOOLS = new Set(["search_customers"]);

// Keyed on the validated email, not `domain`: a Do'er key scoped to a customer
// reports that customer's domain.
export async function isDoitEmployee(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
        const { email } = parseValidatedUserResponse(await handleValidateUserRequest({}, token));
        return email.toLowerCase().endsWith("@doit.com");
    } catch {
        return false;
    }
}
