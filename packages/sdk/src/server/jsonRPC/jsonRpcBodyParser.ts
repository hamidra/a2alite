import { IncomingMessage, ServerResponse } from "http";
import { jsonParseError, invalidRequestError } from "../../utils/errors.ts";
import {
  JSONRPCError,
  JSONRPCRequest,
  JSONRPCRequestSchema,
} from "../../types/types.ts";

/**
 * Helper to read and parse JSON body from Node.js IncomingMessage
 */
async function jsonRpcBodyParser(
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

export { jsonRpcBodyParser };
