import { IQueue } from "./queue.ts";

/**
 * In-memory implementation of IQueue<T>
 * 
 * InMemoryQueue provides a simple, non-persistent queue implementation
 * with support for blocking dequeue operations. When the queue is empty,
 * dequeue operations will block until an item is available or the queue is closed.
 * 
 * @template T - The type of items stored in this queue
 */
class InMemoryQueue<T> implements IQueue<T> {
  /** Internal array storing queue items */
  private items: T[] = [];
  /** Whether the queue has been closed */
  private _isClosed: boolean = false;
  /** Pending promises for blocked dequeue operations */
  private pendingDequeuePromises: Array<(value: T | undefined) => void> = [];

  async dequeue(): Promise<T | undefined> {
    if (this._isClosed) {
      return;
    }
    if (this.items.length === 0) {
      // block and add the promise to the pending list to be resolved when an item is enqueued
      return new Promise<T | undefined>((resolve) => {
        this.pendingDequeuePromises.push(resolve);
      });
    }
    // return the first item
    return this.items.shift()!;
  }

  async enqueue(item: T): Promise<void> {
    this.items.push(item);

    // resolve any pending promises
    this.resolvePendingPromises();
  }

  /**
   * Resolves pending dequeue promises with available items
   * @private
   */
  private resolvePendingPromises() {
    // iterate and resolve any pending promises as long as there are items in the queue
    while (this.pendingDequeuePromises.length > 0 && this.items.length > 0) {
      const resolvePending = this.pendingDequeuePromises.shift()!;
      resolvePending(this.items.shift()!);
    }
  }

  async size(): Promise<number> {
    return this.items.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.items.length === 0;
  }

  async peek(): Promise<T | undefined> {
    if (this.items.length === 0) return undefined;
    return this.items[0];
  }

  /**
   * Closes the queue and resolves any pending promises with undefined
   * Once closed, the queue cannot be used for further operations
   */
  async close(): Promise<void> {
    this.items = [];
    // iterate and resolve any pending promises as long as there are items in the queue
    while (this.pendingDequeuePromises.length > 0) {
      const resolvePending = this.pendingDequeuePromises.shift()!;
      resolvePending(undefined);
    }
    this.pendingDequeuePromises = [];
    this._isClosed = true;
  }
}

export { InMemoryQueue };
