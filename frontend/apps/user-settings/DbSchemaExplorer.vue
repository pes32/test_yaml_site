<template>
  <div class="db-schema-explorer">
    <div class="page-section page-section--bare page-section--box db-schema-explorer__tree-box">
      <div class="card page-section-card u-wide">
        <div class="card-body page-section-body u-wide db-schema-explorer__tree-panel">
          <simple-field-widget
            widget-name="tree_search"
            :widget-config="{ label: 'Поиск', widget: 'str', value: treeSearch, placeholder: 'Фильтр по дереву' }"
            @input="onTreeSearchInput"
          ></simple-field-widget>
          <div class="db-schema-explorer__tree">
            <template v-for="sch in filteredSchemas" :key="sch.name">
              <div class="db-schema-explorer__node db-schema-explorer__node--schema">
                <div class="db-schema-explorer__tree-row" :class="{ 'is-selected': isSchemaRowSelected(sch.name) }">
                  <button
                    type="button"
                    class="db-schema-explorer__chevron-btn"
                    :aria-expanded="expandedSchemas.has(sch.name)"
                    aria-label="Развернуть или свернуть схему"
                    @click.stop="toggleSchemaExpand(sch.name)"
                  >
                    <span class="db-schema-explorer__twisty-chevron" :class="{ 'is-expanded': expandedSchemas.has(sch.name) }">
                      <dropdown-chevron-icon></dropdown-chevron-icon>
                    </span>
                  </button>
                  <button type="button" class="db-schema-explorer__row-label" @click="selectSchemaOnly(sch.name)">
                    <item-icon icon="schema.svg"></item-icon>
                    <span>{{ sch.name }}</span>
                  </button>
                </div>
              </div>
              <template v-if="expandedSchemas.has(sch.name)">
                <div v-for="tbl in sch.tables" :key="sch.name + ':' + tbl.name" class="db-schema-explorer__node db-schema-explorer__node--table">
                  <div
                    class="db-schema-explorer__tree-row db-schema-explorer__tree-row--nested"
                    :class="{ 'is-selected': isTableRowSelected(sch.name, tbl.name) }"
                  >
                    <button
                      type="button"
                      class="db-schema-explorer__chevron-btn"
                      :aria-expanded="expandedTables.has(tableKey(sch.name, tbl.name))"
                      aria-label="Развернуть или свернуть таблицу"
                      @click.stop="toggleTableExpand(sch.name, tbl.name)"
                    >
                      <span class="db-schema-explorer__twisty-chevron" :class="{ 'is-expanded': expandedTables.has(tableKey(sch.name, tbl.name)) }">
                        <dropdown-chevron-icon></dropdown-chevron-icon>
                      </span>
                    </button>
                    <button type="button" class="db-schema-explorer__row-label db-schema-explorer__row-label--nested" @click="selectTableOnly(sch.name, tbl.name)">
                      <item-icon icon="table.svg"></item-icon>
                      <span>{{ tbl.name }}</span>
                    </button>
                  </div>
                  <template v-if="expandedTables.has(tableKey(sch.name, tbl.name))">
                    <button
                      v-for="col in columnsFor(sch.name, tbl.name)"
                      :key="String(col.column_name)"
                      type="button"
                      class="db-schema-explorer__column-pill"
                      :class="{ 'is-selected': isSelectedColumn(sch.name, tbl.name, String(col.column_name)) }"
                      @click="selectColumn(sch.name, tbl.name, String(col.column_name))"
                    >
                      <item-icon icon="table_column.svg"></item-icon>
                      <span>{{ col.column_name }}</span>
                    </button>
                    <div v-if="columnsLoading.has(tableKey(sch.name, tbl.name))" class="db-schema-explorer__hint">Загрузка столбцов…</div>
                  </template>
                </div>
              </template>
            </template>
          </div>
        </div>
      </div>
    </div>
    <div class="card page-section-card u-wide db-schema-explorer__detail-box">
      <template v-if="selection.kind === 'schema'">
        <div class="card-header page-section-header">
          <h5 class="page-section-title">Схема {{ selection.schema }}</h5>
        </div>
        <div class="card-body page-section-body u-wide db-schema-explorer__detail-body db-schema-scroll">
          <div class="db-schema-explorer__toolbar">
            <button type="button" class="widget-button inline-flex-center" @click="openCreateTable">
              <span class="button-inline-icon button-inline-icon--plus" aria-hidden="true"></span>
              Добавить
            </button>
            <button type="button" class="widget-button inline-flex-center" @click="openDropTable">
              <item-icon class="button-inline-icon" icon="remove.svg"></item-icon>
              Удалить
            </button>
          </div>
          <div @click.capture="onSchemaTablesPointer">
            <table-widget widget-name="schemaTablesReadonly" :widget-config="schemaTablesTableConfig" @input="noop"></table-widget>
          </div>
        </div>
      </template>

      <template v-else-if="selection.kind === 'table'">
        <div class="card-header page-section-header">
          <h5 class="page-section-title">{{ selection.schema }}.{{ selection.table }}</h5>
        </div>
        <div class="card-body page-section-body u-wide db-schema-explorer__detail-body db-schema-scroll">
          <div class="db-schema-explorer__toolbar">
            <button type="button" class="widget-button inline-flex-center" @click="openAddColumn">
              <span class="button-inline-icon button-inline-icon--plus" aria-hidden="true"></span>
              Добавить
            </button>
            <button type="button" class="widget-button inline-flex-center" @click="openDropColumn">
              <item-icon class="button-inline-icon" icon="remove.svg"></item-icon>
              Удалить
            </button>
          </div>
          <div @click.capture="onTableColumnsPointer">
            <table-widget widget-name="tableColsReadonly" :widget-config="tableColumnsConfig" @input="noop"></table-widget>
          </div>
          <db-schema-table-constraints
            :schema="selection.schema"
            :table="selection.table"
            :column-names="tableDetailColumnNames"
            :confirm-modal="confirmModal"
            @invalidate-tree="loadTree(false)"
          ></db-schema-table-constraints>
        </div>
      </template>

      <template v-else-if="selection.kind === 'column'">
        <div class="card-header page-section-header">
          <h5 class="page-section-title">{{ selection.schema }}.{{ selection.table }}.{{ selection.column }}</h5>
        </div>
        <div class="card-body page-section-body u-wide db-schema-explorer__detail-body db-schema-scroll">
          <db-schema-column-editor
            :schema="selection.schema"
            :table="selection.table"
            :column="selection.column"
            :column-meta="selectedColumnMeta"
            :confirm-modal="confirmModal"
            @applied="onColumnApplied"
          ></db-schema-column-editor>
        </div>
      </template>

      <template v-else>
        <div class="card-header page-section-header">
          <h5 class="page-section-title">Схема БД</h5>
        </div>
        <div class="card-body page-section-body u-wide db-schema-explorer__detail-body db-schema-scroll">
          <div class="page-empty-placeholder">Выберите схему, таблицу или столбец слева.</div>
        </div>
      </template>
    </div>

    <gui-modal-shell
      :show="genericModal.open"
      :title="genericModal.title"
      content-class="confirm-modal-content"
      @close="closeGenericModal"
    >
      <div v-if="genericModal.bodyText" class="db-schema-explorer__modal-body-text">{{ genericModal.bodyText }}</div>
      <div v-if="genericModal.error" class="db-schema-explorer__modal-error" role="alert">{{ genericModal.error }}</div>
      <simple-field-widget v-if="genericModal.fieldLabel" widget-name="genfld" :widget-config="{ label: genericModal.fieldLabel, widget: 'str', value: genericModal.fieldValue }" @input="onGenericField"></simple-field-widget>
      <voc-widget
        v-if="genericModal.dataTypeFieldVisible"
        widget-name="gen_data_type"
        :widget-config="dataTypeVocConfig"
        @input="onGenericDataTypeField"
      ></voc-widget>
      <simple-field-widget
        v-if="genericModal.dataTypeFieldVisible && addColumnNeedsStringLength"
        widget-name="gen_char_len"
        :widget-config="{ label: 'character_maximum_length', widget: 'int', value: genericModal.characterLengthValue }"
        @input="onGenericCharacterLengthField"
        @live-input="onGenericCharacterLengthField"
      ></simple-field-widget>
      <template v-if="genericModal.dataTypeFieldVisible && addColumnNeedsNumericParams">
        <simple-field-widget
          widget-name="gen_numeric_precision"
          :widget-config="{ label: 'numeric_precision', widget: 'int', value: genericModal.numericPrecisionValue }"
          @input="onGenericNumericPrecisionField"
          @live-input="onGenericNumericPrecisionField"
        ></simple-field-widget>
        <simple-field-widget
          widget-name="gen_numeric_scale"
          :widget-config="{ label: 'numeric_scale', widget: 'int', value: genericModal.numericScaleValue }"
          @input="onGenericNumericScaleField"
          @live-input="onGenericNumericScaleField"
        ></simple-field-widget>
      </template>
      <simple-field-widget
        v-if="genericModal.dataTypeFieldVisible && addColumnNeedsFloatPrecision"
        widget-name="gen_float_precision"
        :widget-config="{ label: 'numeric_precision', widget: 'int', value: genericModal.numericPrecisionValue }"
        @input="onGenericNumericPrecisionField"
        @live-input="onGenericNumericPrecisionField"
      ></simple-field-widget>
      <simple-field-widget
        v-if="genericModal.dataTypeFieldVisible && addColumnNeedsDateTimePrecision"
        widget-name="gen_datetime_precision"
        :widget-config="{ label: 'datetime_precision', widget: 'int', value: genericModal.datetimePrecisionValue }"
        @input="onGenericDateTimePrecisionField"
        @live-input="onGenericDateTimePrecisionField"
      ></simple-field-widget>
      <template v-if="genericModal.dataTypeFieldVisible && addColumnNeedsIntervalParams">
        <list-widget
          widget-name="gen_interval_type"
          :widget-config="{ label: 'interval_type', widget: 'list', source: intervalTypeOptions, value: genericModal.intervalTypeValue, editable: false }"
          @input="onGenericIntervalTypeField"
        ></list-widget>
        <simple-field-widget
          widget-name="gen_interval_precision"
          :widget-config="{ label: 'interval_precision', widget: 'int', value: genericModal.intervalPrecisionValue }"
          @input="onGenericIntervalPrecisionField"
          @live-input="onGenericIntervalPrecisionField"
        ></simple-field-widget>
      </template>
      <list-widget
        v-if="genericModal.nullableFieldVisible"
        widget-name="gen_nullable"
        :widget-config="{ label: 'is_nullable', widget: 'list', source: ['YES', 'NO'], value: genericModal.nullableValue, editable: false }"
        @input="onGenericNullableField"
      ></list-widget>
      <template #footer>
        <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="closeGenericModal">Отмена</button>
        <button
          v-for="btn in genericModal.buttons"
          :key="btn.label"
          type="button"
          class="widget-button confirm-modal-action"
          :class="{ 'confirm-modal-action--secondary': btn.secondary }"
          @click="btn.run()"
        >
          {{ btn.label }}
        </button>
      </template>
    </gui-modal-shell>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { FrontendApiError } from '@frontend/runtime/api_client_core.ts';
