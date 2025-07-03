/**
 * TaskStreamManager: Manages stream consumption for tasks, ensuring only one consumer per task stream.
 * Allows other callers to tap into the ongoing stream and receive new events as they arrive.
 *
 * - Only the first request for a task starts consuming the stream.
 * - Subsequent requests tap into the live stream and receive new events only.
 * - When the stream ends, all tappers are notified and cleaned up.
 */

import type { AgentStreamEvent, AgentStreamQueue } from "../agent/types.ts";
import type { AgentTaskStream } from "../agent/stream.ts";

/**
 * Represents a tapper/listener for the stream.
 * Each tapper gets an async iterator for new events.
 */
type Tapper<T> = {
  queue: Array<T>;
  resolve: ((value: T | undefined) => void) | undefined;
};

class TaskStreamConsumer {
  private tappers: Set<Tapper<AgentStreamEvent>> = new Set();
  private consuming: boolean = false;
  // true when the stream is finished
  private finished: boolean = false;
  private readonly streamQueue: AgentStreamQueue;
  private readonly isEndOfStreamEvent: (event: AgentStreamEvent) => boolean;
  private readonly abortSignal?: AbortSignal;

  constructor(
    taskStream: AgentTaskStream,
    isEndOfStreamEvent: (event: AgentStreamEvent) => boolean,
    abortSignal?: AbortSignal
  ) {
    this.streamQueue = taskStream.streamQueue;
    this.isEndOfStreamEvent = isEndOfStreamEvent;
    this.abortSignal = abortSignal;
  }

  /**
   * Adds a new tapper and returns an async generator for it.
   */
  public async *tap(): AsyncGenerator<AgentStreamEvent> {
    const tapper: Tapper<AgentStreamEvent> = {
      queue: [],
      resolve: undefined,
    };
    this.tappers.add(tapper);
    try {
      while (!this.finished) {
        if (tapper.queue.length > 0) {
          const event = tapper.queue.shift()!;
          yield event;
        } else {
          // wait for a new event
          let event = await new Promise<AgentStreamEvent | undefined>(
            (resolve: (value: AgentStreamEvent | undefined) => void) => {
              tapper.resolve = resolve;
            }
          );
          // tappers are blocked until an event is available.
          // when the stream is finished, the event will be undefined
          if (event) {
            yield event;
          } else {
            break;
          }
        }
      }
    } finally {
      this.tappers.delete(tapper);
    }
  }

  /**
   * Internal: Consumes the source queue and broadcasts events to tappers.
   */
  public async *consume() {
    // if the stream is finished or already consuming, return
    if (this.consuming || this.finished) return;

    // set the stream as consuming
    this.consuming = true;
    try {
      while (!this.abortSignal?.aborted) {
        const event = await this.streamQueue.dequeue();

        // this will not normally happen since the queue is blocking, but if for any reason the event is undefined the streamQueue is closed
        if (!event) {
          break;
        }

        // if the event is the end of stream, break and do not continue
        if (this.isEndOfStreamEvent(event)) {
          break;
        }

        // ToDo: update the task state in the store, if the event is a task update or artifact update.

        // yield the event
        yield event;

        // Broadcast to all tappers
        for (const tapper of this.tappers) {
          //
          if (tapper.resolve) {
            tapper.resolve(event);
          } else {
            tapper.queue.push(event);
          }
        }
      }
    } catch (err) {
      // ToDo: Notify all tappers of error/end
    } finally {
      // set the stream as finished and notify all tappers and clean up
      this.finished = true;
      for (const tapper of this.tappers) {
        if (tapper.resolve) {
          tapper.resolve(undefined);
        }
      }
      this.tappers.clear();
      this.consuming = false;
    }
  }
}

class TaskStreamManager {
  // Map of task ID to consumer
  private consumers: Map<string, TaskStreamConsumer> = new Map();

  public getConsumer(taskId: string): TaskStreamConsumer | undefined {
    return this.consumers.get(taskId);
  }

  public createConsumer(
    taskStream: AgentTaskStream,
    isEndOfStreamEvent: (event: AgentStreamEvent) => boolean,
    abortSignal?: AbortSignal
  ): TaskStreamConsumer {
    const task = taskStream.getTask();
    let consumer = this.consumers.get(task.id);
    if (consumer) {
      throw new Error(`Stream for task ${task.id} is already being consumed`);
    }
    consumer = new TaskStreamConsumer(
      taskStream,
      isEndOfStreamEvent,
      abortSignal
    );
    this.consumers.set(task.id, consumer);
    return consumer;
  }

  public tapOrConsume(
    taskStream: AgentTaskStream,
    isEndOfStreamEvent: (event: AgentStreamEvent) => boolean,
    abortSignal?: AbortSignal
  ): AsyncGenerator<AgentStreamEvent> {
    let consumer = this.consumers.get(taskStream.getTask().id);
    if (consumer) {
      // if the consumer is already created tap into it
      return consumer.tap();
    } else {
      // if the consumer is not created, create it and kick off the consumer
      consumer = this.createConsumer(
        taskStream,
        isEndOfStreamEvent,
        abortSignal
      );
      return consumer.consume();
    }
  }

  /**
   * Optionally, remove a consumer when done (cleanup)
   */
  public remove(taskId: string) {
    this.consumers.delete(taskId);
  }
}

export { TaskStreamConsumer, TaskStreamManager };
