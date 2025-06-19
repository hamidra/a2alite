import { z } from "zod/v4";

// --- ENUMS ---
/**
 * Represents the possible states of a Task.
 */
export const TaskStateEnum = z.enum([
  "submitted",
  "working",
  "input-required",
  "completed",
  "canceled",
  "failed",
  "rejected",
  "auth-required",
  "unknown",
]);
export type TaskState = z.infer<typeof TaskStateEnum>;

/**
 * Message sender's role: "agent" or "user".
 */
export const MessageRoleEnum = z.enum(["agent", "user"]);
export type MessageRole = z.infer<typeof MessageRoleEnum>;

// --- BASES & COMMONS ---
/**
 * Base properties common to all message parts.
 */
export const PartBaseSchema = z.object({
  /**
   * Optional metadata associated with the part.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});

// --- PARTS ---
/**
 * Represents a text segment within parts.
 */
export const TextPartSchema = z.object({
  /**
   * Part type - text for TextParts
   */
  kind: z.literal("text"),
  /**
   * Text content
   */
  text: z.string(),
  /**
   * Optional metadata associated with the part.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type TextPart = z.infer<typeof TextPartSchema>;

/**
 * Define the variant where 'bytes' is present and 'uri' is absent.
 */
export const FileWithBytesSchema = z.object({
  /**
   * base64 encoded content of the file
   */
  bytes: z.string(),
  /**
   * Optional mimeType for the file
   */
  mimeType: z.string().optional(),
  /**
   * Optional name for the file
   */
  name: z.string().optional(),
});
export type FileWithBytes = z.infer<typeof FileWithBytesSchema>;

/**
 * Define the variant where 'uri' is present and 'bytes' is absent.
 */
export const FileWithUriSchema = z.object({
  /**
   * URL for the File content
   */
  uri: z.string(),
  /**
   * Optional mimeType for the file
   */
  mimeType: z.string().optional(),
  /**
   * Optional name for the file
   */
  name: z.string().optional(),
});
export type FileWithUri = z.infer<typeof FileWithUriSchema>;

/**
 * Represents a File segment within parts.
 */
export const FilePartSchema = z.object({
  /**
   * Part type - file for FileParts
   */
  kind: z.literal("file"),
  /**
   * File content either as url or bytes
   */
  file: z.union([FileWithBytesSchema, FileWithUriSchema]),
  /**
   * Optional metadata associated with the part.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type FilePart = z.infer<typeof FilePartSchema>;

/**
 * Represents a structured data segment within a message part.
 */
export const DataPartSchema = z.object({
  /**
   * Part type - data for DataParts
   */
  kind: z.literal("data"),
  /**
   * Structured data content
   */
  data: z.record(z.string(), z.any()),
  /**
   * Optional metadata associated with the part.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type DataPart = z.infer<typeof DataPartSchema>;

/**
 * Represents a part of a message, which can be text, a file, or structured data.
 */
export const PartSchema = z.union([
  TextPartSchema,
  FilePartSchema,
  DataPartSchema,
]);
export type Part = z.infer<typeof PartSchema>;

// --- MESSAGE ---
/**
 * Represents a single message exchanged between user and agent.
 */
export const MessageSchema = z.object({
  /**
   * Event type
   */
  kind: z.literal("message"),
  /**
   * Identifier created by the message creator
   */
  messageId: z.string(),
  /**
   * Message content
   */
  parts: z.array(PartSchema),
  /**
   * Message sender's role
   */
  role: MessageRoleEnum,
  /**
   * The context the message is associated with
   */
  contextId: z.string().optional(),
  /**
   * Extension metadata.
   */
  metadata: z.record(z.string(), z.any()).optional(),
  /**
   * List of tasks referenced as context by this message.
   */
  referenceTaskIds: z.array(z.string()).optional(),
  /**
   * Identifier of task the message is related to
   */
  taskId: z.string().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

// --- ARTIFACT ---
/**
 * Represents an artifact generated for a task.
 */
export const ArtifactSchema = z.object({
  /**
   * Unique identifier for the artifact.
   */
  artifactId: z.string(),
  /**
   * Optional description for the artifact.
   */
  description: z.string().optional(),
  /**
   * Extension metadata.
   */
  metadata: z.record(z.string(), z.any()).optional(),
  /**
   * Optional name for the artifact.
   */
  name: z.string().optional(),
  /**
   * Artifact parts.
   */
  parts: z.array(PartSchema),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

// --- AGENT ---
/**
 * Defines optional capabilities supported by an agent.
 */
export const AgentCapabilitiesSchema = z.object({
  /**
   * true if the agent can notify updates to client.
   */
  pushNotifications: z.boolean().optional(),
  /**
   * true if the agent exposes status change history for tasks.
   */
  stateTransitionHistory: z.boolean().optional(),
  /**
   * true if the agent supports SSE.
   */
  streaming: z.boolean().optional(),
});
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;

/**
 * Represents the service provider of an agent.
 */
export const AgentProviderSchema = z.object({
  /**
   * Agent provider's organization name.
   */
  organization: z.string(),
  /**
   * Agent provider's URL.
   */
  url: z.string(),
});
export type AgentProvider = z.infer<typeof AgentProviderSchema>;

/**
 * Represents a unit of capability that an agent can perform.
 */
export const AgentSkillSchema = z.object({
  /**
   * Description of the skill - will be used by the client or a human as a hint to understand what the skill does.
   */
  description: z.string(),
  /**
   * The set of example scenarios that the skill can perform.
   */
  examples: z.array(z.string()).optional(),
  /**
   * Unique identifier for the agent's skill.
   */
  id: z.string(),
  /**
   * The set of interaction modes that the skill supports (if different than the default). Supported mime types for input.
   */
  inputModes: z.array(z.string()).optional(),
  /**
   * Human readable name of the skill.
   */
  name: z.string(),
  /**
   * Supported mime types for output.
   */
  outputModes: z.array(z.string()).optional(),
  /**
   * Set of tagwords describing classes of capabilities for this specific skill.
   */
  tags: z.array(z.string()),
});
export type AgentSkill = z.infer<typeof AgentSkillSchema>;

/**
 * An AgentCard conveys key information:
 * - Overall details (version, name, description, uses)
 * - Skills: A set of capabilities the agent can perform
 * - Default modalities/content types supported by the agent.
 * - Authentication requirements
 */
export const AgentCardSchema = z.object({
  /**
   * Optional capabilities supported by the agent.
   */
  capabilities: AgentCapabilitiesSchema.optional(),
  /**
   * The set of interaction modes that the agent supports across all skills. This can be overridden per-skill. Supported mime types for input.
   */
  defaultInputModes: z.array(z.string()),
  /**
   * Supported mime types for output.
   */
  defaultOutputModes: z.array(z.string()),
  /**
   * A human-readable description of the agent. Used to assist users and other agents in understanding what the agent can do.
   */
  description: z.string(),
  /**
   * A URL to documentation for the agent.
   */
  documentationUrl: z.string().optional(),
  /**
   * Human readable name of the agent.
   */
  name: z.string(),
  /**
   * The service provider of the agent
   */
  provider: AgentProviderSchema.optional(),
  /**
   * Security requirements for contacting the agent.
   */
  security: z.array(z.object({}).catchall(z.array(z.string()))).optional(),
  /**
   * Security scheme details used for authenticating with this agent.
   */
  securitySchemes: z.record(z.string(), z.any()).optional(), // SecurityScheme is a union, see below
  /**
   * Skills are a unit of capability that an agent can perform.
   */
  skills: z.array(AgentSkillSchema),
  /**
   * true if the agent supports providing an extended agent card when the user is authenticated. Defaults to false if not specified.
   */
  supportsAuthenticatedExtendedCard: z.boolean().optional(),
  /**
   * A URL to the address the agent is hosted at.
   */
  url: z.string(),
  /**
   * The version of the agent - format is up to the provider.
   */
  version: z.string(),
});
export type AgentCard = z.infer<typeof AgentCardSchema>;

// --- SECURITY SCHEMES ---
/**
 * Defines an API key security scheme.
 */
export const APIKeySecuritySchemeSchema = z.object({
  /**
   * A description for the security scheme.
   */
  description: z.string().optional(),
  /**
   * The location of the API key.
   */
  in: z.enum(["cookie", "header", "query"]),
  /**
   * The name of the header, query, or cookie parameter to be used.
   */
  name: z.string(),
  /**
   * The type of the security scheme (apiKey).
   */
  type: z.literal("apiKey"),
});
export type APIKeySecurityScheme = z.infer<typeof APIKeySecuritySchemeSchema>;

/**
 * Defines an HTTP authentication security scheme.
 */
export const HTTPAuthSecuritySchemeSchema = z.object({
  /**
   * A hint to the client to identify how the bearer token is formatted.
   */
  bearerFormat: z.string().optional(),
  /**
   * A description for the security scheme.
   */
  description: z.string().optional(),
  /**
   * The name of the HTTP Authorization scheme to be used in the Authorization header.
   */
  scheme: z.string(),
  /**
   * The type of the security scheme (http).
   */
  type: z.literal("http"),
});
export type HTTPAuthSecurityScheme = z.infer<
  typeof HTTPAuthSecuritySchemeSchema
>;

/**
 * Configuration for OAuth2 authorization code flow.
 */
export const AuthorizationCodeOAuthFlowSchema = z.object({
  /**
   * The authorization URL to be used for this flow.
   */
  authorizationUrl: z.string(),
  /**
   * The refresh URL to be used for obtaining refresh tokens.
   */
  refreshUrl: z.string().optional(),
  /**
   * The available scopes for the OAuth2 security scheme.
   */
  scopes: z.record(z.string(), z.string()),
  /**
   * The token URL to be used for this flow.
   */
  tokenUrl: z.string(),
});
export type AuthorizationCodeOAuthFlow = z.infer<
  typeof AuthorizationCodeOAuthFlowSchema
>;

/**
 * Configuration for OAuth2 client credentials flow.
 */
export const ClientCredentialsOAuthFlowSchema = z.object({
  /**
   * The refresh URL to be used for obtaining refresh tokens.
   */
  refreshUrl: z.string().optional(),
  /**
   * The available scopes for the OAuth2 security scheme.
   */
  scopes: z.record(z.string(), z.string()),
  /**
   * The token URL to be used for this flow.
   */
  tokenUrl: z.string(),
});
export type ClientCredentialsOAuthFlow = z.infer<
  typeof ClientCredentialsOAuthFlowSchema
>;

/**
 * Configuration for OAuth2 implicit flow.
 */
export const ImplicitOAuthFlowSchema = z.object({
  /**
   * The authorization URL to be used for this flow.
   */
  authorizationUrl: z.string(),
  /**
   * The refresh URL to be used for obtaining refresh tokens.
   */
  refreshUrl: z.string().optional(),
  /**
   * The available scopes for the OAuth2 security scheme.
   */
  scopes: z.record(z.string(), z.string()),
});
export type ImplicitOAuthFlow = z.infer<typeof ImplicitOAuthFlowSchema>;

/**
 * Configuration for OAuth2 password flow.
 */
export const PasswordOAuthFlowSchema = z.object({
  /**
   * The refresh URL to be used for obtaining refresh tokens.
   */
  refreshUrl: z.string().optional(),
  /**
   * The available scopes for the OAuth2 security scheme.
   */
  scopes: z.record(z.string(), z.string()),
  /**
   * The token URL to be used for this flow.
   */
  tokenUrl: z.string(),
});
export type PasswordOAuthFlow = z.infer<typeof PasswordOAuthFlowSchema>;

/**
 * Lists supported OAuth2 flows for a security scheme.
 */
export const OAuthFlowsSchema = z.object({
  /**
   * Configuration for OAuth2 authorization code flow.
   */
  authorizationCode: AuthorizationCodeOAuthFlowSchema.optional(),
  /**
   * Configuration for OAuth2 client credentials flow.
   */
  clientCredentials: ClientCredentialsOAuthFlowSchema.optional(),
  /**
   * Configuration for OAuth2 implicit flow.
   */
  implicit: ImplicitOAuthFlowSchema.optional(),
  /**
   * Configuration for OAuth2 password flow.
   */
  password: PasswordOAuthFlowSchema.optional(),
});
export type OAuthFlows = z.infer<typeof OAuthFlowsSchema>;

/**
 * Defines an OAuth2 security scheme.
 */
export const OAuth2SecuritySchemeSchema = z.object({
  /**
   * A description for the security scheme.
   */
  description: z.string().optional(),
  /**
   * Lists supported OAuth2 flows.
   */
  flows: OAuthFlowsSchema,
  /**
   * The type of the security scheme (oauth2).
   */
  type: z.literal("oauth2"),
});
export type OAuth2SecurityScheme = z.infer<typeof OAuth2SecuritySchemeSchema>;

/**
 * Defines an OpenID Connect security scheme.
 */
export const OpenIdConnectSecuritySchemeSchema = z.object({
  /**
   * A description for the security scheme.
   */
  description: z.string().optional(),
  /**
   * OpenId Connect URL to discover OAuth2 endpoints.
   */
  openIdConnectUrl: z.string(),
  /**
   * The type of the security scheme (openIdConnect).
   */
  type: z.literal("openIdConnect"),
});
export type OpenIdConnectSecurityScheme = z.infer<
  typeof OpenIdConnectSecuritySchemeSchema
>;

/**
 * Union type for supported security schemes.
 */
export const SecuritySchemeSchema = z.union([
  APIKeySecuritySchemeSchema,
  HTTPAuthSecuritySchemeSchema,
  OAuth2SecuritySchemeSchema,
  OpenIdConnectSecuritySchemeSchema,
]);
export type SecurityScheme = z.infer<typeof SecuritySchemeSchema>;

// --- PUSH NOTIFICATIONS ---
/**
 * Authentication information for push notifications.
 */
export const PushNotificationAuthenticationInfoSchema = z.object({
  /**
   * Optional credentials for push notification authentication.
   */
  credentials: z.string().optional(),
  /**
   * Array of supported authentication schemes.
   */
  schemes: z.array(z.string()),
});
export type PushNotificationAuthenticationInfo = z.infer<
  typeof PushNotificationAuthenticationInfoSchema
>;

/**
 * Configuration for push notifications for a task.
 */
export const PushNotificationConfigSchema = z.object({
  /**
   * Optional authentication information for push notifications.
   */
  authentication: PushNotificationAuthenticationInfoSchema.optional(),
  /**
   * Optional push notification token.
   */
  token: z.string().optional(),
  /**
   * URL to send push notifications to.
   */
  url: z.string(),
});
export type PushNotificationConfig = z.infer<
  typeof PushNotificationConfigSchema
>;

/**
 * Associates a push notification config with a task.
 */
export const TaskPushNotificationConfigSchema = z.object({
  /**
   * Push notification configuration.
   */
  pushNotificationConfig: PushNotificationConfigSchema,
  /**
   * ID of the task.
   */
  taskId: z.string(),
});
export type TaskPushNotificationConfig = z.infer<
  typeof TaskPushNotificationConfigSchema
>;

// --- TASKS ---
/**
 * Represents the status of a task.
 */
export const TaskStatusSchema = z.object({
  /**
   * Most recent message for the task.
   */
  message: MessageSchema.optional(),
  /**
   * Current state of the task.
   */
  state: TaskStateEnum,
  /**
   * ISO 8601 datetime string when the status was recorded.
   */
  timestamp: z.string().optional(),
});
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Represents a task in the system.
 */
export const TaskSchema = z.object({
  /**
   * Artifacts generated for the task.
   */
  artifacts: z.array(ArtifactSchema).optional(),
  /**
   * Context ID associated with the task.
   */
  contextId: z.string(),
  /**
   * History of messages for the task.
   */
  history: z.array(MessageSchema).optional(),
  /**
   * Unique identifier for the task.
   */
  id: z.string(),
  /**
   * Type of object (always "task").
   */
  kind: z.literal("task"),
  /**
   * Extension metadata.
   */
  metadata: z.record(z.string(), z.any()).optional(),
  /**
   * Current status of the task.
   */
  status: TaskStatusSchema,
});
export type Task = z.infer<typeof TaskSchema>;

// --- EVENTS ---
/**
 * Event indicating a status update for a task.
 */
export const TaskStatusUpdateEventSchema = z.object({
  /**
   * Context ID associated with the event.
   */
  contextId: z.string(),
  /**
   * Whether this is the final status update for the task.
   */
  final: z.boolean(),
  /**
   * Event type (always "status-update").
   */
  kind: z.literal("status-update"),
  /**
   * Extension metadata.
   */
  metadata: z.record(z.string(), z.any()).optional(),
  /**
   * Status of the task after the update.
   */
  status: TaskStatusSchema,
  /**
   * ID of the task.
   */
  taskId: z.string(),
});
export type TaskStatusUpdateEvent = z.infer<typeof TaskStatusUpdateEventSchema>;

/**
 * Event indicating an artifact update for a task.
 */
export const TaskArtifactUpdateEventSchema = z.object({
  /**
   * If true, the artifact is appended to the task's artifacts array.
   */
  append: z.boolean().optional(),
  /**
   * The artifact that was updated.
   */
  artifact: ArtifactSchema,
  /**
   * Context ID associated with the event.
   */
  contextId: z.string(),
  /**
   * Event type (always "artifact-update").
   */
  kind: z.literal("artifact-update"),
  /**
   * If true, this is the last chunk of the artifact.
   */
  lastChunk: z.boolean().optional(),
  /**
   * Extension metadata.
   */
  metadata: z.record(z.string(), z.any()).optional(),
  /**
   * ID of the task.
   */
  taskId: z.string(),
});
export type TaskArtifactUpdateEvent = z.infer<
  typeof TaskArtifactUpdateEventSchema
>;

// --- PARAMS ---
/**
 * Parameters for identifying a task by ID.
 */
export const TaskIdParamsSchema = z.object({
  /**
   * The ID of the task.
   */
  id: z.string(),
  /**
   * Optional metadata for the operation.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type TaskIdParams = z.infer<typeof TaskIdParamsSchema>;

/**
 * Parameters for querying a task, including optional history length.
 */
export const TaskQueryParamsSchema = z.object({
  /**
   * Number of messages to include in the returned history.
   */
  historyLength: z.number().optional(),
  /**
   * The ID of the task.
   */
  id: z.string(),
  /**
   * Optional metadata for the operation.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type TaskQueryParams = z.infer<typeof TaskQueryParamsSchema>;

// --- MESSAGE SEND ---
/**
 * Configuration options for sending a message.
 */
export const MessageSendConfigurationSchema = z.object({
  /**
   * List of accepted output modes (MIME types).
   */
  acceptedOutputModes: z.array(z.string()),
  /**
   * If true, the request is blocking.
   */
  blocking: z.boolean().optional(),
  /**
   * Number of messages to include in the returned history.
   */
  historyLength: z.number().optional(),
  /**
   * Optional push notification config for the message.
   */
  pushNotificationConfig: PushNotificationConfigSchema.optional(),
});
export type MessageSendConfiguration = z.infer<
  typeof MessageSendConfigurationSchema
>;

/**
 * Parameters for sending a message.
 */
export const MessageSendParamsSchema = z.object({
  /**
   * Optional configuration for sending the message.
   */
  configuration: MessageSendConfigurationSchema.optional(),
  /**
   * The message to send.
   */
  message: MessageSchema,
  /**
   * Optional metadata for the operation.
   */
  metadata: z.record(z.string(), z.any()).optional(),
});
export type MessageSendParams = z.infer<typeof MessageSendParamsSchema>;

// --- ERROR TYPES ---
/**
 * Helper for constructing error schemas with code and default message.
 */
function errorType(constant: number, defaultMsg: string) {
  return z.object({
    /**
     * A Number that indicates the error type that occurred.
     */
    code: z.literal(constant),
    /**
     * A Primitive or Structured value that contains additional information about the error.
     * This may be omitted.
     */
    data: z.any().optional(),
    /**
     * A String providing a short description of the error.
     */
    message: z.string().default(defaultMsg),
  });
}

export enum ErrorType {
  JSONParseError = -32700,
  InvalidRequestError = -32600,
  MethodNotFoundError = -32601,
  InvalidParamsError = -32602,
  InternalError = -32603,
  TaskNotFoundError = -32001,
  TaskNotCancelableError = -32002,
  PushNotificationNotSupportedError = -32003,
  UnsupportedOperationError = -32004,
  ContentTypeNotSupportedError = -32005,
  InvalidAgentResponseError = -32006,
}

export const JSONParseErrorSchema = errorType(
  ErrorType.JSONParseError,
  "Invalid JSON payload"
);
export type JSONParseError = z.infer<typeof JSONParseErrorSchema>;

export const InvalidRequestErrorSchema = errorType(
  ErrorType.InvalidRequestError,
  "Request payload validation error"
);
export type InvalidRequestError = z.infer<typeof InvalidRequestErrorSchema>;

export const MethodNotFoundErrorSchema = errorType(
  ErrorType.MethodNotFoundError,
  "Method not found"
);
export type MethodNotFoundError = z.infer<typeof MethodNotFoundErrorSchema>;

export const InvalidParamsErrorSchema = errorType(
  ErrorType.InvalidParamsError,
  "Invalid parameters"
);
export type InvalidParamsError = z.infer<typeof InvalidParamsErrorSchema>;

export const InternalErrorSchema = errorType(
  ErrorType.InternalError,
  "Internal error"
);
export type InternalError = z.infer<typeof InternalErrorSchema>;

export const TaskNotFoundErrorSchema = errorType(
  ErrorType.TaskNotFoundError,
  "Task not found"
);
export type TaskNotFoundError = z.infer<typeof TaskNotFoundErrorSchema>;

export const TaskNotCancelableErrorSchema = errorType(
  ErrorType.TaskNotCancelableError,
  "Task cannot be canceled"
);
export type TaskNotCancelableError = z.infer<
  typeof TaskNotCancelableErrorSchema
>;

export const PushNotificationNotSupportedErrorSchema = errorType(
  ErrorType.PushNotificationNotSupportedError,
  "Push Notification is not supported"
);
export type PushNotificationNotSupportedError = z.infer<
  typeof PushNotificationNotSupportedErrorSchema
>;

export const UnsupportedOperationErrorSchema = errorType(
  ErrorType.UnsupportedOperationError,
  "This operation is not supported"
);
export type UnsupportedOperationError = z.infer<
  typeof UnsupportedOperationErrorSchema
>;

export const ContentTypeNotSupportedErrorSchema = errorType(
  ErrorType.ContentTypeNotSupportedError,
  "Incompatible content types"
);
export type ContentTypeNotSupportedError = z.infer<
  typeof ContentTypeNotSupportedErrorSchema
>;

export const InvalidAgentResponseErrorSchema = errorType(
  ErrorType.InvalidAgentResponseError,
  "Invalid agent response"
);
export type InvalidAgentResponseError = z.infer<
  typeof InvalidAgentResponseErrorSchema
>;

// --- JSON-RPC ---
/**
 * Generic JSON-RPC error schema.
 */
export const JSONRPCErrorSchema = z.object({
  /**
   * Error code.
   */
  code: z.number(),
  /**
   * Optional error data.
   */
  data: z.any().optional(),
  /**
   * Error message.
   */
  message: z.string(),
});
export type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>;
export const isJSONRPCError = (value: unknown): value is JSONRPCError =>
  JSONRPCErrorSchema.safeParse(value).success;

/**
 * JSON-RPC error response.
 */
export const JSONRPCErrorResponseSchema = z.object({
  /**
   * The error object.
   */
  error: z.union([
    JSONRPCErrorSchema,
    JSONParseErrorSchema,
    InvalidRequestErrorSchema,
    MethodNotFoundErrorSchema,
    InvalidParamsErrorSchema,
    InternalErrorSchema,
    TaskNotFoundErrorSchema,
    TaskNotCancelableErrorSchema,
    PushNotificationNotSupportedErrorSchema,
    UnsupportedOperationErrorSchema,
    ContentTypeNotSupportedErrorSchema,
    InvalidAgentResponseErrorSchema,
  ]),
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
});
export type JSONRPCErrorResponse = z.infer<typeof JSONRPCErrorResponseSchema>;

/**
 * Base JSON-RPC message schema.
 */
export const JSONRPCMessageSchema = z.object({
  /**
   * The ID of the request or response.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
});
export type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>;

/**
 * JSON-RPC request schema.
 */
export const JSONRPCRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method to invoke.
   */
  method: z.string(),
  /**
   * Optional parameters for the method.
   */
  params: z.record(z.string(), z.any()).optional(),
});
export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;

/**
 * JSON-RPC result schema.
 */
export const JSONRPCResultSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result of the request.
   */
  result: z.any(),
});
export type JSONRPCResult = z.infer<typeof JSONRPCResultSchema>;

/**
 * JSON-RPC response schema.
 */
export const JSONRPCResponseSchema = z.union([
  JSONRPCResultSchema,
  JSONRPCErrorResponseSchema,
]);
export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;

// --- REQUESTS ---
/**
 * JSON-RPC request for sending a message.
 */
export const SendMessageRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "message/send").
   */
  method: z.literal("message/send"),
  /**
   * Parameters for sending the message.
   */
  params: MessageSendParamsSchema,
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/**
 * JSON-RPC request for streaming a message.
 */
export const SendStreamingMessageRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "message/stream").
   */
  method: z.literal("message/stream"),
  /**
   * Parameters for streaming the message.
   */
  params: MessageSendParamsSchema,
});
export type SendStreamingMessageRequest = z.infer<
  typeof SendStreamingMessageRequestSchema
>;

/**
 * JSON-RPC request for retrieving a task.
 */
export const GetTaskRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "tasks/get").
   */
  method: z.literal("tasks/get"),
  /**
   * Parameters for querying the task.
   */
  params: TaskQueryParamsSchema,
});
export type GetTaskRequest = z.infer<typeof GetTaskRequestSchema>;

/**
 * JSON-RPC request for canceling a task.
 */
export const CancelTaskRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "tasks/cancel").
   */
  method: z.literal("tasks/cancel"),
  /**
   * Parameters for canceling the task.
   */
  params: TaskIdParamsSchema,
});
export type CancelTaskRequest = z.infer<typeof CancelTaskRequestSchema>;

/**
 * JSON-RPC request for setting push notification config for a task.
 */
export const SetTaskPushNotificationConfigRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "tasks/pushNotificationConfig/set").
   */
  method: z.literal("tasks/pushNotificationConfig/set"),
  /**
   * Parameters for setting push notification config.
   */
  params: TaskPushNotificationConfigSchema,
});
export type SetTaskPushNotificationConfigRequest = z.infer<
  typeof SetTaskPushNotificationConfigRequestSchema
>;

/**
 * JSON-RPC request for getting push notification config for a task.
 */
export const GetTaskPushNotificationConfigRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "tasks/pushNotificationConfig/get").
   */
  method: z.literal("tasks/pushNotificationConfig/get"),
  /**
   * Parameters for getting push notification config.
   */
  params: TaskIdParamsSchema,
});
export type GetTaskPushNotificationConfigRequest = z.infer<
  typeof GetTaskPushNotificationConfigRequestSchema