import { frontendApiClient } from '@frontend/runtime/api_client.ts';
import { runDbSchemaDdlWithConfirm } from './db_schema_ddl_confirm.ts';
import ListWidget from '@frontend/widgets/ListWidget.vue';
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import TableWidget from '@frontend/widgets/table/TableWidget.vue';
import VocWidget from '@frontend/widgets/voc/VocWidget.vue';
import DropdownChevronIcon from '@frontend/widgets/common/DropdownChevronIcon.vue';
import ItemIcon from '@frontend/widgets/common/ItemIcon.vue';
import DbSchemaColumnEditor from './DbSchemaColumnEditor.vue';
import DbSchemaTableConstraints from './DbSchemaTableConstraints.vue';
import GuiModalShell from './GuiModalShell.vue';
import { pg16DdlDataTypeVocRows } from './pg16_data_types.ts';
import type { ConfirmModalSurface } from '@frontend/widgets/common/confirm_modal_contract.ts';

const props = defineProps<{
  confirmModal: ConfirmModalSurface | null;
}>();

type Row = Record<string, unknown>;
type Selection =
  | { kind: 'none' }
  | { kind: 'schema'; schema: string }
  | { kind: 'table'; schema: string; table: string }
  | { kind: 'column'; schema: string; table: string; column: string };

