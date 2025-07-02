/**
 * Store - A generic key-value store interface for task context and state management
 */
interface IStore<T = any> {
  /**
   * Store a value by key
   * @param key - The key to store the value under
   * @param value - The value to store
   * @param ttl - Optional time-to-live in seconds
   */
  set(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Get a value by key
   * @param key - The key to retrieve
   * @returns The stored value or undefined if not found
   */
  get(key: string): Promise<T | undefined>;

  /**
   * Delete a value by key
   * @param key - The key to delete
   * @returns true if the key was deleted, false if it didn't exist
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   * @param key - The key to check
   */
  has?(key: string): Promise<boolean>;

  /**
   * Clear all values from the store
   */
  clear?(): Promise<void>;

  /**
   * Get all keys in the store
   */
  keys?(): Promise<string[]>;

  /**
   * Get all values in the store
   */
  values?(): Promise<T[]>;

  /**
   * Get all entries (key-value pairs) in the store
   */
  entries?(): Promise<[string, T][]>;
}

export type { IStore };
