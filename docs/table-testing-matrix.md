# Матрица проверок таблицы

Политика уровней gate согласована с [table-subsystem.md](table-subsystem.md) (раздел **Ворота качества**).

## Уровни gate

### До merge (блокер PR)

Обязательны без diagnostics:

- `python3 -m backend.tools.validate_config --json`
- `npm --prefix tooling/vite run type-holes`
- `npm --prefix tooling/vite run typecheck:table`
- `npm --prefix tooling/vite run typecheck`
- `npm --prefix tooling/vite run build`

**При падении:** исправить в PR; ошибки `type-holes` / `typecheck` / `typecheck:table` **не** переводить в произвольные suppressions и без согласования не ослаблять strictness.

### До релиза

- Полный приёмочный прогон тестового стека проекта: **`tests/run.sh`** (в том составе, который зафиксирован для релиза в CI/процессе; для table-relevant регрессии — как минимум `tests/run.sh specs/tables/table-widgets.spec.ts`, если отдельный срез допустим).
- `tests/specs/tables/table-remote-gates.spec.ts` — API/DOM gate для remote/paged inline-giant: лимит `source` в `/api/page`, bounded `tbody tr`.
- `tests/specs/tables/table-million-jump.spec.ts` — синтетический `total` 1M (патч `/api/page` + tail `table-query`): прыжок к строке 999999, bounded DOM; guard шаблона `visibleCellGrid`.
- `python3 -m unittest tests.backend.test_table_runtime` — fingerprint Python/TS, `export_table_window`/prepare attrs, смена `view_id` при sort.
- `tests/specs/tables/table-network.spec.ts` — сортировка remote-таблицы даёт `/api/table-query`; `scrollToDisplayRow` к хвосту даёт запрос с `offset` далеко от нуля.
- Playwright suite `tests/specs/tables/table-widgets.spec.ts` покрывает в том числе: render flags, сортировку, virtual DOM cap, 10k formatted table samples, базовое редактирование, действия embedded-ячеек, Excel-like row selection/delete, range paste, часть context menu, переключение line numbers, grouping-row menu. Расширять автотесты предпочтительнее, чем раздувать ручной чеклист.
- Для remote/paged таблиц hard gates: bounded attrs/page payload, `/api/table-query` window correctness, stale response guard, no frontend full-load for sort/group/search/format-column, DOM cap на 100k/1M fixture.

**При падении:** починить поведение **или** обновить spec и ожидания **явно** в том же PR (описание, зачем поменялся контракт); молча менять порог «чтобы прошло» нельзя.

### После крупных изменений в table (ручной smoke)

Запускать **выборочно** при затрагивании sticky, embedded, меню, скролла или визуальных состояний. Не дублировать то, что уже стабильно ловит `table-widgets.spec.ts`.

**При падении:** открыть issue или краткую заметку в бэклоге; если дефект воспроизводимый — добавить строку в Playwright или в раздел «Бэклог: юнит-тесты» ниже.

## Ожидаемое состояние сейчас

- YAML validator проходит без diagnostics.
- Vite build без регрессии по circular chunk warning (если предупреждение появилось — разбирать как дефект сборки).
- Failures из-за удалённых файлов, отсутствующих scripts или устаревших доков — regression, чинить сразу.

## Ручной smoke

Страница для ручной проверки: [pages/2_widget_demo](../pages/2_widget_demo).

Оставить **только то, что не заменено** `table-widgets.spec.ts` или даёт мало стабильности в headless:

| Зона | Что проверить руками |
|------|----------------------|
| **Virtual + sticky** | Полный lifecycle: включение/выключение sticky в runtime, прокрутка контейнера на большие индексы, смена данных/колонок, размонтирование таблицы — thead и virtual window остаются согласованными с измерениями. |
| **Сложные embedded** | Комбинации `list`/`voc` (поиск, мультивыбор если есть), `date`/`time`/`datetime`, обрыв редактирования по клику вне, последовательность open→commit→cancel на одной и той же ячейке. |
| **Визуально / меню / dropdown** | Позиционирование и закрытие context menu при скролле и смене выделения; открытые dropdown в ячейке vs меню страницы; нет ли визуальных артефактов (overflow, z-index), которые E2E не фиксирует. |

Остальное (базовая сортировка, выделение, paste, базовый context menu, virtual spacer behavior, line numbers и т.д.) — опираться на Playwright; при пробелах — дописывать spec.

## Бэклог: юнит-тесты (чистая таблица)

Кандидаты на **юнит-тесты** по чистым модулям (не абстрактное напоминание, а очередь работ). Переносить в код тестов по мере готовности инфраструктуры:

- нормализация selection и row-block behavior;
- TSV serialize/deserialize и граничные случаи paste matrix;
- стабильный sort fallback по `rowId`;
- grouping: `displayRows`, pruning expanded state;
- virtual window + spacer math, measured-height cache, row mapping;
- remote provider mode selection, loaded ranges, stale request guard and query-window merge;
- indexed format rules and declarative selection expressions;
- row-sharded metadata COW and history aliasing;
- начальные срезы runtime state / store;
- явные и сгенерированные `row id` при нормализации строк;
- нормализация recoverable errors.

## Браузерная и E2E-автоматизация

```bash
tests/run.sh specs/tables/table-widgets.spec.ts
```

Новые стабильные table interactions расширяют этот runner; пустые скрипты-заглушки не использовать.
