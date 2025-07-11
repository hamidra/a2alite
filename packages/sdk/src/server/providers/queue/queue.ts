/**
 * Generic queue interface for task management and event streaming
 * 
 * IQueue provides a standard interface for enqueueing and dequeueing items
 * with support for blocking operations. It's primarily used for managing
 * agent stream events and task-related communications.
 * 
 * @template T - The type of items stored in this queue
 */
interface IQueue<T> {
  /**
   * Add an item to the queue
   * @param item - The item to enqueue
   */
  enqueue(item: T): Promise<void>;

  /**
   * Remove and return an item from the queue or block until an item is available
   * @returns The dequeued item or undefined if queue is empty
   */
  dequeue(): Promise<T | undefined>;

  /**
   * Get the number of items in the queue
   */
  size?(): Promise<number>;

  /**
   * Check if the queue is empty
   */
  isEmpty?(): Promise<boolean>;

  /**
   * Peek at the next item without removing it
   * @returns The next item or undefined if queue is empty
   */
  peek?(): Promise<T | undefined>;

  /**
   * Free all resources and close the queue
   */
  close?(): Promise<void>;
}

export type { IQueue };
