# browser-media-cache 0.1.0 — complete reference

[← Guide](en.md) · [RU](reference.ru.md) · [Versions](../index.md) · [README](../../README.md)

## Entry points and prerequisites

| Import | Public exports | Runtime requirement |
|---|---|---|
| @59alex/browser-media-cache | MediaCache; types MediaKey, LoadContext, BlobStore, StoreOperation, StoreFailure, MediaCacheOptions, MediaResource, MediaHandle, AcquireOptions, EntrySnapshot, CacheSnapshot | ES2022, Blob, AbortController/Signal.reason, queueMicrotask, performance, timers, object URL API |
| @59alex/browser-media-cache/cache-storage | CacheStorageStore, CacheStorageStoreOptions | CacheStorage, Request, Response; a secure browser context for native persistence |
| @59alex/browser-media-cache/react | useMedia, MediaState | React ^18.3.1 or ^19.0.0; browser APIs when effects acquire media |
| @59alex/browser-media-cache/package.json | Package metadata | JSON import support of the consumer's toolchain |

Core/storage imports do not access browser globals at module evaluation. Constructing a cache does not load media. Import /react only when React is installed. No object URL support is claimed for Service Workers. Development uses Node 24 and TypeScript 7; no polyfills are shipped.

## Capabilities, source and boundaries

| Mechanism | Executable source | Boundary |
|---|---|---|
| Loader, stable/versioned identity and shared URLs | [createAttachmentCache / mountAttachment](../../examples/attachments.ts) | One instance and exact namespace/key; no HTTP revalidation or global deduplication |
| Per-owner abort and idempotent release | [cancelOnePreview](../../examples/attachments.ts) | Final pending release cancels loader; ignored external work can continue |
| Idle expiry, eviction and accounting | [inspectAttachmentBudget](../../examples/attachments.ts) | Active handles can exceed budgets; decoded media/in-flight buffers are excluded |
| Invalidation, logout and disposal | [refreshAttachment / logoutAttachments / shutdownAttachments](../../examples/attachments.ts) | Explicit invalidation ends active ownership; disposal does not clear storage |
| Native persistence and diagnostic policy | [createAttachmentCache](../../examples/attachments.ts) | Browser quota; per-instance namespace serialization, no cross-tab barrier |
| Custom persistence port | [ExampleBlobStore](../../examples/custom-store.ts) | Demonstration store is ephemeral, with no quota or expiry |
| Custom clock and URL hooks | [createTestCache](../../examples/platform-hooks.ts) | Test URL strings are not displayable media URLs; injected clock must be monotonic |
| React lifecycle | [HookPreview](../../examples/HookPreview.tsx) | Effect-owned resources; no automatic retry or Suspense resource cache |

## MediaCacheOptions

| Field | Default | Contract |
|---|---|---|
| load(context) | Required | Promise<Blob>; context contains namespace, key and the shared loader AbortSignal. Throw/reject on HTTP failure. Authentication, timeouts, MIME checks and response-size limits belong to the loader. |
| idleTtlMs | 30000 | Non-negative safe integer milliseconds from final release. Reacquiring makes the entry active. |
| maxEntries | 128 | Soft target for all tracked entries, including pending ones. Only idle entries can be evicted. |
| maxBytes | 67108864 | Soft target for ready-entry Blob.size, counted once per shared entry. |
| store | None | BlobStore persistence port. Without it the cache is memory-only. |
| persistence | best-effort | Storage-error policy. required rejects on storage failures; it does not create storage when store is absent. |
| onStoreError(failure) | None | Receives operation, namespace, optional key, unknown error. Synchronous throws and rejected callback promises are ignored; async callbacks are not awaited. |
| objectUrls | Native createObjectURL/revokeObjectURL | Custom factory must create a usable URL and revoke without throwing. The test example intentionally supplies non-displayable URLs. |
| now | performance.now | Finite monotonic milliseconds for idle age. It is independent of persistence's wall clock. |

Numeric limits accept zero and reject negative, fractional, infinite or unsafe values. They do not bound active resources or arbitrary loader allocation. Core blobs are materialized whole; use a streaming library for unbounded file transfers.

## Public methods and ownership

| Method | Result | Effect |
|---|---|---|
| acquire({namespace, key, signal?}) | MediaHandle | Non-empty strings identify one shared entry. Optional signal ends only this handle's ownership. Already-aborted signals return a released handle with rejected ready and do not load. |
| invalidate({namespace, key}) | Promise<void> | Ends matching memory ownership synchronously, then follows persistence delete policy. Old releases/completions cannot revoke the replacement generation. |
| invalidateNamespace(namespace) | Promise<void> | Ends all old generations in that namespace before notifying listeners; queues persistence clear before reentrant acquisitions. |
| collect() | void | Applies idle TTL and least-recently-idle budget eviction; safe after disposal. A timer also collects expired idle entries. |
| inspect() | CacheSnapshot | Frozen diagnostics; no ownership or resource acquisition, also available after disposal. |
| dispose() | void | Idempotently aborts pending work, ends all handles, revokes URLs and clears the timer. Future acquire/invalidate calls throw. Existing storage operations may finish. |

