import type {
  AgentArtifactParams,
  AgentStreamQueue,
  AgentTaskParams,
} from "./types.ts";
import { AgentExecutionContext } from "./context.ts";
import type { AgentStreamEvent } from "./types.ts";
import { isJSONRPCError, Task, TaskState } from "../../types/types.ts";

const END_OF_STREAM_EVENT = "end-of-stream";

/**
 * Checks if a task state is final (terminal)
 * 
 * Final states indicate that the task has completed processing and will not
 * transition to any other state. These include successful completion, failures,
 * cancellation, and rejection.
 * 
 * @param state - The task state to check
 * @returns true if the state is final, false otherwise
 */
const isFinalTaskState = (state: TaskState) =>
  ["completed", "failed", "canceled", "rejected"].includes(state);

/**
 * Checks if a task state is pending (requires external input)
 * 
 * Pending states indicate that the task is waiting for external input
 * or authorization before it can continue processing.
 * 
 * @param state - The task state to check
 * @returns true if the state is pending, false otherwise
 */
const isPendingTaskState = (state: TaskState) =>
  ["input-required", "auth-required"].includes(state);

/**
 * Checks if a stream event indicates the end of the stream
 * 
 * @param event - The agent stream event to check
 * @returns true if this is an end-of-stream event, false otherwise
 */
function isEndOfStream(event: AgentStreamEvent): boolean {
  return !isJSONRPCError(event) && event.kind === END_OF_STREAM_EVENT;
}

/**
 * Manages streaming updates for an agent task
 * 
 * AgentTaskStream provides a way to send incremental updates about a task's progress
 * to clients through a queue-based system. It supports artifact streaming, status updates,
 * and automatic stream termination when tasks reach final or pending states.
 */
class AgentTaskStream {
  /** Whether the stream has been closed */
  public closed = false;
  /** The execution context associated with this stream */
  public cx: AgentExecutionContext;
  /** The queue for streaming events */
  public streamQueue: AgentStreamQueue;

  /**
   * Creates a new AgentTaskStream
   * @param cx - The execution context that must have a current task
   * @throws Error if the execution context has no current task
   */
  constructor(cx: AgentExecutionContext) {
    if (!cx.currentTask) {
      throw new Error(
        "Cannot create AgentTaskStream: context has no current task."
      );
    }
    this.cx = cx;
    this.streamQueue = cx.streamQueueFactory();
  }

  /**
   * Terminates the stream if the task is in a pending or final state
   * Sends an end-of-stream event when terminating
   * @private
   */
  private _terminateIfPendingOrFinalState() {
    let task = this.cx.currentTask;
    if (
      task &&
      (isPendingTaskState(task.status.state) ||
        isFinalTaskState(task.status.state))
    ) {
      // close the stream
      this.closed = true;
      // send end of stream event
      this.streamQueue.enqueue({
        kind: END_OF_STREAM_EVENT,
        taskId: task.id,
        contextId: task.contextId,
      });
    }
  }

  /**
   * Ensures the stream is still open for writing
   * @throws Error if the stream has been closed
   * @private
   */
  private _ensureOpen() {
    if (this.closed) {
      throw new Error("Task stream already terminated.");
    }
  }

  /**
   * Sends a task status update event to the stream
   * @private
   */
  async _sendTaskStatusUpdate(): Promise<void> {
    let task = this.cx.currentTask;
    if (task) {
      let final = isFinalTaskState(task.status.state);
      await this.streamQueue.enqueue({
        kind: "status-update",
        taskId: task.id,
        final,
        contextId: task.contextId,
        status: task.status,
      });
    }
    // TODO: log warning if no task is set
  }

  // ToDo: change stream to always guarantee there is a task to not throw an error
  /**
   * Gets the current task associated with this stream
   * @returns The current task
   * @throws Error if no task is found
   */
  public getTask(): Task {
    if (!this.cx.currentTask) {
      throw new Error("No task found");
    }
    return this.cx.currentTask;
  }

