# browser-media-cache 0.1.0 — полный справочник

[← Руководство](ru.md) · [EN](reference.en.md) · [Версии](../index.md) · [README](../../README.md)

## HTTP-фабрика и профили

[Разбор интеграции](application.ru.md) · [Полный исходник примера](../../examples/http-attachments.ts)

Корневой entry дополнительно экспортирует `createHttpMediaCache`, `MEDIA_CACHE_PROFILES`, `MediaHttpError`, типы `HttpMediaCacheOptions`, `MediaCacheProfile`. Фабрика возвращает прежний `MediaCache`; его методы и владение не изменяются.

| HTTP-параметр | По умолчанию | Контракт |
|---|---|---|
| `url(context)` | Обязателен | Синхронный string/URL resolver; context содержит namespace/key/общий signal. Задаёт конечный авторизованный адрес. |
| `request(context)` | Нет | Sync/async RequestInit при фактической сетевой загрузке, с deadline signal. Credentials/headers принадлежат приложению; только GET без body. |
| `fetch` | Global fetch | Совместимый авторизованный транспорт; соблюдает signal/redirect. |
| `profile` | `previews` | `previews`, `avatars`, `transient`; неизвестное имя вызывает TypeError. |
| `maxMediaBytes` | Из профиля | Положительное безопасное целое; проверка Content-Length и фактических байтов тела. Не ограничивает store hit или декодирование браузером. |
| `timeoutMs` | 30000 | Целое 1..2147483647; дедлайн включает async request config, заголовки и тело. |
| Прежние MediaCacheOptions, кроме `load` | Defaults/профиль | Явные idle/entry/byte budgets переопределяют профиль; storage/hooks/diagnostics переиспользуются. |

Замороженные профили: previews = idle30с, 128 записей, кэш64MiB, HTTP8MiB; avatars = 60с, 256 записей, кэш16MiB, HTTP2MiB; transient = нулевые idle/entries/cache, HTTP8MiB. `MEDIA_CACHE_PROFILES` раскрывает значения для осознанной настройки/своего loader. Фабрика всегда устанавливает GET, signal, cache no-store и redirect error; автоматического retry, обновления авторизации или проверки MIME/кодека нет.

`MediaHttpError.status` содержит HTTP-статус отказа. Слишком большая/неверная объявленная длина или лишние реальные байты приводят к RangeError. Дедлайн — TimeoutError. При ошибке/отмене reader закрывается. Callback, игнорирующий сигнал, может продолжать собственную фоновую работу, но после его завершения поздний запрос не отправляется. Буферизация браузера и создание Blob могут потреблять память сверх счётчика принятых байтов.


## Точки входа и требования

| Импорт | Публичные экспорты | Требования |
|---|---|---|
| @59alex/browser-media-cache | MediaCache, createHttpMediaCache, MEDIA_CACHE_PROFILES, MediaHttpError; типы HttpMediaCacheOptions, MediaCacheProfile, MediaKey, LoadContext, BlobStore, StoreOperation, StoreFailure, MediaCacheOptions, MediaResource, MediaHandle, AcquireOptions, EntrySnapshot, CacheSnapshot | ES2022, Blob, AbortController/Signal.reason, queueMicrotask, performance, таймеры и API object URL |
| @59alex/browser-media-cache/cache-storage | CacheStorageStore, CacheStorageStoreOptions | CacheStorage, Request, Response; безопасный контекст для браузерного хранилища |
| @59alex/browser-media-cache/react | useMedia, MediaState | React ^18.3.1 или ^19.0.0; браузерные API при получении медиа в effects |
| @59alex/browser-media-cache/package.json | Метаданные пакета | Поддержка импорта JSON средствами сборки приложения |

Импорт ядра/адаптера не обращается к браузерным глобальным объектам. Конструктор кэша не загружает медиа. Для /react нужен установленный React. Поддержка object URL в Service Worker не заявляется. Разработка использует Node 24 и TypeScript 7; полифилов нет.

## Возможности, исходники и границы

