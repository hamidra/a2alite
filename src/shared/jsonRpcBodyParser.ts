import { IncomingMessage, ServerResponse } from "http";
import { jsonParseError, invalidRequestError } from "../utils/errors.ts";
import {
  JSONRPCError,
  JSONRPCRequest,
  JSONRPCRequestSchema,
} from "../types/types.ts";

/**
 * Helper to read and parse JSON body from Node.js IncomingMessage
 */
export async function jsonRpcBodyParser(
  body: string
): Promise<JSONRPCRequest | JSONRPCError> {
  if (!body) {
    return jsonParseError("Empty request body");
  }
  try {
    let json = JSON.parse(body);
    // parse the JSON body into a JSONRPCRequest
    let jsonRpcRequest = JSONRPCRequestSchema.safeParse(json);
    if (jsonRpcRequest.success) {
      // If validation succeeds, return the parsed JSON-RPC request
      return jsonRpcRequest.data;
    } else {
      // If validation fails, return a JSONParseError with the validation issues
      return invalidRequestError("Invalid JSON-RPC request");
    }
  } catch (err) {
    return jsonParseError("Invalid json in the body");
  }
}

/**
 * General handler for POST / (JSON-RPC endpoint)
 * Accepts Node.js http.IncomingMessage and http.ServerResponse
 * Calls server.handleRequest with the parsed JSON-RPC request
 */
/*
export async function postJsonRpcHandler(
  req: IncomingMessage,
  res: ServerResponse,
  server: A2AServer
) {
  try {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    const requestOrError = await readJsonBody(req);
    if (isJSONRPCError(requestOrError)) {
      return res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null, // No ID for error responses, null per JSON-RPC spec
          error: requestOrError,
        })
      );
    }
    const result = await server.handleRequest(requestOrError);
    if (result.response) {
      return res.end(JSON.stringify(result.response));
    } else if (result.stream) {
      // If the result is a stream, we need to handle it differently
      res.setHeader("Content-Type", "text/event-stream");
      for await (const event of result.stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      return res.end();
    }
  } catch (err) {
    let errorResponse = {
      jsonrpc: "2.0",
      id: null,
      error: internalError("Internal server error"),
    };
    res.end(JSON.stringify(errorResponse));
  }
}
*/

/**
 * General handler for GET /agentCard (agent metadata)
 * Accepts Node.js http.IncomingMessage and http.ServerResponse
 * Returns the agent card as JSON
 */
export function getAgentCardHandler(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({})); // ToDo: fix. Returning an empty object for now
}
