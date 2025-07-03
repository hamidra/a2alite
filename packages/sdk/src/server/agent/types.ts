import type {
  MessageSendParams,
  Part,
  Artifact,
  Message,
  Task,
  A2AError,
  SendStreamingMessageSuccessResponse,
  JSONRPCError,
} from "../../types/types.ts";
import { AgentTaskStream } from "./stream.ts";
import type { IQueue } from "../providers/queue/queue.ts";
import type { IStore } from "../providers/storage/index.ts";

/** Result type representing a completed task */
export type TaskResult = Task;

/** Result type representing a message response */
export type MessageResult = Message;

/**
 * Result type representing a streaming task with incremental updates
 */
export type StreamResult = {
  /** Identifies this as a streaming result */
  kind: "stream";
  /** The task stream for sending updates */
  taskStream: AgentTaskStream;
  /** The current task state */
  currentTask: Task;
};
/**
 * Union type representing all possible agent execution results
 * 
 * An agent executor can return:
 * - TaskResult: A completed task
 * - MessageResult: A message response
 * - StreamResult: A streaming task with incremental updates
 * - A2AError: An error condition
 */
export type AgentExecutionResult =
  | TaskResult
  | MessageResult
  | StreamResult
  | A2AError;

/**
 * Represents an agent request with parameters and optional extensions
 */
export type AgentRequest = {
  /** The message parameters from the client */
  params: MessageSendParams;
  /** Optional extension data passed with the request */
  extension?: Record<string, any>;
};

/**
 * Event indicating the end of a task stream
 */
export type EndOfStreamEvent = {
  /** Identifies this as an end-of-stream event */
  kind: "end-of-stream";
  /** Optional task ID */
  taskId?: string;
  /** Optional context ID */
  contextId?: string;
};

/**
 * Union type for all possible agent stream events
 * 
 * Stream events can be:
 * - Streaming message success responses
 * - JSON-RPC errors
 * - End-of-stream events
 */
export type AgentStreamEvent =
  | SendStreamingMessageSuccessResponse["result"]
  | JSONRPCError
  | EndOfStreamEvent;

/** Queue type for agent stream events */
export type AgentStreamQueue = IQueue<AgentStreamEvent>;

/** Factory type for creating new IQueue instances */
export type StreamQueueFactory = () => AgentStreamQueue;

/** Factory type for creating new IStore instances */
export type TaskStoreFactory = () => IStore<Task>;

/**
 * Parameters for creating agent messages
 */
export type AgentMessageParams = {
  /** The content parts of the message */
  parts: Part[];
  /** Optional metadata associated with the message */
  metadata?: Record<string, any>;
};

/**
 * Parameters for task-related operations (reject, start, complete, etc.)
 */
export type AgentTaskParams = {
  /** Optional artifacts to include with the task */
  artifacts?: Artifact[];
  /** Optional message parameters */
  message?: AgentMessageParams;
  /** Optional metadata associated with the task */
  metadata?: Record<string, any>;
};

/**
 * Parameters for streaming artifacts to clients
 */
export type AgentArtifactParams = {
  /** The artifact to stream */
  artifact: Artifact;
  /** Whether to append to existing artifact (default: false) */
  append?: boolean;
  /** Whether this is the final chunk (default: false) */
  lastChunk?: boolean;
};
