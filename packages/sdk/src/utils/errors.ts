import { ErrorType } from "../types/types.ts";
import { JSONRPCError } from "../types/types.ts";

//---------- JSONRPC Errors ----------
export function jsonParseError(message?: string, data?: unknown): JSONRPCError {
  return {
    code: ErrorType.JSONParseError,
    message: message ?? "Invalid JSON payload",
    data,
  };
}

export function invalidRequestError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.InvalidRequestError,
    message: message ?? "Request payload validation error",
    data,
  };
}

export function methodNotFoundError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.MethodNotFoundError,
    message: message ?? "Method not found",
    data,
  };
}

export function invalidParamsError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.InvalidParamsError,
    message: message ?? "Invalid parameters",
    data,
  };
}

export function internalError(message?: string, data?: unknown): JSONRPCError {
  return {
    code: ErrorType.InternalError,
    message: message ?? "Internal error",
    data,
  };
}

//---------- A2A Errors ----------

export function taskNotFoundError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.TaskNotFoundError,
    message: message ?? "Task not found",
    data,
  };
}

export function taskNotCancelableError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.TaskNotCancelableError,
    message: message ?? "Task cannot be canceled",
    data,
  };
}

export function pushNotificationNotSupportedError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.PushNotificationNotSupportedError,
    message: message ?? "Push Notification is not supported",
    data,
  };
}

export function unsupportedOperationError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.UnsupportedOperationError,
    message: message ?? "This operation is not supported",
    data,
  };
}

export function contentTypeNotSupportedError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.ContentTypeNotSupportedError,
    message: message ?? "Incompatible content types",
    data,
  };
}

export function invalidAgentResponseError(
  message?: string,
  data?: unknown
): JSONRPCError {
  return {
    code: ErrorType.InvalidAgentResponseError,
    message: message ?? "Invalid agent response",
    data,
  };
}
