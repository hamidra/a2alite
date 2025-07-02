import type {
  Task,
  Message,
  TaskState,
  TaskStatus,
  Artifact,
} from "../../types/types.ts";

import { v4 as uuidv4 } from "uuid";

import type {
  AgentMessageParams,
  AgentRequest,
  AgentTaskParams,
  StreamQueueFactory,
  StreamResult,
} from "./types.ts";
import { AgentTaskStream } from "./stream.ts";

/**
 * Determines if a request should block until completion
 * @param request - The agent request to check
 * @returns true if the request is configured as blocking, false otherwise
 */
function requestIsBlocking(request: AgentRequest): boolean {
  return request.params.configuration?.blocking ?? false;
}

/**
 * Manages the execution context for an agent task, handling task lifecycle,
 * message creation, and streaming functionality.
 */
class AgentExecutionContext {
  /** Unique contextId for this execution context */
  id: string;
  /** The original recieved request that initiated this context */
  public request: AgentRequest;
  /** Factory method for creating stream queues */
  public streamQueueFactory: StreamQueueFactory;
  /** The current active task being processed */
  public currentTask?: Task;
  /** Reference tasks related to this context */
  public referenceTasks?: Task[];

  /**
   * Ensures a current task exists, throwing an error if not
   * @throws Error when no current task is set
   */
  private _ensureTask() {
    if (!this.currentTask) {
      throw new Error(
        "taskId not set. Call accept or start first to initiate a task."
      );
    }
  }

  /**
   * Creates a new AgentExecutionContext
   * @param request - The received request
   * @param streamQueueFactory - Factory for creating stream queues
   * @param task - Optional existing task if the context is running an existing task received from the client
   * @param referenceTasks - Optional reference tasks received from the client
   * @param id - Optional custom context ID, used as a fallback if there is no task or request to extract a contextId from, if not provided a auto generated uuid is used as a fallback.
   */
  constructor(
    request: AgentRequest,
    streamQueueFactory: StreamQueueFactory,
    task?: Task,
    referenceTasks?: Task[],
    id?: string
  ) {
    this.streamQueueFactory = streamQueueFactory;
    this.request = request;
    this.currentTask = task;
    this.referenceTasks = referenceTasks;
    this.id =
      task?.contextId ||
      this.request.params.message.contextId ||
      id ||
      uuidv4();
  }

  /**
   * Creates a message in this context, automatically setting contextId
   * @param messageParams - Message content and metadata
   * @param taskId - Optional task ID
   * @param messageId - Optional custom message ID (auto-generated if not provided)
   * @returns Message with context and task metadata
   */
  private _createMessage(
    messageParams: AgentMessageParams,
    taskId?: string,
    messageId?: string
  ): Message {
    return {
      kind: "message",
      messageId: messageId || uuidv4(),
      parts: messageParams.parts,
      metadata: messageParams.metadata,
      role: "agent",
      contextId: this.id,
      ...(taskId ? { taskId } : {}),
    };
  }

  /**
   * Creates a new task or updates the current task with new parameters
   * @param taskParams - Task parameters including artifacts and metadata
   * @param taskState - New state for the task
   * @param taskId - Optional task ID for new tasks
   * @returns The created or updated task
   */
  private _createStatus(state: TaskState, message?: Message): TaskStatus {
    return {
      state,
      timestamp: new Date().toISOString(),
      ...(message && { message }),
    };
  }

  private _mergeArtifacts(
    existing: Artifact[] = [],
    newArtifacts: Artifact[] = []
  ): Artifact[] {
    return [...(existing || []), ...(newArtifacts || [])];
  }

  private _createOrUpdateTask(
    taskParams: AgentTaskParams | undefined | null,
    taskState: TaskState,
    taskId?: string
  ): Task {
    let currentTask = this.currentTask;
    let id = currentTask?.id || taskId || uuidv4();
    let artifacts = this._mergeArtifacts(
      currentTask?.artifacts || [],
      taskParams?.artifacts || []
    );
    let metadata = taskParams?.metadata || currentTask?.metadata || {};
    const statusMessage = taskParams?.message
      ? this._createMessage(taskParams?.message, id)
      : undefined;
    let status = {
      ...currentTask?.status,
      ...this._createStatus(taskState, statusMessage),
    };
    // use the provided task message as the task status message

    return {
      kind: "task",
      id,
      contextId: this.id,
      artifacts,
      status,
      metadata,
    };
  }

  /**
   * Sets or updates the current task and returns it
   * @param taskParams - Task parameters
   * @param taskState - Task state
   * @param taskId - Optional task ID
   * @returns The updated task
   */
  public setOrUpdateTask(
    taskParams: AgentTaskParams | null | undefined,
    taskState: TaskState,
    taskId?: string
  ): Task {
    let task = this._createOrUpdateTask(taskParams, taskState, taskId);
    this.currentTask = task;
    return task;
  }

  /**
   * Initiates a streaming response with callback execution
   * @param cb - Callback function to handle the task stream
   * @param taskId - Optional task ID
   * @param initialTaskState - Initial state for the task (default: "submitted")
   * @returns Promise resolving to stream result
   */
  public async stream(
    cb: (taskStream: AgentTaskStream) => Promise<void> | void,
    taskId?: string,
    initialTaskState: "submitted" | "working" = "submitted"
  ): Promise<StreamResult> {
    // ToDo: check request.
    // set the task to submitted
    let currentTask = this.setOrUpdateTask(null, initialTaskState, taskId);
    let taskStream = new AgentTaskStream(this);
    // call the callback with the task stream to kickoff the stream async (do not await)
    cb(taskStream);
    return { kind: "stream", taskStream, currentTask };
  }

  /**
   * Rejects the current task with provided parameters
   * @param taskParams - Task parameters including rejection reason
   * @param taskId - Optional task ID
   * @returns The rejected task
   */
  public async reject(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "rejected";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  /**
   * Sets task state to require authentication
   * @param taskParams - Task parameters
   * @param taskId - Optional task ID
   * @returns The task requiring authentication
   */
  public async authRequired(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "auth-required";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  /**
   * Sets task state to require additional input
   * @param taskParams - Task parameters
   * @param taskId - Optional task ID
   * @returns The task requiring input
   */
  public async inputRequired(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "input-required";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  /**
   * Marks the task as completed
   * @param taskParams - Task parameters including completion details
   * @param taskId - Optional task ID
   * @returns The completed task
   */
  public async complete(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "completed";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  /**
   * Creates a standalone message (not associated with a task)
   * @param messageParams - Message content and metadata
   * @param messageId - Optional custom message ID
   * @returns The created message
   */
  public async message(messageParams: AgentMessageParams, messageId?: string) {
    let message = this._createMessage(messageParams, messageId);
    return message;
  }
}

export { requestIsBlocking, AgentExecutionContext };