MediaHandle exposes ready: Promise<MediaResource>, signal, released and release(). MediaResource contains readonly url and blob. release() is idempotent. A pending ready rejects when ownership ends; after resolution the signal communicates invalidation because a fulfilled promise cannot be undone. Remove UI references before release and listen to signal for forced invalidation. Do not manually revoke cache-owned URLs. Revocation cannot erase decoded pixels or copies already held by application code.

CacheSnapshot fields: disposed, entries, activeHandles, idleEntries, loadingEntries, retainedBytes, overBudget. Each EntrySnapshot contains namespace, key, generation, phase (loading/ready), handles, bytes and idleSince (undefined while active). generation distinguishes entry instances; it is diagnostic, not a persistent revision or security token. idleSince uses the injected monotonic clock. retainedBytes does not measure process heap or persistent storage.

## Persistence port and native adapter

BlobStore implements get(MediaKey): Promise<Blob | undefined>, put(MediaKey, Blob): Promise<void>, delete(MediaKey): Promise<void>, clear(namespace): Promise<void>. Keys passed by the core are frozen public identity objects. A missing item returns undefined. The core serializes operations per namespace inside this instance; a pending put finishes before a queued logout clear. Another instance/tab remains independent.

| CacheStorageStore option | Default | Behavior |
|---|---|---|
| cachePrefix | browser-media-cache:v1: | Non-empty application-reserved prefix; exact encoded namespace appended. |
| maxAgeMs | 86400000 | Non-negative safe integer. Expired/invalid-expiry responses are deleted on read. No background expiry scan. |
| storage | globalThis.caches | Inject CacheStorage for tests or use the browser API. Missing API rejects operations. |
| now | Date.now | Wall-clock milliseconds for expiry; unrelated to the memory idle clock. |

The adapter implements the four BlobStore methods, preserves Blob content type and sends no request to its synthetic .invalid keys. Memory limits do not cap CacheStorage size. Best-effort read/write failure reports diagnostics and uses the loader/memory; delete/clear failure can leave persisted data. Required read/write failure rejects the handle; required delete/clear failure rejects cleanup while memory ownership still ends. Choose required when logout must observe persistent cleanup failure. Namespaces and prefixes are not authentication.

## React hook states and compatibility

useMedia(cache, namespace, key) uses the supplied cache directly. key=null returns idle and acquires nothing. Otherwise its state is loading, ready with resource, or error with unknown error. Changing cache/namespace/key hides the previous resource before replacement effects run. Cleanup releases only the hook's handle. Invalidation yields error; retry by remounting or changing the key/disabled state in a separately committed update. Batching null and the old key in one event does not guarantee a remount.

SSR returns loading/idle without effects. StrictMode's setup/cleanup replay is supported through the same effect ownership, following [React's effect lifecycle](https://react.dev/reference/react/useEffect). The implementation retains React 18 APIs; React 19.3.1, Chromium 156 and Firefox 156 were tested. React 18, Safari, mobile browsers and framework-specific hydration are not tested. React 19's use(promise) is not a drop-in replacement: acquiring a handle during an abandoned render would need a separate owned-resource design. See the [React use reference](https://react.dev/reference/react/use).

## Troubleshooting

| Symptom | Cause and action |
|---|---|
| MediaCache is disposed | The owner shut down the shared instance. Create a new owner-scoped cache; do not dispose it in each component. |
| namespace/key must be a non-empty string | Supply stable logical labels; null disables only the React hook, not acquire. |
| Loader must resolve to a Blob | Return response.blob(), not Response, URL or ArrayBuffer; check response.ok first. |
| CacheStorage is unavailable / SecurityError | Use HTTPS/localhost, inspect browser storage policy, or omit store. |
| QuotaExceededError | Handle onStoreError/required rejection; remove application data under its own prefix. No automatic global quota cleanup exists. |
| overBudget remains true | Inspect activeHandles; active owners are protected. Release unneeded handles or reduce source media size. |
| New version shows old media | Include revision/representation in key, or explicitly invalidate; cache hits intentionally skip loader. |
| URL disappears after logout | Ownership ended. Clear UI and acquire only within a valid current scope. |
| Slow/hung persistence | Store calls are awaited and ordered per namespace. Add a deliberate timeout policy in the adapter; a timed-out write may still take effect. |
| Component loads again in development | StrictMode may replay effects; respect loader signal and keep cache stable. This is not proof of duplicate live ownership. |

[← Guide](en.md) · [Versions](../index.md) · [README](../../README.md)
