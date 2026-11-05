import { createHttpMediaCache } from '@59alex/browser-media-cache';

// EN: One application-owned cache; the server checks that the session may read the requested account.
// RU: Один кэш приложения; сервер проверяет право сессии читать данные запрошенного аккаунта.
export function createAttachmentCache() {
  return createHttpMediaCache({
    profile: 'previews',
    url: ({ namespace, key }) => `/api/accounts/${encodeURIComponent(namespace)}/media/${encodeURIComponent(key)}`,
    // EN: A callback runs per network load, so credentials can be current after session refresh.
    // RU: Callback вызывается при каждой сетевой загрузке: после обновления сессии данные актуальны.
    request: () => ({ credentials: 'same-origin' }),
  });
}

// EN: Call the returned cleanup when the view is removed; each view releases only its own handle.
// RU: При удалении представления вызовите cleanup: каждое представление освобождает только свой handle.
export function showAttachment(image: HTMLImageElement, cache: ReturnType<typeof createAttachmentCache>,
  accountId: string, mediaKey: string, onError: (error: unknown) => void) {
  const handle = cache.acquire({ namespace: accountId, key: mediaKey });
  const removeSource = () => image.removeAttribute('src');
  handle.signal.addEventListener('abort', removeSource, { once: true });
  void handle.ready.then(resource => {
    if (!handle.released) image.src = resource.url;
  }, error => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) onError(error);
  });
  return () => { removeSource(); handle.release(); };
}

// EN: First remove the old account's UI, then invalidate its data; only the application owner disposes the cache.
// RU: Сначала уберите UI прошлого аккаунта, затем инвалидируйте данные; dispose вызывает только владелец кэша.
export async function forgetAccount(cache: ReturnType<typeof createAttachmentCache>, accountId: string) {
  await cache.invalidateNamespace(accountId);
}
