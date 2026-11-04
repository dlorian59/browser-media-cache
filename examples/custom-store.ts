import type { BlobStore, MediaKey } from '@59alex/browser-media-cache';

// EN: A minimal custom BlobStore contract example; this store is ephemeral, without expiry or quota.
// RU: Минимальный пример контракта BlobStore; это временное хранилище без срока жизни и квоты.
export class ExampleBlobStore implements BlobStore {
  readonly #namespaces = new Map<string, Map<string, Blob>>();

  async get({ namespace, key }: MediaKey): Promise<Blob | undefined> {
    return this.#namespaces.get(namespace)?.get(key);
  }

  async put({ namespace, key }: MediaKey, blob: Blob): Promise<void> {
    let entries = this.#namespaces.get(namespace);
    if (!entries) {
      entries = new Map();
      this.#namespaces.set(namespace, entries);
    }
    entries.set(key, blob);
  }

  async delete({ namespace, key }: MediaKey): Promise<void> {
    const entries = this.#namespaces.get(namespace);
    entries?.delete(key);
    if (entries?.size === 0) this.#namespaces.delete(namespace);
  }

  async clear(namespace: string): Promise<void> {
    // EN: Namespace cleanup does not affect another account's entries.
    // RU: Очистка namespace не затрагивает записи другого аккаунта.
    this.#namespaces.delete(namespace);
  }
}