>;

/**
 * JSON-RPC request for resubscribing to a task.
 */
export const TaskResubscriptionRequestSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The method (always "tasks/resubscribe").
   */
  method: z.literal("tasks/resubscribe"),
  /**
   * Parameters for resubscribing to the task.
   */
  params: TaskIdParamsSchema,
});
export type TaskResubscriptionRequest = z.infer<
  typeof TaskResubscriptionRequestSchema
>;

// --- RESPONSES ---
/**
 * JSON-RPC success response for sending a message.
 */
export const SendMessageSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (Task or Message).
   */
  result: z.union([TaskSchema, MessageSchema]),
});
export type SendMessageSuccessResponse = z.infer<
  typeof SendMessageSuccessResponseSchema
>;
export const SendMessageResponseSchema = z.union([
  SendMessageSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/**
 * JSON-RPC success response for streaming a message.
 */
export const SendStreamingMessageSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (Task, Message, or Event).
   */
  result: z.union([
    TaskSchema,
    MessageSchema,
    TaskStatusUpdateEventSchema,
    TaskArtifactUpdateEventSchema,
  ]),
});
export type SendStreamingMessageSuccessResponse = z.infer<
  typeof SendStreamingMessageSuccessResponseSchema
>;
export const SendStreamingMessageResponseSchema = z.union([
  SendStreamingMessageSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type SendStreamingMessageResponse = z.infer<
  typeof SendStreamingMessageResponseSchema
>;

/**
 * JSON-RPC success response for retrieving a task.
 */
export const GetTaskSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (Task).
   */
  result: TaskSchema,
});
export type GetTaskSuccessResponse = z.infer<
  typeof GetTaskSuccessResponseSchema
