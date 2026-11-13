# Ожидаемые данные для B-14 и B-15

## B-14 — преобразователь

База: `../data/samples/position-report.sample.json`. Все изменения — синтетические.

| № | Входное изменение | Ожидаемый результат |
|---:|---|---|
| 1 | Без изменений | `{ id: "123456789", name: "TRAINING VESSEL", lat: 50.95, lon: 1.42, speedKnots: 12.4, courseDeg: 274.6, timestamp: "2026-11-12T12:00:00.123Z", source: "aisstream" }` |
| 2 | Удалить `MetaData.ShipName` | Судно с `name: null` |
| 3 | `MetaData.ShipName = "   "` | Судно с `name: null` |
| 4 | `Message.PositionReport.Sog = 0` | `speedKnots: 0` |
| 5 | `Sog = 102.3` | `speedKnots: null` |
| 6 | `Sog = -1` | `speedKnots: null` |
| 7 | Удалить `Sog` | `speedKnots: null` |
| 8 | `Cog = 360` | `courseDeg: null` |
| 9 | `Latitude = 91`, `Longitude = 181` | `null` |
| 10 | `Latitude = 95`, `Longitude = -200` | `null` |
| 11 | `Latitude = "50.95"` | `null` |
| 12 | Удалить `MetaData.MMSI` | `null` |
| 13 | `MetaData.MMSI = ""` | `null` |
| 14 | `MetaData.time_utc = "not-a-timestamp"` | `null` |

## B-15 — сборщик снимка

Формат всех ожидаемых судов: `{ id, name, lat, lon, speedKnots: 12.4, courseDeg: 274.6, timestamp, source: "aisstream" }`.

| Имя | id | name | lat | lon | timestamp |
|---|---|---|---:|---:|---|
| A | `111000001` | `VESSEL 111000001` | 50.95 | 1.42 | `2026-01-01T12:00:00.000Z` |
| P1 | `111000002` | `VESSEL 111000002` | 50.95 | 1.42 | `2026-01-01T12:00:00.000Z` |
| P2 | `111000002` | `VESSEL 111000002` | 51.1 | 1.6 | `2026-01-01T12:01:00.000Z` |

Успешный результат также содержит `windowSeconds: 15`.

| № | Входные сообщения / события | Ожидаемый результат |
|---:|---|---|
| 1 | Открыть; передать A дважды; завершить окно на `2026-01-01T12:00:15.000Z` | `vessels: [A]`, `collectedAt: "2026-01-01T12:00:15.000Z"`, `count: 1`, `truncated: false`, `reason: "window_elapsed"` |
| 2 | Сначала P2, затем P1; завершить окно | `vessels: [P2]`, `count: 1`, `truncated: false`, `reason: "window_elapsed"` |
| 3 | Один `id: "111000003"`; сначала `(50.95, 1.42)`, затем `(51.1, 1.6)`; одинаковое время `2026-01-01T12:00:00.000Z`; завершить окно | Остаётся первое судно: `{ id: "111000003", name: "VESSEL 111000003", lat: 50.95, lon: 1.42, speedKnots: 12.4, courseDeg: 274.6, timestamp: "2026-01-01T12:00:00.000Z", source: "aisstream" }`; `count: 1`, `truncated: false`, `reason: "window_elapsed"` |
| 4 | Передать 100 уникальных валидных MMSI, затем `id: "300000001"` | 100 судов; `count: 100`, `truncated: true`, `reason: "limit_reached"`; 101-е не включено |
| 5 | Передать A 100 раз; завершить окно на `2026-01-01T12:00:15.000Z` | `vessels: [A]`, `count: 1`, `truncated: false`, `reason: "window_elapsed"` |
| 6 | Открыть, сообщений нет; завершить окно на `2026-01-01T12:00:15.000Z` | `vessels: []`, `count: 0`, `truncated: false`, `reason: "window_elapsed"` |
| 7 | Не открывать соединение; истечь сроку | Ошибка `code: "connect_failed"` |
| 8 | До открытия отправить событие `error` | Немедленная ошибка `code: "connect_failed"` |
| 9 | Передать 3 валидных судна, затем `{ error: "synthetic provider failure" }` | Ошибка `code: "provider_error"`; частичного набора нет |
| 10 | Передать 3 валидных судна, затем закрыть соединение | Ошибка `code: "disconnected"`; частичного набора нет |
| 11 | Лимит 1; передать 1 судно, затем ошибку источника | Успех с 1 судном; `count: 1`, `truncated: true`, `reason: "limit_reached"`; повторного завершения нет |
| 12 | Открыть соединение; вызвать `AbortController.abort()` до срока | Ошибка `code: "cancelled"`; соединение закрыто, слушатели и таймер очищены; частичного набора нет |
| 13 | Передать `id: "111000006"`, имя `"OLD NAME"`; затем тот же id с более поздним временем, `(51.25, 1.75)`, `name: null`; завершить окно | `{ id: "111000006", name: null, lat: 51.25, lon: 1.75, speedKnots: 12.4, courseDeg: 274.6, timestamp: "2026-01-01T12:01:00.000Z", source: "aisstream" }` |
| 14 | Установить часы на `2026-01-01T12:03:04.567Z`; завершить окно | `collectedAt: "2026-01-01T12:03:04.567Z"` |
| 15 | Завершить по окну, лимиту, ошибке источника, разрыву, отмене | Во всех исходах: `listenerCount: 0`, `pendingTimers: 0`; открытое соединение закрыто |
