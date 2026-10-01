import { handleValidateUserRequest, parseValidatedUserResponse } from "../tools/validateUser.js";

export async function isDoitEmployee(token: string): Promise<boolean> {
    try {
        const response = await handleValidateUserRequest({}, token);
        return parseValidatedUserResponse(response).domain.toLowerCase() === "doit.com";
    } catch {
        return false;
    }
}
