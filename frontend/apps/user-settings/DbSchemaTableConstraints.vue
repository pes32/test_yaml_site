<template>
  <section class="schema-constraints">
    <h6 class="column-editor__section-title">Ограничения (PK / FK)</h6>

    <div class="schema-constraints__block">
      <div class="schema-constraints__head">Первичный ключ</div>
      <div v-if="pk" class="schema-constraints__meta">
        {{ pk.constraint_name }} — ({{ (pk.columns || []).join(', ') }})
      </div>
      <div v-else class="schema-constraints__hint">Не задан</div>
      <div class="schema-constraints__actions">
        <button type="button" class="widget-button inline-flex-center" :disabled="busy || !!pk" @click="openPkModal">
          Добавить PK
        </button>
        <button v-if="pk" type="button" class="widget-button inline-flex-center" :disabled="busy" @click="openDropPkConfirm">
          Удалить PK
        </button>
      </div>
    </div>

    <div class="schema-constraints__block">
      <div class="schema-constraints__head">Внешние ключи</div>
      <div class="schema-constraints__actions schema-constraints__actions--before-list">
        <button type="button" class="widget-button inline-flex-center" :disabled="busy" @click="openFkModal">
          Добавить FK
        </button>
      </div>
      <div v-if="!foreignKeys.length" class="schema-constraints__hint">Нет внешних ключей</div>
      <ul v-else class="schema-constraints__fk-list">
        <li v-for="fk in foreignKeys" :key="fk.constraint_name" class="schema-constraints__fk-item">
          <button
            type="button"
            class="widget-button schema-constraints__fk-delete inline-flex-center"
            :disabled="busy"
            aria-label="Удалить FK"
            title="Удалить FK"
            @click="openDropFkConfirm(fk.constraint_name)"
          >
            <span class="context-menu-item__icon" aria-hidden="true">
              <img class="context-menu-item__img" :src="iconSrc('delete.svg')" alt="">
            </span>
          </button>
          <div class="schema-constraints__fk-text">
            <strong>{{ fk.constraint_name }}</strong>
            — ({{ (fk.columns || []).join(', ') }}) → {{ fk.foreign_schema }}.{{ fk.foreign_table }}
            ({{ (fk.foreign_columns || []).join(', ') }}) · ON DELETE {{ fk.delete_rule }} · ON UPDATE {{ fk.update_rule }}
          </div>
        </li>
      </ul>
    </div>

    <gui-modal-shell
      :show="fkForm.open"
      title="Добавление FOREIGN KEY"
      content-class="confirm-modal-content schema-constraints-dialog"
      @close="fkForm.open = false"
    >
      <p v-if="props.columnNames.length" class="schema-constraints-dialog__hint">
        Столбцы этой таблицы: {{ props.columnNames.join(', ') }}
      </p>
      <div v-if="fkForm.error" class="schema-constraints-dialog__error">{{ fkForm.error }}</div>
      <simple-field-widget
        widget-name="fk_constraint_name"
        :widget-config="fieldConfig('Имя ограничения', fkForm.constraint_name)"
        @input="patchFkField"
      ></simple-field-widget>
      <simple-field-widget
        widget-name="fk_local_columns"
        :widget-config="fieldConfig('Локальные столбцы (через запятую)', fkForm.local_columns)"
        @input="patchFkField"
      ></simple-field-widget>
      <div class="schema-constraints-dialog__row">
        <div class="schema-constraints-dialog__field schema-constraints-dialog__field--grow">
          <simple-field-widget
            widget-name="fk_ref_schema"
            :widget-config="fieldConfig('Схема ссылки', fkForm.ref_schema)"
            @input="patchFkField"
          ></simple-field-widget>
        </div>
        <div class="schema-constraints-dialog__field schema-constraints-dialog__field--grow">
          <simple-field-widget
            widget-name="fk_ref_table"
            :widget-config="fieldConfig('Таблица ссылки', fkForm.ref_table)"
            @input="patchFkField"
          ></simple-field-widget>
        </div>
      </div>
      <simple-field-widget
        widget-name="fk_ref_columns"
        :widget-config="fieldConfig('Столбцы ссылки (через запятую)', fkForm.ref_columns)"
        @input="patchFkField"
      ></simple-field-widget>
      <div class="schema-constraints-dialog__row">
        <div class="schema-constraints-dialog__field schema-constraints-dialog__field--grow">
          <list-widget
            widget-name="fk_on_delete"
            :widget-config="listConfig('ON DELETE', fkForm.on_delete, fkActionsList, false, { editable: false })"
            @input="patchFkField"
          ></list-widget>
        </div>
        <div class="schema-constraints-dialog__field schema-constraints-dialog__field--grow">
          <list-widget
            widget-name="fk_on_update"
            :widget-config="listConfig('ON UPDATE', fkForm.on_update, fkActionsList, false, { editable: false })"
            @input="patchFkField"
          ></list-widget>
        </div>
      </div>
      <template #footer>
        <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="fkForm.open = false">
          Отмена
        </button>
        <button type="button" class="widget-button confirm-modal-action" :disabled="busy" @click="submitFkForm">Дальше…</button>
      </template>
    </gui-modal-shell>

    <gui-modal-shell
      :show="pkForm.open"
      title="Добавление PRIMARY KEY"
      content-class="confirm-modal-content schema-constraints-dialog"
      @close="pkForm.open = false"
    >
      <p v-if="pkHintLines.length" class="schema-constraints-dialog__hint">{{ pkHintLines.join(' ') }}</p>
      <div v-if="pkForm.error" class="schema-constraints-dialog__error">{{ pkForm.error }}</div>
      <simple-field-widget
        widget-name="pk_columns"
        :widget-config="fieldConfig('Столбцы PK', pkForm.columns)"
        @input="patchPkField"
      ></simple-field-widget>
      <simple-field-widget
        widget-name="pk_constraint_name"
        :widget-config="
          fieldConfig('Имя ограничения (необязательно)', pkForm.constraint_name, false, 'str', {
            placeholder: 'по умолчанию: имя_таблицы_pkey',
          })
        "
        @input="patchPkField"
      ></simple-field-widget>
      <template #footer>
        <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="pkForm.open = false">
          Отмена
        </button>
        <button type="button" class="widget-button confirm-modal-action" :disabled="busy" @click="submitPkForm">Дальше…</button>
      </template>
    </gui-modal-shell>

    <gui-modal-shell
      :show="dropConfirm.open"
      :title="dropConfirm.title"
      content-class="confirm-modal-content schema-constraints-dialog"
      @close="dropConfirm.open = false"
    >
      <p>{{ dropConfirm.detail }}</p>
      <template #footer>
        <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="dropConfirm.open = false">
          Отмена
        </button>
        <button type="button" class="widget-button confirm-modal-action" :disabled="busy" @click="confirmDrop">Удалить</button>
      </template>
    </gui-modal-shell>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { frontendApiClient } from '@frontend/runtime/api_client.ts';