  /**
   * Writes an artifact update to the stream
   * 
   * This method sends artifact data to connected clients and automatically
   * sets the task state to 'working' if not already set. It supports both
   * complete artifacts and chunked streaming.
   * 
   * @param params - Artifact parameters
   * @param params.artifact - The artifact to stream
   * @param params.append - Whether to append to existing artifact (default: false)
   * @param params.lastChunk - Whether this is the final chunk (default: false)
   * @param sendTaskStatusUpdate - Whether to send status update (default: true)
   */
  public async writeArtifact(
    { artifact, append = false, lastChunk = false }: AgentArtifactParams,
    sendTaskStatusUpdate = true
  ) {
    this._ensureOpen();
    // Add artifact to the current task and set state to 'working'
    // When streaming, artifacts being streamed through artifact updates and are not kept in the current task. only the state is set.
    // update the task with new artifacts
    let task = this.cx.currentTask;
    if (!task) {
      throw new Error("No task find to stream artifacts to");
    }
    // set the task state to 'working' if not already
    if (task.status.state !== "working") {
      this.cx.setOrUpdateTask({}, "working");
      if (sendTaskStatusUpdate) {
        await this._sendTaskStatusUpdate();
      }
    }
    // Send artifact update event
    await this.streamQueue.enqueue({
      kind: "artifact-update",
      taskId: task.id,
      contextId: this.cx.id,
      artifact,
      append,
      lastChunk,
      metadata: artifact.metadata,
    });

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Sets the task state and sends status update if changed
   * @param state - The new task state
   * @throws Error if no task is found
   * @private
   * @todo Use this method to set the task state consistently
   */
  private async _setTaskState(state: TaskState) {
    this._ensureOpen();
    let task = this.cx.currentTask;
    if (!task) {
      throw new Error("No task find to stream artifacts to");
    }
    // if the task state has changed, update it and send the status update
    if (task.status.state !== state) {
      this.cx.setOrUpdateTask({}, state);
      await this._sendTaskStatusUpdate();
    }

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Starts the task with the provided parameters
   * Sets the task state to 'working' and sends status update
   * @param taskParams - Task parameters to update
   */
  public async start(taskParams: AgentTaskParams) {
    this._ensureOpen();
    let task = this.cx.currentTask;
    if (!task) {
      throw new Error("No task find to stream artifacts to");
    }
    // set the task state to 'working' if not already
    if (task.status.state !== "working") {
      this.cx.setOrUpdateTask(taskParams, "working");
      await this._sendTaskStatusUpdate();
    }

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Rejects the task with the provided parameters
   * Sets the task state to 'rejected' and terminates the stream
   * @param taskParams - Task parameters including rejection reason
   */
  public async reject(taskParams: AgentTaskParams) {
    // ensure the stream is open
    this._ensureOpen();
    // set the task state to 'rejected'
    this.cx.setOrUpdateTask(taskParams, "rejected");
    // send the status update
    await this._sendTaskStatusUpdate();

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Marks the task as requiring authentication
   * Sets the task state to 'auth-required' and terminates the stream
   * @param taskParams - Task parameters including auth requirements
   */
  public async authRequired(taskParams: AgentTaskParams) {
    // ensure the stream is open
    this._ensureOpen();
    // set the task state to 'auth-required'
    this.cx.setOrUpdateTask(taskParams, "auth-required");
    // send the status update
    await this._sendTaskStatusUpdate();

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Marks the task as requiring additional input
   * Sets the task state to 'input-required' and terminates the stream
   * @param taskParams - Task parameters including input requirements
   */
  public async inputRequired(taskParams: AgentTaskParams) {
    // ensure the stream is open
    this._ensureOpen();
    // set the task state to 'input-required'
    this.cx.setOrUpdateTask(taskParams, "input-required");
    // send the status update
    await this._sendTaskStatusUpdate();

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }

  /**
   * Completes the task with the provided parameters
   * Sets the task state to 'completed' and terminates the stream
   * @param taskParams - Task parameters including completion details
   */
  public async complete(taskParams: AgentTaskParams) {
    // responding with task mean the task is completed
    this._ensureOpen();
    this.cx.setOrUpdateTask(taskParams, "completed");
    // send the status update
    await this._sendTaskStatusUpdate();

    // check and terminate if the task is in a final or pending state
    this._terminateIfPendingOrFinalState();
  }
}

export { isFinalTaskState, isPendingTaskState, isEndOfStream, AgentTaskStream };
