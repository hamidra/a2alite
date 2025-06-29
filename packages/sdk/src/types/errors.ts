/**
 * Custom error for general JSON parsing failures
 */
export class JSONParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JSONParseError";
    // Ensure proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, JSONParseError);
    }
  }
}
