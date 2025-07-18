import { Hono } from "hono";
import { A2AServer } from "../../server/server.ts";
import { IAgentExecutor } from "../../agent/executor.ts";
import { jsonRpcBodyParser } from "../../jsonRPC/jsonRpcBodyParser.ts";
import { isJSONRPCError } from "../../../types/types.ts";
import { internalError } from "../../../utils/errors.ts";
import { streamSSE } from "hono/streaming";

/**
 * Creates a Hono HTTP application configured for A2A protocol communication
 * 
 * This function sets up the necessary HTTP endpoints for the A2A protocol:
 * - POST /a2a - Main JSON-RPC endpoint for agent communication
 * - GET /.well-known/agent.json - Agent discovery endpoint
 * 
 * The application handles both synchronous and streaming responses using Server-Sent Events.
 * 
 * @param params - Configuration object
 * @param params.a2aServer - The A2A server instance to handle requests
 * @returns Promise resolving to a configured Hono application instance
 */
async function createHonoApp({ a2aServer }: { a2aServer: A2AServer }) {
  const app = new Hono();

  // Start the a2a server
  await a2aServer.start();

  // JSON-RPC endpoint
  app.post("/a2a", async (c) => {
    try {
      const bodyText = await c.req.text();
      const parsed = await jsonRpcBodyParser(bodyText);

      // If parser returns a JSONRPCError (has code/message), send JSON-RPC error response
      if (isJSONRPCError(parsed)) {
        return c.json({
          jsonrpc: "2.0",
          id: null,
          error: parsed,
        });
      }
      // Handle request
      const result = await a2aServer.handleRequest(parsed);
      if (result.response) {
        return c.json(result.response);
      } else if (result.stream) {
        const stream = result.stream;
        // Use Hono's StreamSSE helper for SSE
        return streamSSE(c, async (sse) => {
          for await (const jsonRpcResponse of stream) {
            await sse.writeSSE({ data: JSON.stringify(jsonRpcResponse) });
          }
        });
      } else {
        // Unexpected result
        return c.json({
          jsonrpc: "2.0",
          id: parsed?.id || null,
          error: internalError(),
        });
      }
    } catch (err: any) {
      console.error(err);

      return c.json({
        jsonrpc: "2.0",
        id: null,
        error: internalError(),
      });
    }
  });

  // Agent card handler
  app.get("/.well-known/agent.json", async (c) => {
    return c.json(a2aServer.agentCard);
  });

  return app;
}

export { createHonoApp };
