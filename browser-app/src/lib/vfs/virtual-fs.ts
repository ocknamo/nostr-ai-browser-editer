/**
 * In-memory virtual filesystem for storing repository files.
 * Maps file paths (relative to repo root) to their text content.
 */
export class VirtualFS {
  private files: Map<string, string> = new Map();

  /** Store or overwrite a file at the given path. */
  set(path: string, content: string): void {
    this.files.set(path, content);
  }

  /** Retrieve file content by path. Returns undefined if not found. */
  get(path: string): string | undefined {
    return this.files.get(path);
  }

  /** Remove a file from the filesystem. */
  delete(path: string): void {
    this.files.delete(path);
  }

  /** Return all stored file paths. */
  keys(): string[] {
    return Array.from(this.files.keys());
  }

  /** Remove all files. */
  clear(): void {
    this.files.clear();
  }

  /** Return the total number of stored files. */
  get size(): number {
    return this.files.size;
  }

  /**
   * Serialize the filesystem to a plain object for transfer to the Service Worker.
   * Keys are file paths, values are file contents.
   */
  toSnapshot(): Record<string, string> {
    return Object.fromEntries(this.files);
  }
}

/** Singleton virtual filesystem instance shared across the application. */
export const vfs = new VirtualFS();
