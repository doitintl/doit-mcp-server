# AGENTS.md

This document provides guidance for AI agents working on the DoiT MCP Server codebase.

## Environment Setup

Requires Node.js `>=18`. Install dependencies before running any commands:

```sh
yarn install
```

## Project Overview

DoiT MCP Server is a Model Context Protocol (MCP) server that provides LLMs with access to the DoiT API for troubleshooting and analysis.

The project consists of two main packages:

1. **Main Package (`src/`)** - Core MCP server implementation using stdio transport
   - Published as `@doitintl/doit-mcp-server` on npm
   - Runs locally via `npx` or stdio connection
   - Entry point: `src/index.ts`

2. **HTTP/SSE Package (`doit-mcp-server/`)** - Cloudflare Workers deployment
   - Exposes the MCP server over HTTP/SSE protocol
   - Deployed at `https://mcp.doit.com/sse`
   - Includes OAuth authentication flow
   - Uses Cloudflare Durable Objects for session persistence
   - Entry point: `doit-mcp-server/src/index.ts`
   - Imports and wraps tools from the main package (`../../src/tools/`)

## Project Structure

### Main Package (`src/`)
```
src/
├── index.ts              # Entry point (stdio transport)
├── server.ts             # MCP server setup and request handlers
├── tools/                # MCP tool implementations
│   └── __tests__/        # Tool tests
├── types/                # Tools and general type definitions
├── utils/                # Shared utilities
│   ├── util.ts           # General utilities (debugLog, toSnakeCase, etc.)
│   ├── prompts.ts        # MCP prompt definitions
│   ├── consts.ts         # Constants
│   ├── toolsHandler.ts   # Tool request handler
│   └── __tests__/        # Utility tests
└── __tests__/            # Server-level tests
```

### HTTP/SSE Package (`doit-mcp-server/`)
```
doit-mcp-server/
├── src/
│   ├── index.ts          # Cloudflare Worker entry point
│   ├── app.ts            # Hono app for OAuth UI
│   └── utils.ts          # Worker-specific utilities
└── package.json          # Separate dependencies for Worker
```

The HTTP/SSE package imports tools and utilities from the main package and wraps them with:
- OAuth authentication flow
- HTTP/SSE transport layer

## Development Commands

Use `yarn` for all package management and development tasks:

### Local Development
- `yarn check:dev` - Run type checking and linting (recommended before committing)
- `yarn test` - Run all tests
- `yarn lint` - Check code for linting issues
- `yarn build` - Build the project

### Fixing Issues
- `yarn check:fix` - Auto-fix linting and formatting issues
- `yarn lint:fix` - Auto-fix linting issues only
- `yarn format:fix` - Auto-fix formatting issues only

### Type Checking
- `yarn type-check` - Run TypeScript type checking without emitting files

## Code Conventions

### Naming Conventions
- **Files**: Use camelCase for file names (e.g., `cloudIncidents.ts`)
- **Functions**: Use camelCase for function names
- **Types/Interfaces**: Use PascalCase for type and interface names
- **Constants**: Use UPPER_SNAKE_CASE for constants
- **Tool names**: Use snake_case for tool and prompt names

### Tool Implementation Pattern

Each tool file in `src/tools/` should follow this pattern:

1. **Tool Definition**: Export a tool object with `name`, `description`, and `inputSchema`
2. **Handler Function**: Export a handler function that processes the tool request
3. **Tests**: Create corresponding test file in `__tests__/` directory in file name matching the module under test. vitest is used as testing framework

Example structure:
```typescript
import { z } from "zod";

// Zod schema for runtime validation
const MyToolSchema = z.object({
    param1: z.string(),
});

// Tool definition with raw inputSchema for MCP registration
export const myTool = {
    name: "my_tool",
    description: "Description of what the tool does",
    inputSchema: {
        type: "object",
        properties: {
            param1: { type: "string", description: "..." },
        },
        required: ["param1"],
    },
};

// Handler: args typed as any, validated at runtime via Zod
export async function handleMyToolRequest(args: any, token: string) {
    const { param1 } = MyToolSchema.parse(args);
    // Implementation
}
```

### Utility Functions

Common utilities are located in `src/utils/util.ts`:
- `toSnakeCase(str)` - Convert strings to snake_case
- `debugLog(message, level)` - Debug logging with levels

### Testing

- Place tests in `__tests__/` directories alongside the code they test
- Use descriptive test names that explain the behavior being tested
- Follow the existing test patterns in the codebase

## Adding New Tools

When adding a new MCP tool:

1. Create tool file in `src/tools/`
2. Define a Zod schema for runtime validation and a raw `inputSchema` object for MCP registration (both are needed — see example below)
3. Implement handler function
4. Register tool in `src/server.ts` (stdio transport)
5. Register tool in `doit-mcp-server/src/index.ts` (HTTP/SSE transport)
6. Add tests in `src/tools/__tests__/`
7. Update README.md with tool documentation

**Note**: Tools must be registered in both transports to be available in all deployment modes.

## Code Quality

Before committing:
1. Run `yarn check:dev` to ensure code passes type checking and linting
2. Run `yarn test` to ensure all tests pass
3. Use `yarn check:fix` to automatically fix common issues
4. Use `yarn build` to ensure project builds successfully

The project uses:
- **TypeScript** for type safety
- **Biome** for linting and formatting
- **Vitest** for testing
- **Zod** for schema validation
