import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import { mockedDoitApiHandlers } from "./mockedDoitApi/index.js";

export const mswServer = setupServer(...mockedDoitApiHandlers);

beforeAll(() => {
    process.env.DOIT_API_KEY = "test-api-key";
    mswServer.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
    mswServer.resetHandlers();
});

afterAll(() => {
    mswServer.close();
});
