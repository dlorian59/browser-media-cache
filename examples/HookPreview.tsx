import type { MediaCache } from '@59alex/browser-media-cache';
import { useMedia } from '@59alex/browser-media-cache/react';

// EN: Use the core hook directly when the application already owns its rendering boundary.
// RU: Используйте hook ядра напрямую, если приложению уже принадлежит граница отображения.
export function HookPreview({ cache, namespace, mediaKey }: {
  cache: MediaCache; namespace: string; mediaKey: string | null;
}) {
  const state = useMedia(cache, namespace, mediaKey);
  if (state.status === 'idle') return null;
  if (state.status === 'loading') return <span role="status">Loading preview…</span>;
  if (state.status === 'error') return <span role="status">Preview unavailable</span>;
  return <img src={state.resource.url} alt="Attachment preview" />;
}
