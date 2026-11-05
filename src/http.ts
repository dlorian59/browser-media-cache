import { MediaCache } from './index.js';
import type { LoadContext, MediaCacheOptions } from './index.js';

/** Named budgets for finite media. Active owners can exceed the retained-cache budget. */
export const MEDIA_CACHE_PROFILES = Object.freeze({
  previews: Object.freeze({ idleTtlMs: 30_000, maxEntries: 128, maxBytes: 67_108_864, maxMediaBytes: 8_388_608 }),
  avatars: Object.freeze({ idleTtlMs: 60_000, maxEntries: 256, maxBytes: 16_777_216, maxMediaBytes: 2_097_152 }),
  transient: Object.freeze({ idleTtlMs: 0, maxEntries: 0, maxBytes: 0, maxMediaBytes: 8_388_608 }),
});
export type MediaCacheProfile = keyof typeof MEDIA_CACHE_PROFILES;

export interface HttpMediaCacheOptions extends Omit<MediaCacheOptions, 'load'> {
  readonly url: (context: LoadContext) => string | URL;
  /** Fresh request configuration per actual load; the cache owns GET and cancellation. */
  readonly request?: (context: LoadContext) => RequestInit | Promise<RequestInit>;
  readonly fetch?: typeof fetch;
  readonly profile?: MediaCacheProfile;
  /** Hard limit on bytes read from each HTTP response; independent of retained-cache maxBytes. */
  readonly maxMediaBytes?: number;
  /** Deadline for request configuration, headers and body together. Default: 30 seconds. */
  readonly timeoutMs?: number;
}

export class MediaHttpError extends Error {
  constructor(readonly status: number) {
    super(`Media request failed: HTTP ${status}`);
    this.name = 'MediaHttpError';
  }
}

/** HTTP convenience loader over the same cache/ownership engine; authentication stays in the application. */
export function createHttpMediaCache(options: HttpMediaCacheOptions): MediaCache {
  const { url, request, fetch: fetcher, profile = 'previews', maxMediaBytes: limit, timeoutMs = 30_000, ...cacheOptions } = options;
  if (typeof url !== 'function') throw new TypeError('url must be a function');
  if (!Object.hasOwn(MEDIA_CACHE_PROFILES, profile)) throw new TypeError('Unknown media cache profile');
  const { maxMediaBytes: defaultLimit, ...defaults } = MEDIA_CACHE_PROFILES[profile];
  const maxMediaBytes = limit ?? defaultLimit;
  if (!Number.isSafeInteger(maxMediaBytes) || maxMediaBytes <= 0) throw new RangeError('maxMediaBytes must be a positive safe integer');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) throw new RangeError('timeoutMs must fit a positive platform timer');
  const transport = fetcher ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  return new MediaCache({ ...cacheOptions,
    idleTtlMs: cacheOptions.idleTtlMs ?? defaults.idleTtlMs,
    maxEntries: cacheOptions.maxEntries ?? defaults.maxEntries,
    maxBytes: cacheOptions.maxBytes ?? defaults.maxBytes,
    load: async context => {
    const controller = new AbortController();
    const signal = controller.signal;
    const forwardAbort = () => controller.abort(context.signal.reason);
    context.signal.addEventListener('abort', forwardAbort, { once: true });
    if (context.signal.aborted) forwardAbort();
    const timer = setTimeout(() => controller.abort(new DOMException('Media load timed out', 'TimeoutError')), timeoutMs);
    let onAbort: () => void = () => undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    const download = async () => {
      signal.throwIfAborted();
      const loadContext = { ...context, signal };
      const init = await request?.(loadContext);
      signal.throwIfAborted();
      if (init?.body != null || (init?.method !== undefined && init.method.toUpperCase() !== 'GET')) {
        throw new TypeError('Media loading supports GET without a body');
      }
      const response = await transport(url(loadContext), { ...init, method: 'GET', signal, cache: 'no-store', redirect: 'error' });
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let completed = false;
      const cancelRead = () => { void reader?.cancel(signal.reason).catch(() => undefined); };
      try {
        signal.throwIfAborted();
        if (!response.ok) throw new MediaHttpError(response.status);
        const declared = response.headers.get('Content-Length');
        if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxMediaBytes)) {
          throw new RangeError('Media exceeds maxMediaBytes or has an invalid Content-Length');
        }
        if (!response.body) throw new Error('Media response has no readable body');
        reader = response.body.getReader();
        signal.addEventListener('abort', cancelRead, { once: true });
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let size = 0;
        while (true) {
          signal.throwIfAborted();
          const { value, done } = await reader.read();
          signal.throwIfAborted();
          if (done) break;
          size += value.byteLength;
          if (size > maxMediaBytes) throw new RangeError('Media exceeds maxMediaBytes');
          // EN: Copy accepted bytes; a custom stream may reuse its backing buffer on the next read.
          // RU: Копируем принятые байты: пользовательский stream может переиспользовать буфер.
          chunks.push(new Uint8Array(value));
        }
        completed = true;
        return new Blob(chunks, { type: response.headers.get('Content-Type') ?? '' });
      } catch (error) {
        controller.abort(error);
        throw error;
      } finally {
        signal.removeEventListener('abort', cancelRead);
        if (!completed) {
          void (reader ? reader.cancel() : response.body?.cancel())?.catch(() => undefined);
        }
        reader?.releaseLock();
      }
    };
    try { return await Promise.race([download(), aborted]); }
    finally {
      clearTimeout(timer);
      context.signal.removeEventListener('abort', forwardAbort);
      signal.removeEventListener('abort', onAbort);
    }
  } });
}
