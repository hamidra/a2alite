import { Hono } from "hono";
import { A2AServer } from "../../index.ts";
import { IAgentExecutor } from "../../agent/executor.ts";
import { jsonRpcBodyParser } from "../../../shared/jsonRpcBodyParser.ts";
import { isJSONRPCError } from "../../../types/types.ts";
import { internalError } from "../../../utils/errors.ts";
import { streamSSE } from "hono/streaming";

export async function createHonoApp({ a2aServer }: { a2aServer: A2AServer }) {
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

  // Leave the agent card handler as is for now
  // app.get("/.well-known/agent.json", getAgentCardHandler);

  return app;
}
