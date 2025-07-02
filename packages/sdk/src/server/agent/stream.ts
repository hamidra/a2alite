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
 * Checks if a task state is final.
 */
const isFinalTaskState = (state: TaskState) =>
  ["completed", "failed", "canceled", "rejected"].includes(state);

/**
 * Checks if a task state is pending (e.g. input-required, auth-required).
 */
const isPendingTaskState = (state: TaskState) =>
  ["input-required", "auth-required"].includes(state);

function isEndOfStream(event: AgentStreamEvent): boolean {
  return !isJSONRPCError(event) && event.kind === END_OF_STREAM_EVENT;
}

class AgentTaskStream {
  public closed = false;
  public cx: AgentExecutionContext;
  public streamQueue: AgentStreamQueue;

  constructor(cx: AgentExecutionContext) {
    if (!cx.currentTask) {
      throw new Error(
        "Cannot create AgentTaskStream: context has no current task."
      );
    }
    this.cx = cx;
    this.streamQueue = cx.streamQueueFactory();
  }

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

  private _ensureOpen() {
    if (this.closed) {
      throw new Error("Task stream already terminated.");
    }
  }

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
  public getTask(): Task {
    if (!this.cx.currentTask) {
      throw new Error("No task found");
    }
    return this.cx.currentTask;
  }

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

  // ToDo: use this method to set the task state
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
