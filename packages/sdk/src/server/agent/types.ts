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

export type TaskResult = Task;
export type MessageResult = Message;

export type StreamResult = {
  kind: "stream";
  taskStream: AgentTaskStream;
  currentTask: Task;
};
export type AgentExecutionResult =
  | TaskResult
  | MessageResult
  | StreamResult
  | A2AError;

export type AgentRequest = {
  params: MessageSendParams;
  extension?: Record<string, any>;
};

export type EndOfStreamEvent = {
  kind: "end-of-stream";
  taskId?: string;
  contextId?: string;
};

export type AgentStreamEvent =
  | SendStreamingMessageSuccessResponse["result"]
  | JSONRPCError
  | EndOfStreamEvent;

export type AgentStreamQueue = IQueue<AgentStreamEvent>;

// Factory type for creating new IQueue instances
export type StreamQueueFactory = () => AgentStreamQueue;
// Factory type for creating new IStore instances
export type TaskStoreFactory = () => IStore<Task>;

/**
 * Parameters passed to the message
 */
export type AgentMessageParams = {
  parts: Part[];
  metadata?: Record<string, any>;
};

/**
 * Parameters passed to the task related response (reject, start, complete,...)
 */
export type AgentTaskParams = {
  artifacts?: Artifact[];
  message?: AgentMessageParams;
  metadata?: Record<string, any>;
};

export type AgentArtifactParams = {
  artifact: Artifact;
  append?: boolean;
  lastChunk?: boolean;
};