| Механизм | Исполняемый пример | Граница |
|---|---|---|
| Loader, версионированные ключи, общие URL | [createAttachmentCache / mountAttachment](../../examples/attachments.ts) | Один экземпляр и точный namespace/key; без HTTP revalidation и глобальной дедупликации |
| Отмена владельца и повторный release | [cancelOnePreview](../../examples/attachments.ts) | Последний pending handle отменяет loader; внешняя работа может проигнорировать сигнал |
| Idle TTL, вытеснение и счётчики | [inspectAttachmentBudget](../../examples/attachments.ts) | Активные handles могут превышать бюджет; декодированные медиа и pending-буферы не учитываются |
| Инвалидация, logout и dispose | [refreshAttachment / logoutAttachments / shutdownAttachments](../../examples/attachments.ts) | Инвалидация завершает активное владение; dispose не чистит хранилище |
| Persistence и диагностика | [createAttachmentCache](../../examples/attachments.ts) | Квота браузера и очередь namespace одного экземпляра; без межвкладочного барьера |
| Свой адаптер хранения | [ExampleBlobStore](../../examples/custom-store.ts) | Учебное временное хранилище без квоты и срока хранения |
| Свои часы и URL factory | [createTestCache](../../examples/platform-hooks.ts) | Тестовые URL нельзя показывать как медиа; часы должны быть монотонными |
| React lifecycle | [HookPreview](../../examples/HookPreview.tsx) | Владение через effects, без автоматического retry или Suspense-кэша |

## MediaCacheOptions

| Поле | По умолчанию | Контракт |
|---|---|---|
| load(context) | Обязательно | Promise<Blob>; context содержит namespace, key и общий AbortSignal loader. Ошибку HTTP нужно отклонить. Аутентификация, timeout, проверка MIME и размера ответа принадлежат loader. |
| idleTtlMs | 30000 | Неотрицательные безопасные целые миллисекунды от последнего release. Повторный acquire делает запись активной. |
| maxEntries | 128 | Мягкая цель для всех записей, включая pending; вытесняются только idle. |
| maxBytes | 67108864 | Мягкая цель суммы Blob.size готовых записей; общий ресурс считается один раз. |
| store | Нет | Адаптер BlobStore; без него кэш существует только в памяти. |
| persistence | best-effort | Политика ошибок хранилища. required отклоняет операции при ошибках, но не создаёт хранилище при отсутствии store. |
| onStoreError(failure) | Нет | operation, namespace, необязательный key, unknown error. Исключения и rejected Promise callback игнорируются; асинхронный callback не ожидается. |
| objectUrls | Нативные createObjectURL/revokeObjectURL | Factory создаёт пригодный URL; revoke не должен бросать исключение. Учебный тестовый пример выдаёт непригодные для отображения URL. |
| now | performance.now | Конечные монотонные миллисекунды для idle-возраста; независимы от часов persistence. |

Числовые лимиты допускают ноль и отклоняют отрицательные, дробные, бесконечные или небезопасные значения. Они не ограничивают активные ресурсы или память loader. Blob загружается целиком; для неограниченной передачи файлов используйте потоковый транспорт.

## Публичные методы и владение

| Метод | Результат | Действие |
|---|---|---|
| acquire({namespace, key, signal?}) | MediaHandle | Непустые строки задают общую запись. signal завершает только этот handle. Уже отменённый signal возвращает released handle с rejected ready без загрузки. |
| invalidate({namespace, key}) | Promise<void> | Синхронно завершает владение в памяти, затем применяет политику delete. Старые release/результаты не отзывают новый generation. |
| invalidateNamespace(namespace) | Promise<void> | Удаляет все прежние generation области до уведомления listeners; clear ставится в очередь перед повторным acquire из listener. |
| collect() | void | Применяет idle TTL и вытеснение давно неиспользуемых записей; безопасен после dispose. Таймер также собирает expired idle. |
| inspect() | CacheSnapshot | Замороженная диагностика без владения и загрузки, доступна после dispose. |
| dispose() | void | Идемпотентно отменяет pending, завершает handles, отзывает URL и удаляет таймер. Новый acquire/invalidate бросает ошибку. Начатые операции хранилища могут закончиться позже. |

MediaHandle содержит ready: Promise<MediaResource>, signal, released и release(). MediaResource содержит readonly url и blob. release идемпотентен. Пока ready не завершён, потеря владения отклоняет его; после успешного ready об инвалидации сообщает signal — fulfilled Promise нельзя изменить. Перед release убирайте UI-ссылки и слушайте signal для принудительной инвалидации. Не отзывайте URL кэша самостоятельно. Revocation не стирает декодированные пиксели и копии, уже сохранённые приложением.

