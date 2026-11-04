import { MediaCache } from '@59alex/browser-media-cache';

// EN: Deterministic clock and URL ownership hooks for a test harness, not a media-rendering polyfill.
// RU: Управляемые часы и учёт URL для тестового стенда, а не полифил отображения медиа.
export function createTestCache() {
  let now = 0;
  let sequence = 0;
  const urls = new Set<string>();
  const cache = new MediaCache({
    load: async () => new Blob(['fixture']),
    idleTtlMs: 1000,
    now: () => now,
    objectUrls: {
      create() {
        const url = `blob:fixture-${++sequence}`;
        urls.add(url);
        return url;
      },
      revoke(url) { urls.delete(url); },
    },
  });
  return {
    cache,
    urls,
    advance(milliseconds: number) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new RangeError('Expected a non-negative duration');
      now += milliseconds;
      cache.collect();
    },
  };
}
