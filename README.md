# browser-media-cache

<details name="readme-language">
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-en-dark.svg"><img src="assets/lang-en-light.svg" width="42" height="26" alt="EN"></picture></summary>

**Shared images and short media attachments, with one download per account and media key.** Use this browser library when the same avatar or attachment appears in several views. Removing one preview does not interrupt another; unused media is released according to a named cache profile.

**0.1.0 · TypeScript · ESM · MIT** · [Application guide](docs/0.1.0/application.en.md) · [API reference](docs/0.1.0/reference.en.md)

## Get started in your application

Add the dependency to your existing `package.json`:

```json
{ "dependencies": { "@59alex/browser-media-cache": "0.1.0" } }
```

The package is not published to npm yet. These are the intended coordinates; [local artifact setup](docs/0.1.0/en.md#setup) is available for evaluation.

```ts
import { createHttpMediaCache } from '@59alex/browser-media-cache';

const media = createHttpMediaCache({
  url: ({ key }) => `/api/media/${encodeURIComponent(key)}`,
});
export function mountPortrait(image: HTMLImageElement, accountId: string,
  showError: (error: unknown) => void) {
  const handle = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
  const clear = () => image.removeAttribute('src');
  handle.signal.addEventListener('abort', clear, { once: true });
  void handle.ready.then(resource => {
    if (!handle.released) image.src = resource.url;
  }, error => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) showError(error);
  });
  // EN: The caller runs this cleanup when the view closes.
  // RU: Вызывающая сторона запускает cleanup при закрытии представления.
  return () => { clear(); handle.release(); };
}
```

`accountId`, `image` and `showError` come from your view. Call `mountPortrait` when mounting it; call the returned cleanup only when the view closes. The [complete attachment example](examples/http-attachments.ts) supplies a mount/cleanup function and account cleanup; the [walkthrough](docs/0.1.0/application.en.md) explains their lifetime. React applications can start directly with [MediaGallery](https://github.com/dlorian59/browser-media-cache-react#readme).

## Choose a sensible media budget

```ts
const avatars = createHttpMediaCache({
  profile: 'avatars',
  url: ({ key }) => `/api/avatars/${encodeURIComponent(key)}`,
});
```

`previews` is the default: up to 8 MiB per HTTP response, a 30-second deadline and a 64 MiB retained-cache target. `avatars` uses a 2 MiB response limit and smaller retained budget. `transient` removes resources after their final owner leaves. [Profiles, limits and overrides](docs/0.1.0/application.en.md#choose-a-profile) · [Full source](examples/http-attachments.ts).

## Reuse a download without coupling views

```ts
const sidebar = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
const message = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
sidebar.release(); // The message still owns its resource.
```

The two views share one load and URL, but release independently. The remaining handle must be released when its view closes. [Ownership and cancellation](docs/0.1.0/application.en.md#two-views-one-download) · [Complete cleanup example](examples/http-attachments.ts).

## Keep credentials current

```ts
const media = createHttpMediaCache({
  url: ({ key }) => `/api/media/${encodeURIComponent(key)}`,
  request: async ({ signal }) => ({
    headers: { Authorization: `Bearer ${await session.accessToken(signal)}` },
  }),
});
```

`session` is your authentication layer. The callback runs on an actual network load; the server still checks access. Namespace names do not authorize requests. [Authentication and account changes](docs/0.1.0/application.en.md#account-changes-and-authentication).

## Remove an account's cached media

```ts
// EN: Unmount that account's views first; await persistent cleanup if configured.
// RU: Сначала уберите представления аккаунта; дождитесь очистки хранилища, если оно подключено.
await media.invalidateNamespace(accountId);
```

Only the application owner calls `media.dispose()` at shutdown. Optional [CacheStorage](docs/0.1.0/en.md#optional-cachestorage), [custom Blob loaders](examples/attachments.ts) and the [React hook](examples/HookPreview.tsx) remain available.

This is a cache for complete, bounded Blobs, not an arbitrarily large file stream. Active owners can exceed the retained budget; decoded media and browser buffers are separate. [Limits and failure handling](docs/0.1.0/application.en.md#when-loading-fails) · [All capabilities](docs/0.1.0/reference.en.md) · [Documentation](docs/index.md) · [MIT](LICENSE).

</details>

<details name="readme-language" open>
<summary><picture><source media="(prefers-color-scheme: dark)" srcset="assets/lang-ru-dark.svg"><img src="assets/lang-ru-light.svg" width="42" height="26" alt="RU"></picture></summary>

**Общие изображения и короткие медиа-вложения с одной загрузкой на аккаунт и ключ медиа.** Библиотека для браузера полезна, когда один аватар или файл показан в нескольких местах. Закрытие одного превью не мешает другому; неиспользуемые медиа освобождаются по выбранному профилю кэша.

**0.1.0 · TypeScript · ESM · MIT** · [Руководство для приложения](docs/0.1.0/application.ru.md) · [Справочник API](docs/0.1.0/reference.ru.md)

## Подключение к приложению

Добавьте зависимость в существующий `package.json`:

```json
{ "dependencies": { "@59alex/browser-media-cache": "0.1.0" } }
```

Пакет пока не опубликован в npm. Это планируемые координаты; для оценки доступна [установка локального артефакта](docs/0.1.0/ru.md#подготовка).

```ts
import { createHttpMediaCache } from '@59alex/browser-media-cache';

const media = createHttpMediaCache({
  url: ({ key }) => `/api/media/${encodeURIComponent(key)}`,
});
export function mountPortrait(image: HTMLImageElement, accountId: string,
  showError: (error: unknown) => void) {
  const handle = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
  const clear = () => image.removeAttribute('src');
  handle.signal.addEventListener('abort', clear, { once: true });
  void handle.ready.then(resource => {
    if (!handle.released) image.src = resource.url;
  }, error => {
    if (!(error instanceof DOMException && error.name === 'AbortError')) showError(error);
  });
  // EN: The caller runs this cleanup when the view closes.
  // RU: Вызывающая сторона запускает cleanup при закрытии представления.
  return () => { clear(); handle.release(); };
}
```

`accountId`, `image` и `showError` принадлежат вашему представлению. Вызовите `mountPortrait` при его подключении, а возвращённый cleanup — только при закрытии. [Полный пример вложений](examples/http-attachments.ts) содержит функции подключения/очистки и выхода из аккаунта; [разбор](docs/0.1.0/application.ru.md) объясняет их время жизни. В React можно сразу использовать [MediaGallery](https://github.com/dlorian59/browser-media-cache-react#readme).

## Выбор бюджета медиа

```ts
const avatars = createHttpMediaCache({
  profile: 'avatars',
  url: ({ key }) => `/api/avatars/${encodeURIComponent(key)}`,
});
```

По умолчанию выбран `previews`: до 8 MiB на HTTP-ответ, срок загрузки 30 секунд и целевой бюджет удерживаемого кэша 64 MiB. У `avatars` ответ ограничен 2 MiB, бюджет кэша меньше. `transient` удаляет ресурс после ухода последнего владельца. [Профили, ограничения и настройка](docs/0.1.0/application.ru.md#выбор-профиля) · [Полный исходник](examples/http-attachments.ts).

## Общая загрузка для независимых представлений

```ts
const sidebar = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
const message = media.acquire({ namespace: accountId, key: 'portrait:42:v3' });
sidebar.release(); // У сообщения остаётся своё владение ресурсом.
```

Два представления используют одну загрузку и URL, но освобождают владение независимо. Оставшийся handle нужно освободить при закрытии его представления. [Владение и отмена](docs/0.1.0/application.ru.md#два-представления-одна-загрузка) · [Полная очистка в примере](examples/http-attachments.ts).

## Актуальная авторизация

```ts
const media = createHttpMediaCache({
  url: ({ key }) => `/api/media/${encodeURIComponent(key)}`,
  request: async ({ signal }) => ({
    headers: { Authorization: `Bearer ${await session.accessToken(signal)}` },
  }),
});
```

`session` — ваша система авторизации. Callback вызывается при фактической сетевой загрузке; сервер по-прежнему проверяет доступ. Название namespace не даёт прав. [Авторизация и смена аккаунта](docs/0.1.0/application.ru.md#аккаунты-и-авторизация).

## Очистка медиа аккаунта

```ts
// EN: Unmount that account's views first; await persistent cleanup if configured.
// RU: Сначала уберите представления аккаунта; дождитесь очистки хранилища, если оно подключено.
await media.invalidateNamespace(accountId);
```

`media.dispose()` при завершении работы вызывает только владелец приложения. Доступны необязательное [CacheStorage](docs/0.1.0/ru.md#необязательный-cachestorage), [свой Blob-загрузчик](examples/attachments.ts) и [React hook](examples/HookPreview.tsx).

Это кэш готовых Blob ограниченного размера, а не потоковая передача сколь угодно больших файлов. Активные владельцы могут превышать бюджет удерживаемого кэша; декодированные медиа и браузерные буферы учитываются отдельно. [Ошибки и границы](docs/0.1.0/application.ru.md#если-загрузка-не-удалась) · [Все возможности](docs/0.1.0/reference.ru.md) · [Документация](docs/index.md) · [MIT](LICENSE).

</details>