import type { ConfirmModalSurface } from '@frontend/widgets/common/confirm_modal_contract.ts';
import ListWidget from '@frontend/widgets/ListWidget.vue';
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import { fieldConfig, iconSrc, listConfig } from './user_settings_field_helpers.ts';
import { runDbSchemaDdlWithConfirm } from './db_schema_ddl_confirm.ts';
import GuiModalShell from './GuiModalShell.vue';

type PkInfo = { constraint_name?: string; columns?: string[] } | null;

type FkInfo = {
  constraint_name: string;
  columns?: string[];
  foreign_schema?: string;
  foreign_table?: string;
  foreign_columns?: string[];
  update_rule?: string;
  delete_rule?: string;
};

const FK_ACTIONS = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] as const;

const fkActionsList = [...FK_ACTIONS];

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const props = defineProps<{
  schema: string;
  table: string;
  columnNames: string[];
  confirmModal: ConfirmModalSurface | null;
}>();

const emit = defineEmits<{
  invalidateTree: [];
}>();

const busy = ref(false);
const pk = ref<PkInfo>(null);
const foreignKeys = ref<FkInfo[]>([]);

const fkForm = reactive({
  open: false,
  error: '',
  constraint_name: '',
  local_columns: '',
  ref_schema: 'public',
  ref_table: '',
  ref_columns: '',
  on_delete: 'NO ACTION',
  on_update: 'NO ACTION',
});

const pkForm = reactive({
  open: false,
  error: '',
  columns: '',
  constraint_name: '',
});

const dropConfirm = reactive({
  open: false,
  title: '',
  detail: '',
  ddlTitle: '',
  payload: null as Record<string, unknown> | null,
});

const pkHintLines = computed(() =>
  props.columnNames.length ? [`Доступные столбцы: ${props.columnNames.join(', ')}.`] : []
);

async function loadConstraints(): Promise<void> {
  busy.value = true;
  try {
    const data = await frontendApiClient.fetchDbSchemaConstraints(props.schema, props.table);
    pk.value = (data.primary_key as PkInfo) || null;
    foreignKeys.value = Array.isArray(data.foreign_keys) ? (data.foreign_keys as FkInfo[]) : [];
  } catch {
    pk.value = null;
    foreignKeys.value = [];
  } finally {
    busy.value = false;
  }
}

