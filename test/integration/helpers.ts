import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../src/server.js";

export async function createTestClient() {
	const server = createServer();
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

	await server.connect(serverTransport);

	const client = new Client({ name: "test-client", version: "1.0.0" });
	await client.connect(clientTransport);

	return {
		client,
		server,
		cleanup: async () => {
			await client.close();
			await server.close();
		},
	};
}

export function getTextContent(result: { content: Array<{ type: string; text?: string }> }): string {
	const textPart = result.content.find((c) => c.type === "text");
	return textPart?.text ?? "";
}