const selection = ref<Selection>({ kind: 'none' });
const treeItems = ref<Row[]>([]);
const treeSearch = ref('');
const expandedSchemas = ref(new Set<string>());
const expandedTables = ref(new Set<string>());
const columnsCache = ref(new Map<string, Row[]>());
const columnsLoading = ref(new Set<string>());
const selectedSchemaTables = ref(new Map<string, string>());
const selectedTableColumns = ref(new Map<string, string>());

type GenericModalBtn = { label: string; secondary?: boolean; run: () => void };

const genericModal = reactive({
  open: false,
  title: '',
  bodyText: '',
  fieldLabel: '',
  fieldValue: '',
  dataTypeFieldVisible: false,
  dataTypeValue: 'text',
  characterLengthValue: '',
  numericPrecisionValue: '',
  numericScaleValue: '',
  datetimePrecisionValue: '',
  intervalTypeValue: '',
  intervalPrecisionValue: '',
  nullableFieldVisible: false,
  nullableValue: 'YES',
  error: '',
  buttons: [] as GenericModalBtn[],
});

function closeGenericModal(): void {
  genericModal.open = false;
  genericModal.error = '';
}

function openGenericModal(cfg: {
  title: string;
  bodyText?: string;
  fieldLabel?: string;
  fieldValue?: string;
  dataTypeFieldVisible?: boolean;
  dataTypeValue?: string;
  characterLengthValue?: string;
  numericPrecisionValue?: string;
  numericScaleValue?: string;
  datetimePrecisionValue?: string;
  intervalTypeValue?: string;
  intervalPrecisionValue?: string;
  nullableFieldVisible?: boolean;
  nullableValue?: string;
  buttons: GenericModalBtn[];
}): void {
  genericModal.error = '';
  genericModal.title = cfg.title;
  genericModal.bodyText = cfg.bodyText ?? '';
  genericModal.fieldLabel = cfg.fieldLabel ?? '';
  genericModal.fieldValue = cfg.fieldValue ?? '';
  genericModal.dataTypeFieldVisible = cfg.dataTypeFieldVisible ?? false;
  genericModal.dataTypeValue = cfg.dataTypeValue ?? 'text';
  genericModal.characterLengthValue = cfg.characterLengthValue ?? '';
  genericModal.numericPrecisionValue = cfg.numericPrecisionValue ?? '';
  genericModal.numericScaleValue = cfg.numericScaleValue ?? '';
  genericModal.datetimePrecisionValue = cfg.datetimePrecisionValue ?? '';
  genericModal.intervalTypeValue = cfg.intervalTypeValue ?? '';
  genericModal.intervalPrecisionValue = cfg.intervalPrecisionValue ?? '';
  genericModal.nullableFieldVisible = cfg.nullableFieldVisible ?? false;
  genericModal.nullableValue = cfg.nullableValue === 'NO' ? 'NO' : 'YES';
  genericModal.buttons = cfg.buttons;
  genericModal.open = true;
}

function genericFieldTrim(): string {
  return genericModal.fieldValue.trim();
}