watch(
  () => [props.schema, props.table],
  () => {
    fkForm.open = false;
    pkForm.open = false;
    dropConfirm.open = false;
    void loadConstraints();
  },
  { immediate: true }
);

function patchFkField(payload: { name?: string; value?: unknown }): void {
  const name = payload.name;
  const value = String(payload.value ?? '');
  if (name === 'fk_constraint_name') fkForm.constraint_name = value;
  else if (name === 'fk_local_columns') fkForm.local_columns = value;
  else if (name === 'fk_ref_schema') fkForm.ref_schema = value;
  else if (name === 'fk_ref_table') fkForm.ref_table = value;
  else if (name === 'fk_ref_columns') fkForm.ref_columns = value;
  else if (name === 'fk_on_delete') fkForm.on_delete = value;
  else if (name === 'fk_on_update') fkForm.on_update = value;
}

function patchPkField(payload: { name?: string; value?: unknown }): void {
  const name = payload.name;
  const value = String(payload.value ?? '');
  if (name === 'pk_columns') pkForm.columns = value;
  else if (name === 'pk_constraint_name') pkForm.constraint_name = value;
}

function formatErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function parseCols(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function validateIdent(label: string, value: string): string | null {
  const v = value.trim();
  if (!IDENT_RE.test(v)) {
    return `${label}: недопустимое имя «${v}» (нужен идентификатор PostgreSQL).`;
  }
  return null;
}

async function runDdlWithConfirm(
  title: string,
  operationPayload: Record<string, unknown>,
  options?: { afterExec?: () => void }
): Promise<void> {
  busy.value = true;
  try {
    try {
      await runDbSchemaDdlWithConfirm({
        confirmModal: props.confirmModal,
        payload: operationPayload,
        title,
        onAfterExecute: async () => {
          await loadConstraints();
          emit('invalidateTree');
          options?.afterExec?.();
        },
      });
    } catch (e) {
      throw new Error(formatErr(e));
    }
  } finally {
    busy.value = false;
  }
}

function resetFkForm(): void {
  fkForm.error = '';
  fkForm.constraint_name = `${props.table}_fk`;
  fkForm.local_columns = props.columnNames.slice(0, 1).join(', ');
  fkForm.ref_schema = 'public';
  fkForm.ref_table = '';
  fkForm.ref_columns = '';
  fkForm.on_delete = 'NO ACTION';
  fkForm.on_update = 'NO ACTION';
}

function openFkModal(): void {
  resetFkForm();
  fkForm.open = true;
}

async function submitFkForm(): Promise<void> {
  fkForm.error = '';
  const cnameErr = validateIdent('Имя ограничения', fkForm.constraint_name);
  if (cnameErr) {
    fkForm.error = cnameErr;
    return;
  }
  const rsErr = validateIdent('Схема ссылки', fkForm.ref_schema);
  if (rsErr) {
    fkForm.error = rsErr;
    return;
  }
  const rtErr = validateIdent('Таблица ссылки', fkForm.ref_table);
  if (rtErr) {
    fkForm.error = rtErr;
    return;
  }
  const columns = parseCols(fkForm.local_columns);
  const ref_columns = parseCols(fkForm.ref_columns);
  if (!columns.length || !ref_columns.length) {
    fkForm.error = 'Укажите хотя бы один локальный и один ссылочный столбец.';
    return;
  }
  if (columns.length !== ref_columns.length) {
    fkForm.error = 'Число локальных и ссылочных столбцов должно совпадать.';
    return;
  }

  const payload: Record<string, unknown> = {
    operation: 'add_foreign_key',
    schema: props.schema,
    table: props.table,
    constraint_name: fkForm.constraint_name.trim(),
    columns,
    ref_schema: fkForm.ref_schema.trim(),
    ref_table: fkForm.ref_table.trim(),
    ref_columns,
    on_delete: fkForm.on_delete,
    on_update: fkForm.on_update,
  };

  try {
    fkForm.open = false;
    await runDdlWithConfirm('Добавление FOREIGN KEY', payload);
  } catch (e) {
    fkForm.open = true;
    fkForm.error = formatErr(e);
  }
}

function openPkModal(): void {
  pkForm.error = '';
  pkForm.columns = props.columnNames.slice(0, 1).join(', ');
  pkForm.constraint_name = '';
  pkForm.open = true;
}

async function submitPkForm(): Promise<void> {
  pkForm.error = '';
  const columns = parseCols(pkForm.columns);
  if (!columns.length) {
    pkForm.error = 'Укажите хотя бы один столбец первичного ключа.';
    return;
  }
  const cn = pkForm.constraint_name.trim();
  if (cn) {
    const err = validateIdent('Имя ограничения', cn);
    if (err) {
      pkForm.error = err;
      return;
    }
  }

  const payload: Record<string, unknown> = {
    operation: 'add_primary_key',
    schema: props.schema,
    table: props.table,
    columns,
  };
  if (cn) payload.constraint_name = cn;

  try {
    pkForm.open = false;
    await runDdlWithConfirm('Добавление PRIMARY KEY', payload);
  } catch (e) {
    pkForm.open = true;
    pkForm.error = formatErr(e);
  }
}

function openDropPkConfirm(): void {
  const name = pk.value?.constraint_name;
  if (!name) return;
  dropConfirm.title = 'Удалить первичный ключ?';
  dropConfirm.detail = `Будет удалено ограничение ${name}.`;
  dropConfirm.ddlTitle = 'Удаление PRIMARY KEY';
  dropConfirm.payload = {
    operation: 'drop_primary_key',
    schema: props.schema,
    table: props.table,
    constraint_name: name,
  };
  dropConfirm.open = true;
}

function openDropFkConfirm(name: string): void {
  dropConfirm.title = 'Удалить внешний ключ?';
  dropConfirm.detail = `Будет удалено ограничение ${name}.`;
  dropConfirm.ddlTitle = 'Удаление FOREIGN KEY';
  dropConfirm.payload = {
    operation: 'drop_foreign_key',
    schema: props.schema,
    table: props.table,
    constraint_name: name,
  };
  dropConfirm.open = true;
}

async function confirmDrop(): Promise<void> {
  const payload = dropConfirm.payload;
  const ddlTitle = dropConfirm.ddlTitle;
  if (!payload) return;
  dropConfirm.open = false;
  dropConfirm.payload = null;
  try {
    await runDdlWithConfirm(ddlTitle, payload);
  } catch (e) {
    window.alert(formatErr(e));
  }
}
</script>

<style scoped>
.schema-constraints {
  margin-top: var(--page-gap, 16px);
  padding-top: var(--space-md, 12px);
  border-top: 1px solid var(--color-border, #ddd);
}
.column-editor__section-title {
  font-size: var(--text-sm, 14px);
  margin: 0 0 var(--space-md, 12px);
}
.schema-constraints__block {
  margin-bottom: var(--page-gap, 16px);
}
.schema-constraints__head {
  font-weight: var(--fw-semibold, 600);
  margin-bottom: var(--space-xs, 6px);
}
.schema-constraints__meta {
  font-size: var(--text-sm, 13px);
  margin-bottom: var(--space-sm, 8px);
  word-break: break-word;
}
.schema-constraints__hint {
  color: var(--color-text-muted, #666);
  font-size: var(--text-sm, 13px);
  margin-bottom: var(--space-sm, 8px);
}
.schema-constraints__warn {
  color: var(--color-danger, #c00);
  font-size: var(--text-sm, 13px);
  margin-top: var(--space-sm, 8px);
}
.schema-constraints__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm, 8px);
}
.schema-constraints__actions--before-list {
  margin-bottom: var(--space-sm, 8px);
}
.schema-constraints__fk-list {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-md, 12px);
}
.schema-constraints__fk-item {
  display: flex;
  gap: var(--space-sm, 8px);
  align-items: center;
  padding: var(--space-sm, 8px) 0;
  border-bottom: 1px solid var(--color-border, #eee);
  font-size: var(--text-sm, 13px);
}
.schema-constraints__fk-delete {
  flex: 0 0 auto;
  min-width: 0;
  padding: var(--space-sm) var(--space-md);
}
.schema-constraints__fk-text {
  min-width: 0;
}
:deep(.confirm-modal-content.schema-constraints-dialog) {
  --confirm-modal-max-width: 780px;
  width: min(780px, calc(100vw - var(--page-gap, 16px) * 2));
  max-width: min(780px, 100%);
}
.schema-constraints-dialog__hint {
  font-size: var(--text-sm, 13px);
  color: var(--color-text-muted, #666);
  margin: 0 0 var(--space-md, 12px);
}
.schema-constraints-dialog__error {
  color: var(--color-danger, #c00);
  font-size: var(--text-sm, 13px);
  margin-bottom: var(--space-md, 12px);
}
.schema-constraints-dialog__field {
  margin-bottom: var(--space-md, 12px);
}
.schema-constraints-dialog__field--grow {
  flex: 1;
  min-width: 0;
}
.schema-constraints-dialog__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--page-gap, 12px);
}
.schema-constraints-dialog__row .schema-constraints-dialog__field {
  margin-bottom: 0;
}
.schema-constraints-dialog__row + .schema-constraints-dialog__field {
  margin-top: var(--space-md, 12px);
}
</style>
