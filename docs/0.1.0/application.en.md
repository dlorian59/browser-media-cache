# Shared attachments in an existing application

[← README](../../README.md) · [Русский](application.ru.md) · [API reference](reference.en.md) · [Versions](../index.md)

An attachment often appears twice: once in a message and again in a preview panel. The cache lets both views use the same downloaded media without making either view responsible for the other. Start with an HTTP loader and a named profile; only reach for custom storage or loaders when your application needs them.

## Connect the media endpoint

Your application already has a session and an authorized media endpoint. Add `@59alex/browser-media-cache: 0.1.0` to its package.json dependencies. Publication is pending; use the [local package instructions](en.md#setup) for evaluation.

```ts
import { createHttpMediaCache } from '@59alex/browser-media-cache';
const media = createHttpMediaCache({
  url: ({ namespace, key }) => `/api/accounts/${encodeURIComponent(namespace)}/media/${encodeURIComponent(key)}`,
  request: () => ({ credentials: 'same-origin' }),
});
```

The server must check that the signed-in user may read the account and file. The account in a path is not authentication. `request` can asynchronously obtain current credentials using its `signal`; it runs only when a network load is needed. For a custom authorized fetch implementation, pass `fetch`. The factory forces GET, its own cancellation signal, `cache: 'no-store'` and `redirect: 'error'`: select the final endpoint instead of relying on redirects.

The factory checks the HTTP status before consuming the body, rejects an oversized declared Content-Length, then counts actual response bytes. An absent or inaccurate length does not disable the byte limit. The 30-second deadline covers request configuration, headers and body; timeout aborts the operation. The complete Blob becomes a shared resource only after successful loading. Network/decoding buffers and Blob construction can temporarily use additional memory: a per-response limit is not a process-heap guarantee.

## Follow the complete attachment example

[http-attachments.ts](../../examples/http-attachments.ts) is the source to copy into a browser application's media module. Its functions follow the lifetime of a view:

1. `createAttachmentCache` runs once during browser application startup. It uses `previews` and a session-authenticated endpoint; every component receives this same instance.
2. `showAttachment` acquires one handle for a namespace/key and assigns the URL after readiness. Its abort listener removes the DOM reference if invalidation ends ownership.
3. Its returned cleanup removes `src` before releasing the handle. Register that cleanup with your framework or call it when removing the view.
4. `forgetAccount` runs after that account's views are removed. It waits for namespace invalidation, including optional persistent-store cleanup.
5. Call `cache.dispose()` only when the application owner shuts the cache down. A shared widget must not dispose somebody else's instance.

The example includes adjacent EN/RU comments at the lifetime boundaries. For React, the companion [MediaGallery and MediaPreview](https://github.com/dlorian59/browser-media-cache-react/blob/main/docs/0.1.0/application.en.md) supply this rendering and cleanup automatically.

## Choose a profile

| Profile | Suitable for | Maximum HTTP media | Idle lifetime | Retained entries / bytes |
|---|---|---|---|---|
| `previews` (default) | Images and short audio/video attachments | 8 MiB | 30 s | 128 / 64 MiB |
| `avatars` | Many small profile images | 2 MiB | 60 s | 256 / 16 MiB |
| `transient` | Views that must release unused media immediately | 8 MiB | 0 | 0 / 0 |

```ts
const media = createHttpMediaCache({ profile: 'avatars', url: ({ key }) => `/avatars/${encodeURIComponent(key)}` });
```

Every profile has the same default 30-second deadline. Override `maxMediaBytes` or `timeoutMs` when your endpoint has a known requirement. Existing `idleTtlMs`, `maxEntries` and `maxBytes` overrides still work. `MEDIA_CACHE_PROFILES` exposes frozen numeric values when a custom `new MediaCache({ load, ...profile })` needs the same budgets; custom loaders themselves must enforce their own download/deadline limits.

The hard HTTP limit and soft retained budget solve different problems. `maxMediaBytes` rejects one oversized download. The cache evicts only idle resources for `maxBytes` or entry pressure; active owners remain valid and can exceed these targets. Browser decode memory, in-flight buffers and optional persistent storage are outside the retained-byte counter.

## Two views, one download

```ts
const first = media.acquire({ namespace: accountId, key: 'photo:42:v3' });
const second = media.acquire({ namespace: accountId, key: 'photo:42:v3' });
const [a, b] = await Promise.all([first.ready, second.ready]);
// EN: a.url === b.url; removing one view preserves the other owner's resource.
// RU: a.url === b.url; удаление одного представления сохраняет ресурс второго владельца.
first.release();
// Later, when the second view also closes:
second.release();
```

The identity is the pair of namespace and key within one cache instance. Separate instances do not share ownership. Use a versioned key when file contents change: `photo:42:v4` requests a new resource without unexpectedly revoking another view's `v3` URL.

To cancel only one pending view, pass its `AbortSignal` to `acquire` or release its handle. A shared loader continues while another owner needs it; cancelling the last pending owner aborts the load. HTTP callback implementations should observe the signal. A callback that ignores cancellation can keep doing its own work, but the factory will not dispatch a late fetch after the callback finally returns.

## Account changes and authentication

Remove old account views before calling `invalidateNamespace(oldAccountId)`. Changing a namespace isolates future reads but does not erase old data. With a required persistent store, await invalidation and handle its error before treating logout cleanup as complete.

```ts
await media.invalidateNamespace(oldAccountId);
```

For a refreshed session, keep a stable `request` callback that reads the current token, rather than capturing a token at cache creation. Cached media can be served without another network authorization check; invalidate when access ends. Namespaces are labels, not credentials, and caches do not synchronize account revocation across tabs.

## When loading fails

| Symptom | Result and next step |
|---|---|
| HTTP 401/403/404/503 | `MediaHttpError` carries `status`; fix authorization/access or offer an explicit retry. The factory does not refresh credentials or retry automatically. |
| Too many response bytes / invalid Content-Length | `RangeError`; choose an appropriate finite asset or deliberately adjust the response limit. |
| Deadline expires | `DOMException` named `TimeoutError`; the request/body is cancelled. Retry only under your application's policy. |
| Consumer released or invalidated | Ownership ends and its signal aborts. Remove URLs from UI before releasing them. |
| Browser cannot decode a successful Blob | This is an image/player error, not an HTTP-cache failure. Check format/codec; corrected contents need a new key or deliberate invalidation. |

A failed cache entry is removed; acquiring it again can load again. The HTTP factory does not hide errors behind empty or fake successful media.

## Add storage or custom sources when necessary

The same existing `store`, `persistence`, `onStoreError`, platform hooks and diagnostics are accepted by the factory. A persistent hit skips the HTTP loader: the HTTP per-response size/deadline checks apply to downloads, not to already stored Blobs. Choose/trust the storage policy separately. [CacheStorage and quota behavior](en.md#optional-cachestorage), [custom store](../../examples/custom-store.ts), [custom loader and explicit ownership](../../examples/attachments.ts), [platform hooks](../../examples/platform-hooks.ts).

## Validate the source locally

The [development guide](en.md#setup) contains dependency and artifact commands. `npm test` covers sharing, cancellation, rejection limits and deadlines. `npm run test:package` builds a clean non-React consumer. For real browser loading, retry, cache reuse and account replacement, run the companion [attachment gallery](https://github.com/dlorian59/browser-media-cache-react/blob/main/docs/0.1.0/application.en.md#try-the-gallery).

[← README](../../README.md) · [API reference](reference.en.md) · [All capabilities](en.md) · [Versions](../index.md)
