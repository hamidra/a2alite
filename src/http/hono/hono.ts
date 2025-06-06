import { Hono } from "hono";
import { A2AServer } from "../../server/index.ts";
import { IAgentExecutor } from "../../agent/executor.ts";
import { jsonRpcBodyParser } from "../../shared/jsonRpcBodyParser.ts";
import { isJSONRPCError } from "../../types/types.ts";
import { internalError } from "../../utils/errors.ts";
import { streamSSE } from "hono/streaming";

// Dummy executor implementing IAgentExecutor
const emptyExecutor: IAgentExecutor = {
  async execute(context) {
    return context.inputRequired(
      {
        message: {
          parts: [
            {
              kind: "text",
              text: "What type of joke would you like to hear?!",
            },
          ],
        },
      },
      "task-1234"
    );
  },
  async cancel(task) {
    return Promise.resolve(undefined as any);
  },
};

const a2aServer = new A2AServer({
  agentExecutor: emptyExecutor,
  agentCard: {},
});
a2aServer.start();

const app = new Hono();

app.post("/a2a", async (c) => {
  try {
    const bodyText = await c.req.text();

    console.log(bodyText);

    const parsed = await jsonRpcBodyParser(bodyText);

    console.log(parsed);

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

    console.log(result);

    if (result.response) {
      return c.json(result.response);
    } else if (result.stream) {
      const stream = result.stream;
      // Use Hono's StreamSSE helper for SSE
      return streamSSE(c, async (sse) => {
        for await (const jsonRpcResponse of stream) {
          sse.writeSSE({ data: JSON.stringify(jsonRpcResponse) });
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

export default app;
