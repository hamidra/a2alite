import type { Task, Message, TaskState } from "../types/types.ts";

import { v4 as uuidv4 } from "uuid";

import type {
  AgentMessageParams,
  AgentRequest,
  AgentTaskParams,
  StreamQueueFactory,
  StreamResult,
} from "./types.ts";
import { AgentTaskStream } from "./stream.ts";

export function requestIsBlocking(request: AgentRequest): boolean {
  return request.params.configuration?.blocking ?? false;
}

export class AgentExecutionContext {
  id: string;
  public request: AgentRequest;
  public streamQueueFactory: StreamQueueFactory;
  public currentTask?: Task;
  public referenceTasks?: Task[];

  private _ensureTask() {
    if (!this.currentTask) {
      throw new Error(
        "taskId not set. Call accept or start first to initiate a task."
      );
    }
  }

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

  private _newOrUpdatedTask(
    taskParams: AgentTaskParams | undefined | null,
    taskState: TaskState,
    taskId?: string
  ): Task {
    let task: Task;
    if (this.currentTask) {
      // update the current task
      task = {
        ...this.currentTask,
        // merge new artifacts with existing artifacts
        artifacts: [
          ...(this.currentTask.artifacts || []),
          ...(taskParams?.artifacts || []),
        ],
        status: {
          ...this.currentTask.status,
          ...(taskParams?.message
            ? {
                message: this._createMessage(
                  taskParams.message,
                  this.currentTask.id
                ),
              }
            : {}),
          state: taskState,
          timestamp: new Date().toISOString(),
        },
        ...(taskParams?.metadata
          ? { metadata: taskParams.metadata }
          : this.currentTask.metadata
          ? { metadata: this.currentTask.metadata }
          : {}),
      };
    } else {
      // create a new task
      taskId = taskId || uuidv4();
      task = {
        kind: "task",
        id: taskId,
        contextId: this.id,
        ...(taskParams?.artifacts ? { artifacts: taskParams.artifacts } : {}),
        status: {
          state: taskState,
          timestamp: new Date().toISOString(),
          ...(taskParams?.message
            ? { message: this._createMessage(taskParams.message, taskId) }
            : {}),
        },
        ...(taskParams?.metadata ? { metadata: taskParams.metadata } : {}),
      };
    }
    return task;
  }

  public setOrUpdateTask(
    taskParams: AgentTaskParams | null | undefined,
    taskState: TaskState,
    taskId?: string
  ): Task {
    let task = this._newOrUpdatedTask(taskParams, taskState, taskId);
    this.currentTask = task;
    return task;
  }

  // Returns an stream result with the current task being set to submitted if not already set
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

  public async reject(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "rejected";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  public async authRequired(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "auth-required";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  public async inputRequired(taskParams: AgentTaskParams, taskId?: string) {
    let taskState: TaskState = "input-required";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  public async complete(taskParams: AgentTaskParams, taskId?: string) {
    // responding with task mean the task is completed
    let taskState: TaskState = "completed";
    let task = this.setOrUpdateTask(taskParams, taskState, taskId);
    return task;
  }

  public async message(messageParams: AgentMessageParams, messageId?: string) {
    let message = this._createMessage(messageParams, messageId);
    return message;
  }
}