>;
export const GetTaskResponseSchema = z.union([
  GetTaskSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type GetTaskResponse = z.infer<typeof GetTaskResponseSchema>;

/**
 * JSON-RPC success response for canceling a task.
 */
export const CancelTaskSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (Task).
   */
  result: TaskSchema,
});
export type CancelTaskSuccessResponse = z.infer<
  typeof CancelTaskSuccessResponseSchema
>;
export const CancelTaskResponseSchema = z.union([
  CancelTaskSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type CancelTaskResponse = z.infer<typeof CancelTaskResponseSchema>;

/**
 * JSON-RPC success response for setting push notification config.
 */
export const SetTaskPushNotificationConfigSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (TaskPushNotificationConfig).
   */
  result: TaskPushNotificationConfigSchema,
});
export type SetTaskPushNotificationConfigSuccessResponse = z.infer<
  typeof SetTaskPushNotificationConfigSuccessResponseSchema
>;
export const SetTaskPushNotificationConfigResponseSchema = z.union([
  SetTaskPushNotificationConfigSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type SetTaskPushNotificationConfigResponse = z.infer<
  typeof SetTaskPushNotificationConfigResponseSchema
>;

/**
 * JSON-RPC success response for getting push notification config.
 */
export const GetTaskPushNotificationConfigSuccessResponseSchema = z.object({
  /**
   * The ID of the request.
   */
  id: z.union([z.string(), z.number()]).optional(),
  /**
   * JSON-RPC version (always "2.0").
   */
  jsonrpc: z.literal("2.0"),
  /**
   * The result (TaskPushNotificationConfig).
   */
  result: TaskPushNotificationConfigSchema,
});
export type GetTaskPushNotificationConfigSuccessResponse = z.infer<
  typeof GetTaskPushNotificationConfigSuccessResponseSchema
>;
export const GetTaskPushNotificationConfigResponseSchema = z.union([
  GetTaskPushNotificationConfigSuccessResponseSchema,
  JSONRPCErrorResponseSchema,
]);
export type GetTaskPushNotificationConfigResponse = z.infer<
  typeof GetTaskPushNotificationConfigResponseSchema
>;

// --- UNION TYPES (A2AError, A2ARequest, etc) ---
/**
 * Union of all error types defined in the A2A protocol.
 */
export const A2AErrorSchema = z.union([
  JSONParseErrorSchema,
  InvalidRequestErrorSchema,
  MethodNotFoundErrorSchema,
  InvalidParamsErrorSchema,
  InternalErrorSchema,
  TaskNotFoundErrorSchema,
  TaskNotCancelableErrorSchema,
  PushNotificationNotSupportedErrorSchema,
  UnsupportedOperationErrorSchema,
  ContentTypeNotSupportedErrorSchema,
  InvalidAgentResponseErrorSchema,
]);
export type A2AError = z.infer<typeof A2AErrorSchema>;

/**
 * Union of all request types defined in the A2A protocol.
 */
export const A2ARequestSchema = z.union([
  SendMessageRequestSchema,
  SendStreamingMessageRequestSchema,
  GetTaskRequestSchema,
  CancelTaskRequestSchema,
  SetTaskPushNotificationConfigRequestSchema,
  GetTaskPushNotificationConfigRequestSchema,
  TaskResubscriptionRequestSchema,
]);
export type A2ARequest = z.infer<typeof A2ARequestSchema>;

/**
 *
 */
export type RequestsByMethod = {
  [R in A2ARequest as R["method"]]: R;
};

// --- END ---
