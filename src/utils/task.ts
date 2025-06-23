import { v4 as uuidv4 } from "uuid";
import {
  Task,
  TaskStatus,
  Artifact,
  Message,
  TaskStatusUpdateEvent,
  TaskArtifactUpdateEvent,
  TaskState,
  TaskSchema,
} from "../types/types.js";

export class TaskHandler {
  private task: Partial<Task>;

  constructor(baseTask?: Partial<Omit<Task, "kind">>) {
    this.task = {
      id: baseTask?.id || uuidv4(),
      kind: "task",
      contextId: baseTask?.contextId || undefined,
      status: baseTask?.status || {
        state: "submitted" as TaskState,
        timestamp: new Date().toISOString(),
      },
      artifacts: baseTask?.artifacts || [],
      history: baseTask?.history || [],
      metadata: baseTask?.metadata || {},
    };
  }

  withId(id: string): TaskHandler {
    this.task.id = id;
    return this;
  }

  withContextId(contextId: string): TaskHandler {
    this.task.contextId = contextId;
    return this;
  }

  withStatus(status: TaskStatus): TaskHandler {
    this.task.status = {
      ...status,
      timestamp: status.timestamp || new Date().toISOString(),
    };
    return this;
  }

  handleStatusUpdate(event: TaskStatusUpdateEvent): TaskHandler {
    if (event.taskId !== this.task.id) {
      throw new Error(
        `Task ID mismatch for status update: expected ${this.task.id}, got ${event.taskId}`
      );
    }

    return this.withStatus({
      ...event.status,
    });
  }

  withArtifacts(artifacts: Artifact[]): TaskHandler {
    this.task.artifacts = [...artifacts];
    return this;
  }

  upsertArtifact(artifact: Artifact): TaskHandler {
    if (!this.task.artifacts) {
      this.task.artifacts = [];
    }

    const existingIndex = this.task.artifacts.findIndex(
      (a: Artifact) => a.artifactId === artifact.artifactId
    );

    // ToDo: handle append and lastChunk, maybe using a helper function
    if (existingIndex !== -1) {
      this.task.artifacts[existingIndex] = {
        ...this.task.artifacts[existingIndex],
        ...artifact,
      };
    } else {
      this.task.artifacts.push(artifact);
    }
    return this;
  }

  handleArtifactUpdate(event: TaskArtifactUpdateEvent): TaskHandler {
    if (event.taskId !== this.task.id) return this;

    return this.upsertArtifact(event.artifact);
  }

  withMetadata(metadata: Record<string, any>): TaskHandler {
    this.task.metadata = {
      ...this.task.metadata,
      ...metadata,
    };
    return this;
  }

  withHistory(messages: Message[]): TaskHandler {
    this.task.history = [...messages];
    return this;
  }

  addMessageToHistory(message: Message): TaskHandler {
    if (!this.task.history) {
      this.task.history = [];
    }
    this.task.history.push(message);
    return this;
  }

  getTask(): Task {
    if (!this.task.contextId) {
      throw new Error("Context ID is required for task");
    }
    return TaskSchema.parse(this.task);
  }
}
