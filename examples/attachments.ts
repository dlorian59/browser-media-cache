import { MediaCache, type MediaKey } from '@59alex/browser-media-cache';
import { CacheStorageStore } from '@59alex/browser-media-cache/cache-storage';

// EN: Create once for the browser application; the API authenticates the current session.
// RU: Создайте один раз для браузерного приложения; API аутентифицирует текущую сессию.
export function createAttachmentCache() {
  return new MediaCache({
    load: async ({ key, signal }) => {
      const response = await fetch(`/api/media/${encodeURIComponent(key)}`, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Media HTTP ${response.status}`);
      return response.blob();
    },
    idleTtlMs: 30_000, maxEntries: 128, maxBytes: 64 * 1024 * 1024,
    // EN: Optional persistence is separate from the in-memory byte budget.
    // RU: Необязательное постоянное хранилище отделено от бюджета байтов в памяти.
    store: new CacheStorageStore({ cachePrefix: 'attachments:v1:', maxAgeMs: 60 * 60 * 1000 }),
    persistence: 'required',
  });
}

// EN: Call twice with the same identity to share one load; each returned cleanup owns one handle.
// RU: Два вызова с одной identity разделят загрузку; каждый cleanup владеет одним handle.
export function mountAttachment(image: HTMLImageElement, cache: MediaCache, identity: MediaKey,
  reportError: (error: unknown) => void) {
  const handle = cache.acquire(identity);
  handle.signal.addEventListener('abort', () => image.removeAttribute('src'), { once: true });
  void handle.ready.then(resource => {
    if (!handle.released) image.src = resource.url;
  }, error => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) reportError(error);
  });
  return () => {
    // EN: Remove the element's reference before ending ownership.
    // RU: Уберите ссылку элемента перед завершением владения ресурсом.
    image.removeAttribute('src'); handle.release();
  };
}

export async function cancelOnePreview(cache: MediaCache, identity: MediaKey) {
  const abort = new AbortController();
  const first = cache.acquire({ ...identity, signal: abort.signal });
  const second = cache.acquire(identity);
  try {
    // EN: Cancelling one preview does not cancel the second owner.
    // RU: Отмена одного превью не отменяет владение второго потребителя.
    abort.abort();
    await first.ready.catch(() => undefined);
    await second.ready;
  } finally { first.release(); second.release(); }
}

export function inspectAttachmentBudget(cache: MediaCache) {
  // EN: Active owners may exceed the soft budget; only idle entries can be evicted.
  // RU: Активные владельцы могут превышать мягкий бюджет; вытесняются только неиспользуемые записи.
  cache.collect();
  return cache.inspect();
}

export async function refreshAttachment(cache: MediaCache, identity: MediaKey) {
  // EN: Invalidate the old revision before acquiring the updated versioned key.
  // RU: Инвалидируйте старую ревизию перед получением обновлённого версионированного ключа.
  await cache.invalidate(identity);
}

export async function logoutAttachments(cache: MediaCache, namespace: string) {
  // EN: Remove the account's UI first, then await required persistent cleanup.
  // RU: Сначала уберите UI аккаунта, затем дождитесь обязательной очистки постоянного хранилища.
  await cache.invalidateNamespace(namespace);
}

export function shutdownAttachments(cache: MediaCache) {
  // EN: Only the application owner disposes a shared cache; React providers do not.
  // RU: Общий кэш уничтожает только владелец приложения; React providers этого не делают.
  cache.dispose();
}
