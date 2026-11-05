import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpMediaCache, MediaHttpError } from '../dist/index.js';

test('HTTP factory shares a finite response, preserves auth configuration and releases transient URLs', async () => {
  let calls = 0; let configured = 0;
  const cache = createHttpMediaCache({ profile: 'transient', url: ({ namespace, key }) => `https://media.test/${namespace}/${key}`,
    request: ({ namespace }) => { configured++; return { headers: { Authorization: `Bearer ${namespace}` } }; },
    fetch: async (url, init) => {
      calls++; assert.equal(url, 'https://media.test/alice/avatar'); assert.equal(init.headers.Authorization, 'Bearer alice');
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
      return new Response('portrait', { headers: { 'Content-Type': 'image/png' } });
    } });
  try {
    const a = cache.acquire({ namespace: 'alice', key: 'avatar' });
    const b = cache.acquire({ namespace: 'alice', key: 'avatar' });
    const [one, two] = await Promise.all([a.ready, b.ready]);
    assert.equal(one.url, two.url); assert.equal(await one.blob.text(), 'portrait');
    assert.equal(calls, 1); assert.equal(configured, 1); assert.equal(one.blob.type, 'image/png');
    a.release(); assert.equal(cache.inspect().activeHandles, 1);
    b.release(); assert.equal(cache.inspect().retainedBytes, 0);
  } finally { cache.dispose(); }
});

test('declared size is rejected before reading; undeclared/changing-size bodies are bounded by actual bytes', async () => {
  for (const declared of ['100', null]) {
    let cancelled = false;
    const cache = createHttpMediaCache({ url: () => 'https://media.test/a', maxMediaBytes: 4,
      fetch: async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array([1, 2, 3])); controller.enqueue(new Uint8Array([4, 5, 6])); },
        cancel() { cancelled = true; },
      }), { headers: declared === null ? {} : { 'Content-Length': declared } }) });
    try {
      const handle = cache.acquire({ namespace: 'a', key: 'a' });
      await assert.rejects(handle.ready, RangeError);
      assert.equal(cancelled, true); assert.equal(cache.inspect().retainedBytes, 0); handle.release();
    } finally { cache.dispose(); }
  }
});

test('deadline cancels stalled body and a late request callback cannot start fetch', async () => {
  let cancelled = false;
  const cache = createHttpMediaCache({ url: () => 'https://media.test/a', timeoutMs: 15,
    fetch: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
  try {
    const handle = cache.acquire({ namespace: 'a', key: 'a' });
    await assert.rejects(handle.ready, error => error.name === 'TimeoutError');
    assert.equal(cancelled, true); handle.release();
  } finally { cache.dispose(); }
  let finish; let calls = 0;
  const late = createHttpMediaCache({ url: () => 'https://media.test/a', timeoutMs: 15,
    request: () => new Promise(resolve => { finish = resolve; }), fetch: async () => { calls++; return new Response('bad'); } });
  try {
    const handle = late.acquire({ namespace: 'a', key: 'a' });
    await assert.rejects(handle.ready, error => error.name === 'TimeoutError');
    finish({}); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 0); handle.release();
  } finally { late.dispose(); }
});

test('HTTP status survives rejection and cancelling one owner leaves another load alive', async () => {
  const failed = createHttpMediaCache({ url: () => 'https://media.test/a', fetch: async () => new Response('no', { status: 403 }) });
  try {
    const handle = failed.acquire({ namespace: 'a', key: 'a' });
    await assert.rejects(handle.ready, error => error instanceof MediaHttpError && error.status === 403); handle.release();
  } finally { failed.dispose(); }
  let finish; let signal;
  const cache = createHttpMediaCache({ url: () => 'https://media.test/a', fetch: (_url, init) => {
    signal = init.signal; return new Promise(resolve => { finish = resolve; });
  } });
  try {
    const a = cache.acquire({ namespace: 'a', key: 'a' }); const b = cache.acquire({ namespace: 'a', key: 'a' });
    await new Promise(resolve => setImmediate(resolve)); a.release();
    await assert.rejects(a.ready, error => error.name === 'AbortError'); assert.equal(signal.aborted, false);
    finish(new Response('ready')); assert.equal(await (await b.ready).blob.text(), 'ready'); b.release();
  } finally { cache.dispose(); }
});
