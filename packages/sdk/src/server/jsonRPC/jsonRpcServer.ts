import {
  JSONRPCRequest,
  JSONRPCResponse,
  ErrorType,
  RequestsByMethod,
} from "../../types/types.ts";

export type HandlerResponse = {
  response?: JSONRPCResponse;
  stream?: AsyncGenerator<JSONRPCResponse>;
};

/**
 * Interface for the JSON-RPC Server, outlining its core functionalities.
 */
export interface IJSONRPCServer {
  /**
   * Registers a handler for a specific JSON-RPC method.
   * @param requestSchema The Zod schema defining the specific request, including a literal method name.
   * @param handler The function to execute when a request matching the schema is received.
   */
  setRequestHandler<M extends keyof RequestsByMethod>(
    methodName: M,
    handler: (
      request: RequestsByMethod[M],
      requestAbortSignal?: AbortSignal,
      extension?: Record<string, any>
    ) => Promise<HandlerResponse>
  ): void;

  /**
   * Handles an incoming raw JSON-RPC request string.
   * This is the primary entry point for the server to receive requests.
   * @param rawRequest The raw JSON string of the request.
   * @param requestAbortSignal An optional AbortSignal to cancel the specific request.
   * @returns A promise that resolves to the JSON string of the response, or undefined for notifications.
   */
  handleRequest(
    request: JSONRPCRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<HandlerResponse>;
}

export class JSONRPCServer implements IJSONRPCServer {
  private _handlers: Map<
    string,
    (
      request: JSONRPCRequest,
      requestAbortSignal?: AbortSignal,
      extension?: Record<string, any>
    ) => Promise<HandlerResponse>
  > = new Map();

  private serverAbortSignal?: AbortSignal;

  public setRequestHandler<M extends keyof RequestsByMethod>(
    methodName: M,
    handler: (
      request: RequestsByMethod[M],
      requestAbortSignal?: AbortSignal,
      extension?: Record<string, any>
    ) => Promise<HandlerResponse>
  ): void {
    // as any is fine since the handler is called with the correct type
    this._handlers.set(methodName, handler as any);
  }

  public async handleRequest(
    request: JSONRPCRequest,
    requestAbortSignal?: AbortSignal,
    extension?: Record<string, any>
  ): Promise<HandlerResponse> {
    try {
      const handler = this._handlers.get(request.method);

      // If no handler is found for the requested method, return a MethodNotFoundError
      if (!handler) {
        return {
          response: {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: ErrorType.MethodNotFoundError,
              message: "Method not found",
            },
          },
        };
      }

      // Run the handler and return the result
      return handler(request, requestAbortSignal, extension);
    } catch (error) {
      return {
        response: {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: ErrorType.InternalError,
            message: "Internal error",
          },
        },
      };
    }
  }
}