function positiveIntValue(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeIntValue(value: unknown): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function typeNeedsCharLength(dataType: string): boolean {
  const normalized = dataType.trim().toLowerCase();
  return ['character varying', 'varchar', 'character', 'char', 'bit', 'bit varying'].includes(normalized);
}

function typeNeedsNumericParams(dataType: string): boolean {
  const normalized = dataType.trim().toLowerCase();
  return normalized === 'numeric' || normalized === 'decimal';
}

function typeNeedsFloatPrecision(dataType: string): boolean {
  return dataType.trim().toLowerCase() === 'float';
}

function typeNeedsDateTimePrecision(dataType: string): boolean {
  return ['timestamp without time zone', 'timestamp with time zone', 'time without time zone', 'time with time zone'].includes(
    dataType.trim().toLowerCase()
  );
}

function typeNeedsIntervalParams(dataType: string): boolean {
  return dataType.trim().toLowerCase() === 'interval';
}

function ddlErrorMessage(err: unknown): string {
  return err instanceof FrontendApiError ? err.message : String(err);
}

function noop(): void {}

function tableKey(schema: string, table: string): string {
  return `${schema}\u0000${table}`;
}

const pgTypeRows = pg16DdlDataTypeVocRows();
const intervalTypeOptions = [
  '',
  'YEAR',
  'MONTH',
  'DAY',
  'HOUR',
  'MINUTE',
  'SECOND',
  'YEAR TO MONTH',
  'DAY TO HOUR',
  'DAY TO MINUTE',
  'DAY TO SECOND',
  'HOUR TO MINUTE',
  'HOUR TO SECOND',
  'MINUTE TO SECOND',
];
const addColumnNeedsStringLength = computed(() => typeNeedsCharLength(genericModal.dataTypeValue));
const addColumnNeedsNumericParams = computed(() => typeNeedsNumericParams(genericModal.dataTypeValue));
const addColumnNeedsFloatPrecision = computed(() => typeNeedsFloatPrecision(genericModal.dataTypeValue));
const addColumnNeedsDateTimePrecision = computed(() => typeNeedsDateTimePrecision(genericModal.dataTypeValue));
const addColumnNeedsIntervalParams = computed(() => typeNeedsIntervalParams(genericModal.dataTypeValue));
const dataTypeVocConfig = computed(() => ({
  label: 'data_type',
  widget: 'voc',
  source: pgTypeRows,
  columns: ['Тип', 'Категория', 'Описание', 'Алиасы'],
  value: genericModal.dataTypeValue,
  placeholder: 'Выберите тип',
}));

const schemasMap = computed(() => {
  const map = new Map<string, Row[]>();
  for (const item of treeItems.value) {
    const sch = String(item.table_schema || '');
    const tbl = String(item.table_name || '');
    if (!sch || !tbl) continue;
    if (!map.has(sch)) map.set(sch, []);
    map.get(sch)!.push(item);
  }
  return map;
});

const filteredSchemas = computed(() => {
  const q = treeSearch.value.trim().toLowerCase();
  const rows: { name: string; tables: { name: string }[] }[] = [];
  for (const [schemaName, tables] of schemasMap.value.entries()) {
    const tableRows = tables
      .filter((t) => String(t.table_type || 'BASE TABLE').includes('TABLE'))
      .map((t) => ({ name: String(t.table_name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!q) {
      rows.push({ name: schemaName, tables: tableRows });
      continue;
    }
    const schemaHit = schemaName.toLowerCase().includes(q);
    const tblFiltered = tableRows.filter((t) => schemaHit || t.name.toLowerCase().includes(q));
    const colParents = new Set<string>();
    if (!schemaHit) {
      for (const tbl of tableRows) {
        const cols = columnsCache.value.get(tableKey(schemaName, tbl.name)) || [];
        if (cols.some((c) => String(c.column_name || '').toLowerCase().includes(q))) {
          colParents.add(tbl.name);
        }
      }
    }
    const merged = tableRows.filter((t) => tblFiltered.some((x) => x.name === t.name) || colParents.has(t.name));
    if (schemaHit || merged.length) {
      rows.push({ name: schemaName, tables: merged.length ? merged : tableRows });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
});

const tableDetailColumnNames = computed(() => {
  const s = selection.value;
  if (s.kind !== 'table') return [];
  const rows = columnsCache.value.get(tableKey(s.schema, s.table)) || [];
  return rows.map((r) => String(r.column_name || '')).filter(Boolean);
});

async function loadTree(resetSelection: boolean): Promise<void> {
  const data = await frontendApiClient.fetchDbSchemaTables();
  treeItems.value = Array.isArray(data.items) ? data.items : [];
  if (resetSelection) {
    columnsCache.value = new Map();
    expandedTables.value = new Set();
    selectedSchemaTables.value = new Map();
    selectedTableColumns.value = new Map();
    selection.value = { kind: 'none' };
    expandedSchemas.value = new Set();
    return;
  }

  const validTables = new Set(
    treeItems.value
      .map((item) => tableKey(String(item.table_schema || ''), String(item.table_name || '')))
      .filter((key) => key !== tableKey('', ''))
  );
  expandedTables.value = new Set([...expandedTables.value].filter((key) => validTables.has(key)));
  columnsCache.value = new Map([...columnsCache.value.entries()].filter(([key]) => validTables.has(key)));
  selectedTableColumns.value = new Map([...selectedTableColumns.value.entries()].filter(([key]) => validTables.has(key)));
}

function toggleSchemaExpand(name: string): void {
  const next = new Set(expandedSchemas.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expandedSchemas.value = next;
}

function selectSchemaOnly(name: string): void {
  selection.value = { kind: 'schema', schema: name };
}

function toggleTableExpand(schema: string, table: string): void {
  const key = tableKey(schema, table);
  const next = new Set(expandedTables.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
    void ensureColumns(schema, table);
  }
  expandedTables.value = next;
}

function selectTableOnly(schema: string, table: string): void {
  selection.value = { kind: 'table', schema, table };
  const next = new Map(selectedSchemaTables.value);
  next.set(schema, table);
  selectedSchemaTables.value = next;
  void ensureColumns(schema, table);
}

function isSchemaRowSelected(schemaName: string): boolean {
  const s = selection.value;
  return s.kind === 'schema' && s.schema === schemaName;
}

function isTableRowSelected(schemaName: string, tableName: string): boolean {
  const s = selection.value;
  if (s.kind === 'table') return s.schema === schemaName && s.table === tableName;
  if (s.kind === 'column') return s.schema === schemaName && s.table === tableName;
  return false;
}

async function ensureColumns(schema: string, table: string): Promise<void> {
  const key = tableKey(schema, table);
  if (columnsCache.value.has(key)) return;
  await refreshTableColumns(schema, table);
}

async function refreshTableColumns(schema: string, table: string): Promise<Row[]> {
  const key = tableKey(schema, table);
  columnsLoading.value.add(key);
  try {
    const data = await frontendApiClient.fetchDbSchemaColumns(schema, table);
    const cols = Array.isArray(data.columns) ? data.columns : [];
    const next = new Map(columnsCache.value);
    next.set(key, cols);
    columnsCache.value = next;
    return cols;
  } finally {
    columnsLoading.value.delete(key);
  }
}

function columnsFor(schema: string, table: string): Row[] {
  return columnsCache.value.get(tableKey(schema, table)) || [];
}

function selectColumn(schema: string, table: string, column: string): void {
  selection.value = { kind: 'column', schema, table, column };
  const nextTables = new Map(selectedSchemaTables.value);
  nextTables.set(schema, table);
  selectedSchemaTables.value = nextTables;
  const nextColumns = new Map(selectedTableColumns.value);
  nextColumns.set(tableKey(schema, table), column);
  selectedTableColumns.value = nextColumns;
  void ensureColumns(schema, table);
}

function isSelectedColumn(schema: string, table: string, column: string): boolean {
  const s = selection.value;
  return s.kind === 'column' && s.schema === schema && s.table === table && s.column === column;
}

const schemaTablesTableConfig = computed(() => {
  const s = selection.value;
  if (s.kind !== 'schema')
    return { widget: 'table', readonly: true, toolbar: false, table_attrs: 't', value: [], readonly_row_selection: true };
  const selectedTable = selectedSchemaTables.value.get(s.schema) || null;
  const tables = (schemasMap.value.get(s.schema) || [])
    .filter((t) => String(t.table_type || '').includes('TABLE'))
    .map((t) => ({
      id: String(t.table_name),
      cells: [String(t.table_name), String(t.table_type)],
    }));
  return {
    widget: 'table',
    auto_width: true,
    readonly: true,
    readonly_row_selection: true,
    ...(selectedTable ? { readonly_selected_row_id: selectedTable } : {}),
    toolbar: false,
    table_attrs: ['table_name /Таблица', 'table_type /Тип'].join('\n'),
    value: tables,
  };
});

const tableColumnsConfig = computed(() => {
  const s = selection.value;
  if (s.kind !== 'table' && s.kind !== 'column')
    return { widget: 'table', readonly: true, toolbar: false, table_attrs: 'c', value: [], readonly_row_selection: true };
  const schema = s.schema;
  const table = s.table;
  const cols = columnsFor(schema, table);
  const highlightId = s.kind === 'column' ? s.column : selectedTableColumns.value.get(tableKey(schema, table)) || null;
  return {
    widget: 'table',
    auto_width: true,
    readonly: true,
    readonly_row_selection: true,
    ...(highlightId != null ? { readonly_selected_row_id: highlightId } : {}),
    toolbar: false,
    table_attrs: ['column_name /Столбец', 'data_type /Тип', 'is_nullable /NULL', 'is_unique /UNIQUE'].join('\n'),
    value: cols.map((c) => ({
      id: String(c.column_name),
      cells: [String(c.column_name || ''), String(c.data_type || ''), String(c.is_nullable || ''), String(c.is_unique || 'NO')],
    })),
  };
});

const selectedColumnMeta = computed(() => {
  const s = selection.value;
  if (s.kind !== 'column') return null;
  return columnsFor(s.schema, s.table).find((c) => String(c.column_name) === s.column) || null;
});

function onTreeSearchInput(payload: { name?: string; value?: unknown }): void {
  if (payload?.name === 'tree_search') treeSearch.value = String(payload.value ?? '');
}

function rowIdFromEvent(event: Event): string | null {
  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest('[data-row-id]');
  if (!(cell instanceof HTMLElement)) return null;
  return String(cell.dataset.rowId || '').trim() || null;
}

function onSchemaTablesPointer(event: Event): void {
  const s = selection.value;
  if (s.kind !== 'schema') return;
  const table = rowIdFromEvent(event);
  if (!table) return;
  const next = new Map(selectedSchemaTables.value);
  next.set(s.schema, table);
  selectedSchemaTables.value = next;
}

function onTableColumnsPointer(event: Event): void {
  const s = selection.value;
  if (s.kind !== 'table') return;
  const column = rowIdFromEvent(event);
  if (!column) return;
  const next = new Map(selectedTableColumns.value);
  next.set(tableKey(s.schema, s.table), column);
  selectedTableColumns.value = next;
}

function onGenericField(payload: { value?: unknown }): void {
  genericModal.fieldValue = String(payload?.value ?? '');
}

function onGenericDataTypeField(payload: { value?: unknown }): void {
  genericModal.dataTypeValue = String(payload?.value ?? '');
  if (!addColumnNeedsStringLength.value) genericModal.characterLengthValue = '';
  if (!addColumnNeedsNumericParams.value && !addColumnNeedsFloatPrecision.value) {
    genericModal.numericPrecisionValue = '';
  }
  if (!addColumnNeedsNumericParams.value) {
    genericModal.numericScaleValue = '';
  }
  if (!addColumnNeedsDateTimePrecision.value) genericModal.datetimePrecisionValue = '';
  if (!addColumnNeedsIntervalParams.value) {
    genericModal.intervalTypeValue = '';
    genericModal.intervalPrecisionValue = '';
  }
}

function onGenericCharacterLengthField(payload: { value?: unknown }): void {
  genericModal.characterLengthValue = String(payload?.value ?? '');
}

function onGenericNumericPrecisionField(payload: { value?: unknown }): void {
  genericModal.numericPrecisionValue = String(payload?.value ?? '');
}

function onGenericNumericScaleField(payload: { value?: unknown }): void {
  genericModal.numericScaleValue = String(payload?.value ?? '');
}

function onGenericDateTimePrecisionField(payload: { value?: unknown }): void {
  genericModal.datetimePrecisionValue = String(payload?.value ?? '');
}

function onGenericIntervalTypeField(payload: { value?: unknown }): void {
  genericModal.intervalTypeValue = String(payload?.value ?? '');
}

function onGenericIntervalPrecisionField(payload: { value?: unknown }): void {
  genericModal.intervalPrecisionValue = String(payload?.value ?? '');
}

function onGenericNullableField(payload: { value?: unknown }): void {
  const value = String(payload?.value ?? '').toUpperCase();
  genericModal.nullableValue = value === 'NO' ? 'NO' : 'YES';
}

async function runDdlPreviewExecute(
  operation: string,
  body: Record<string, unknown>,
  options?: { afterExecute?: () => void | Promise<void>; refreshTree?: boolean }
): Promise<void> {
  const payload = { operation, ...body };
  genericModal.error = '';
  try {
    const preview = await frontendApiClient.previewDbSchemaDdl(payload);
    closeGenericModal();
    await runDbSchemaDdlWithConfirm({
      confirmModal: props.confirmModal,
      payload,
      preview,
      onAfterExecute: async () => {
        if (options?.refreshTree) await loadTree(false);
        await options?.afterExecute?.();
      },
    });
  } catch (err) {
    genericModal.error = ddlErrorMessage(err);
  }
}

function dropTableModalButtons(schema: string): GenericModalBtn[] {
  const table = selectedSchemaTables.value.get(schema) || '';
  const submit = (cascade: boolean) => async () => {
    if (!table) return;
    await runDdlPreviewExecute('drop_table', { schema, table, cascade }, { refreshTree: true });
  };
  return [
    { label: 'Удалить', secondary: true, run: submit(false) },
    { label: 'Каскадное удаление', run: submit(true) },
  ];
}

function dropColumnModalButtons(schema: string, table: string): GenericModalBtn[] {
  const key = tableKey(schema, table);
  const selectedColumn = selectedTableColumns.value.get(key) || '';
  const submit = (cascade: boolean) => async () => {
    const column = selectedColumn || genericFieldTrim();
    if (!column) return;
    await runDdlPreviewExecute('drop_column', { schema, table, column, cascade }, {
      afterExecute: async () => {
        await refreshTableColumns(schema, table);
        selection.value = { kind: 'table', schema, table };
      },
    });
  };
  return [
    { label: 'Удалить', secondary: true, run: submit(false) },
    { label: 'Каскадное удаление', run: submit(true) },
  ];
}

function openCreateTable(): void {
  const s = selection.value;
  if (s.kind !== 'schema') return;
  const schema = s.schema;
  openGenericModal({
    title: `Добавить таблицу для ${schema}`,
    fieldLabel: 'Имя таблицы',
    fieldValue: '',
    bodyText: 'Допустимы только идентификаторы PostgreSQL без кавычек: латинские буквы, цифры, подчёркивание (не с цифры).',
    buttons: [
      {
        label: 'Добавить',
        run: async () => {
          const table = genericFieldTrim();
          if (!table) return;
          await runDdlPreviewExecute('create_table', { schema, table }, { refreshTree: true });
        },
      },
    ],
  });
}

function openDropTable(): void {
  const s = selection.value;
  if (s.kind !== 'schema') return;
  const table = selectedSchemaTables.value.get(s.schema) || '';
  if (!table) {
    genericModal.error = '';
    openGenericModal({
      title: `Удалить таблицу из ${s.schema}?`,
      bodyText: 'Выберите строку таблицы в списке.',
      buttons: [],
    });
    return;
  }
  openGenericModal({
    title: `Удалить таблицу из ${s.schema}?`,
    bodyText: `Вы уверены, что хотите удалить ${table}? Это действие необратимо.`,
    buttons: dropTableModalButtons(s.schema),
  });
}

function openAddColumn(): void {
  const s = selection.value;
  if (s.kind !== 'table') return;
  const { schema, table } = s;
  openGenericModal({
    title: `Добавить столбец в ${schema}.${table}`,
    fieldLabel: 'Имя столбца',
    fieldValue: '',
    buttons: [
      {
        label: 'Далее',
        run: () => {
          const column = genericFieldTrim();
          if (!column) return;
          closeGenericModal();
          void openAddColumnStep2(schema, table, column);
        },
      },
    ],
  });
}

async function openAddColumnStep2(schema: string, table: string, column: string): Promise<void> {
  if (!column) return;
  openGenericModal({
    title: `Тип столбца ${column}`,
    bodyText: 'Выберите тип данных. Дополнительные поля появляются только там, где они реально участвуют в DDL.',
    dataTypeFieldVisible: true,
    dataTypeValue: 'text',
    characterLengthValue: '',
    numericPrecisionValue: '',
    numericScaleValue: '',
    datetimePrecisionValue: '',
    intervalTypeValue: '',
    intervalPrecisionValue: '',
    nullableFieldVisible: true,
    nullableValue: 'YES',
    buttons: [
      {
        label: 'Добавить',
        run: async () => {
          const dt = genericModal.dataTypeValue.trim();
          if (!dt) {
            genericModal.error = 'Укажите тип данных';
            return;
          }
          const characterMaximumLength = typeNeedsCharLength(dt) ? positiveIntValue(genericModal.characterLengthValue) : null;
          const numericPrecision =
            typeNeedsNumericParams(dt) || typeNeedsFloatPrecision(dt) ? positiveIntValue(genericModal.numericPrecisionValue) : null;
          const numericScale = typeNeedsNumericParams(dt) ? nonNegativeIntValue(genericModal.numericScaleValue) : null;
          if (typeNeedsNumericParams(dt) && numericScale != null && numericPrecision == null) {
            genericModal.error = 'numeric_scale можно указать только вместе с numeric_precision';
            return;
          }
          if (typeNeedsFloatPrecision(dt) && numericPrecision != null && (numericPrecision < 1 || numericPrecision > 53)) {
            genericModal.error = 'Для float precision должен быть в диапазоне 1..53';
            return;
          }
          const datetimePrecision = typeNeedsDateTimePrecision(dt) ? nonNegativeIntValue(genericModal.datetimePrecisionValue) : null;
          if (typeNeedsDateTimePrecision(dt) && datetimePrecision != null && datetimePrecision > 6) {
            genericModal.error = 'datetime_precision должен быть в диапазоне 0..6';
            return;
          }
          const intervalPrecision = typeNeedsIntervalParams(dt) ? nonNegativeIntValue(genericModal.intervalPrecisionValue) : null;
          if (typeNeedsIntervalParams(dt) && intervalPrecision != null && intervalPrecision > 6) {
            genericModal.error = 'interval_precision должен быть в диапазоне 0..6';
            return;
          }
          await runDdlPreviewExecute(
            'add_column',
            {
              schema,
              table,
              column,
              data_type: dt,
              character_maximum_length: characterMaximumLength,
              numeric_precision: numericPrecision,
              numeric_scale: numericScale,
              datetime_precision: datetimePrecision,
              interval_type: typeNeedsIntervalParams(dt) ? genericModal.intervalTypeValue : null,
              interval_precision: intervalPrecision,
              is_nullable: genericModal.nullableValue,
              column_default: null,
            },
            {
              afterExecute: async () => {
                const nextExpanded = new Set(expandedTables.value);
                nextExpanded.add(tableKey(schema, table));
                expandedTables.value = nextExpanded;
                await refreshTableColumns(schema, table);
                selectColumn(schema, table, column);
              },
            }
          );
        },
      },
    ],
  });
}

function openDropColumn(): void {
  const s = selection.value;
  if (s.kind !== 'table' && s.kind !== 'column') return;
  const schema = s.schema;
  const table = s.table;
  const column = s.kind === 'column' ? s.column : selectedTableColumns.value.get(tableKey(schema, table)) || '';
  if (column) {
    const next = new Map(selectedTableColumns.value);
    next.set(tableKey(schema, table), column);
    selectedTableColumns.value = next;
  }
  openGenericModal({
    title: `Удалить столбец из ${schema}.${table}?`,
    bodyText: column ? `Вы уверены, что хотите удалить ${column}? Это действие необратимо.` : 'Выберите столбец в таблице или дереве.',
    fieldLabel: column ? '' : 'Имя столбца',
    fieldValue: '',
    buttons: column ? dropColumnModalButtons(schema, table) : [],
  });
}

async function onColumnApplied(patch: Record<string, unknown>): Promise<void> {
  const s = selection.value;
  if (s.kind === 'column') {
    const rows = await refreshTableColumns(s.schema, s.table);
    const requestedColumn = String(patch.column_name || s.column);
    const nextColumn = rows.some((row) => String(row.column_name || '') === requestedColumn)
      ? requestedColumn
      : String(rows[0]?.column_name || '');
    if (nextColumn) {
      selection.value = { kind: 'column', schema: s.schema, table: s.table, column: nextColumn };
      const next = new Map(selectedTableColumns.value);
      next.set(tableKey(s.schema, s.table), nextColumn);
      selectedTableColumns.value = next;
    } else {
      selection.value = { kind: 'table', schema: s.schema, table: s.table };
    }
  }
}

void loadTree(false);
</script>

<style scoped>
:global(.page-tab-content > .user-settings-tab-pane) {
  height: 100%;
  min-height: 0;
}

.db-schema-explorer {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: var(--page-gap, 16px);
  align-items: stretch;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.db-schema-explorer__tree-box,
.db-schema-explorer__detail-box {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  min-width: 0;
}
.db-schema-explorer__tree-box :deep(.page-section-card),
.db-schema-explorer__detail-box {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
/* Перебиваем .page-section-bare .page-section-body { display: block } из layout.css — иначе колонка дерева
   не flex-контейнер, область дерева растёт по контенту и вертикальный скролл не срабатывает. */
.db-schema-explorer .page-section--bare .page-section-body.db-schema-explorer__tree-panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.db-schema-explorer__tree-panel :deep(.widget-container) {
  flex: 0 0 auto;
}
.db-schema-explorer__tree {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.db-schema-explorer__detail-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
.db-schema-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
.db-schema-explorer__tree-row {
  display: flex;
  align-items: stretch;
  gap: var(--space-xs, 4px);
  border-radius: var(--radius-md, 6px);
  margin-bottom: var(--space-2xs, 2px);
}
.db-schema-explorer__tree-row.is-selected {
  background: var(--color-accent-soft, rgba(13, 110, 253, 0.12));
}
.db-schema-explorer__tree-row--nested {
  padding-left: var(--space-sm, 6px);
}
.db-schema-explorer__chevron-btn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted, #666);
}
.db-schema-explorer__row-label {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm, 6px);
  border: none;
  background: transparent;
  padding: var(--space-sm, 6px) var(--space-md, 12px);
  cursor: pointer;
  text-align: left;
  font: inherit;
  border-radius: var(--radius-md, 6px);
}
.db-schema-explorer__node--schema .db-schema-explorer__row-label {
  padding-left: var(--space-xs, 4px);
}
.db-schema-explorer__row-label:hover {
  background: var(--color-bg-soft, rgba(0, 0, 0, 0.04));
}
.db-schema-explorer__row-label--nested {
  padding-left: var(--space-xs, 4px);
}
.db-schema-explorer__twisty-chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  transition: transform 0.18s ease;
  transform: rotate(90deg);
}
.db-schema-explorer__twisty-chevron.is-expanded {
  transform: rotate(180deg);
}
.db-schema-explorer :deep(.page-item-icon) {
  width: var(--icon-size, 24px);
  height: var(--icon-size, 24px);
  color: inherit;
}
.db-schema-explorer :deep(.page-item-icon img) {
  width: var(--icon-size, 24px);
  height: var(--icon-size, 24px);
  object-fit: contain;
}
.db-schema-explorer__tree-row:not(.is-selected) :deep(.page-item-icon img) {
  opacity: 0.6;
  filter: grayscale(1);
}
.db-schema-explorer__tree-row:hover :deep(.page-item-icon img),
.db-schema-explorer__tree-row.is-selected :deep(.page-item-icon img) {
  opacity: 1;
  filter: none;
}
.button-inline-icon {
  margin-right: var(--space-xs, 4px);
}
.button-inline-icon--plus {
  position: relative;
  display: inline-block;
  width: var(--icon-size, 24px);
  height: var(--icon-size, 24px);
  flex: 0 0 var(--icon-size, 24px);
}
.button-inline-icon--plus::before,
.button-inline-icon--plus::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: translate(-50%, -50%);
}
.button-inline-icon--plus::after {
  transform: translate(-50%, -50%) rotate(90deg);
}
.db-schema-explorer__column-pill {
  display: flex;
  align-items: center;
  gap: var(--space-sm, 6px);
  width: calc(100% - 28px);
  margin-left: 36px;
  border: none;
  background: transparent;
  text-align: left;
  padding: var(--space-xs, 4px) var(--space-md, 12px);
  cursor: pointer;
  border-radius: var(--radius-md, 6px);
  font: inherit;
}
.db-schema-explorer__column-pill:hover {
  background: var(--color-bg-soft, rgba(0, 0, 0, 0.05));
}
.db-schema-explorer__column-pill:not(.is-selected) :deep(.page-item-icon img) {
  opacity: 0.6;
  filter: grayscale(1);
}
.db-schema-explorer__column-pill:hover :deep(.page-item-icon img),
.db-schema-explorer__column-pill.is-selected :deep(.page-item-icon img) {
  opacity: 1;
  filter: none;
}
.db-schema-explorer__column-pill.is-selected {
  background: var(--color-accent-soft, rgba(13, 110, 253, 0.12));
}
.db-schema-explorer__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm, 8px);
  margin: 0 0 var(--space-md, 12px);
}
.db-schema-explorer__hint {
  margin-left: 36px;
  font-size: var(--text-xs, 12px);
  opacity: 0.7;
}
.db-schema-explorer__modal-error {
  color: var(--bs-danger, #dc3545);
  margin-bottom: var(--space-sm, 8px);
  font-size: var(--text-sm);
}
.db-schema-explorer__modal-body-text {
  margin-bottom: var(--space-sm, 8px);
}
</style>
