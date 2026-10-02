import { decodeJWT } from "./util.js";

export const EMPLOYEE_ONLY_TOOLS = new Set(["search_customers"]);

// Read from the API key's own claims (no network call). Not a security boundary: the
// backend still enforces Do'er access, this only decides which tools to advertise.
export function isDoitEmployee(token: string | undefined): boolean {
    const payload = token ? decodeJWT(token)?.payload : undefined;
    return (
        payload?.DoitEmployee === true ||
        (typeof payload?.sub === "string" && payload.sub.toLowerCase().endsWith("@doit.com"))
    );
}