CacheSnapshot: disposed, entries, activeHandles, idleEntries, loadingEntries, retainedBytes, overBudget. EntrySnapshot: namespace, key, generation, phase (loading/ready), handles, bytes, idleSince (undefined для активной записи). generation различает экземпляры записи; это диагностика, не постоянная ревизия и не security token. idleSince использует монотонные часы. retainedBytes не измеряет heap процесса или persistence.

## Контракт persistence и нативный адаптер

BlobStore реализует get(MediaKey): Promise<Blob | undefined>, put(MediaKey, Blob): Promise<void>, delete(MediaKey): Promise<void>, clear(namespace): Promise<void>. Ядро передаёт замороженные identity-объекты. Отсутствие записи — undefined. Операции каждого namespace последовательно выполняются внутри одного экземпляра: pending put завершается до logout clear. Другие экземпляры/вкладки независимы.

| CacheStorageStore option | По умолчанию | Поведение |
|---|---|---|
| cachePrefix | browser-media-cache:v1: | Непустой префикс приложения; к нему добавляется кодированный namespace. |
| maxAgeMs | 86400000 | Неотрицательное безопасное целое; expired/невалидная expiry-запись удаляется при чтении. Фонового обхода нет. |
| storage | globalThis.caches | Инъекция CacheStorage либо API браузера; отсутствие отклоняет операции. |
| now | Date.now | Миллисекунды календарных часов для expiry; не часы memory idle. |

Адаптер реализует четыре метода BlobStore, сохраняет content type и не отправляет запросы по синтетическим .invalid-ключам. Memory-лимиты не ограничивают CacheStorage. Best-effort read/write сообщает ошибку и использует loader/память; ошибка delete/clear может оставить постоянные данные. Required read/write отклоняет handle; required delete/clear отклоняет cleanup, но завершает владение в памяти. Для наблюдаемой ошибки persistent logout выбирайте required. Namespace и prefix не заменяют аутентификацию.

## React hook и совместимость

useMedia(cache, namespace, key) использует переданный кэш. key=null возвращает idle без получения ресурса. Иначе состояние loading, ready с resource либо error с unknown error. Смена cache/namespace/key скрывает старый ресурс до replacement effects. Cleanup освобождает только handle hook. Инвалидация даёт error; повтор выполняется remount либо сменой key/disabled в отдельно завершённом обновлении. Объединённые null и старый key в одном событии не гарантируют remount.

SSR возвращает loading/idle без effects. Replay setup/cleanup в StrictMode поддерживается тем же владением, согласно [lifecycle effects React](https://react.dev/reference/react/useEffect). Сохранён API React 18; проверены React 19.3.1, Chromium 156 и Firefox 156. React 18, Safari, мобильные браузеры и hydration конкретного фреймворка не проверены. React 19 use(promise) не является прямой заменой: получение handle в прерванном render потребовало бы отдельного механизма владения. [Документация use](https://react.dev/reference/react/use).

## Устранение проблем

| Симптом | Причина и действие |
|---|---|
| MediaCache is disposed | Владелец закрыл общий экземпляр. Создайте новый кэш области владельца; не вызывайте dispose в каждом компоненте. |
| namespace/key must be a non-empty string | Передайте стабильные непустые ключи; null отключает только React hook, не acquire. |
| Loader must resolve to a Blob | Возвращайте response.blob(), не Response/URL/ArrayBuffer; сначала проверяйте response.ok. |
| CacheStorage is unavailable / SecurityError | Используйте HTTPS/localhost, проверьте browser policy либо уберите store. |
| QuotaExceededError | Обработайте onStoreError/required rejection и удалите данные своего префикса. Общей автоматической очистки квоты нет. |
| overBudget остаётся true | Посмотрите activeHandles; они защищены. Освободите ненужные handles или уменьшите размер источника. |
| Новая версия показывает старое медиа | Включите ревизию/размер в key либо инвалидируйте; попадание в кэш пропускает loader. |
| URL исчез после logout | Владение закончено. Уберите UI и получайте ресурс только в актуальной области. |
| Persistence зависает | Операции ожидаются и идут по очереди namespace. Определите timeout в адаптере; запись после timeout всё ещё может выполниться. |
| Повторная загрузка при разработке | StrictMode может повторить effects. Уважайте signal loader и держите cache стабильным; это не доказывает дублирование активного владения. |

[← Руководство](ru.md) · [Версии](../index.md) · [README](../../README.md)
