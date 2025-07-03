import { IStore } from "./index.ts";

/**
 * In-memory implementation of IStore<T>
 * 
 * InMemoryStore provides a simple, non-persistent storage implementation
 * suitable for development and testing. It supports TTL (time-to-live)
 * with automatic cleanup of expired entries.
 * 
 * @template T - The type of values stored in this store
 */
class InMemoryStore<T = any> implements IStore<T> {
  private store = new Map<string, { value: T; expiresAt?: number }>();

  async set(key: string, value: T, ttl?: number): Promise<void> {
    let expiresAt: number | undefined = undefined;
    if (ttl && ttl > 0) {
      expiresAt = Date.now() + ttl * 1000;
    }
    this.store.set(key, { value, expiresAt });
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(): Promise<string[]> {
    this.cleanupExpired();
    return Array.from(this.store.keys());
  }

  async values(): Promise<T[]> {
    this.cleanupExpired();
    return Array.from(this.store.values()).map((e) => e.value);
  }

  async entries(): Promise<[string, T][]> {
    this.cleanupExpired();
    return Array.from(this.store.entries()).map(([k, v]) => [k, v.value]);
  }

  /**
   * Remove expired entries from the store
   * Called automatically by methods that enumerate the store
   * @private
   */
  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}

export { InMemoryStore };
