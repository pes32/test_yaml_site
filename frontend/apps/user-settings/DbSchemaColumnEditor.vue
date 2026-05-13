<template>
  <div class="column-editor">
    <div class="column-editor__toolbar">
      <button type="button" class="widget-button inline-flex-center" @click="locked = !locked">
        <img class="button-icon" :src="iconSrc(locked ? 'lock_open.svg' : 'lock.svg')" alt="">
        {{ locked ? 'Разблокировать' : 'Заблокировать' }}
      </button>
      <button type="button" class="widget-button inline-flex-center" :disabled="locked || saving" @click="save">
        Сохранить
      </button>
    </div>

    <div class="column-editor__sections">
      <div class="row row--section row--text row--before-widgets">
        <div class="col-12"><span class="page-section-text">Общее</span></div>
      </div>
      <div class="row row--section">
        <div class="col-12">
          <div class="row">
            <div class="col-auto" data-widget-name="column_name" data-widget-type="str">
              <simple-field-widget widget-name="column_name" :widget-config="fieldConfig('column_name', form.column_name, locked)" @input="patchField"></simple-field-widget>
            </div>
          </div>
        </div>
      </div>

      <div class="row row--section row--text row--before-widgets">
        <div class="col-12"><span class="page-section-text">Значение</span></div>
      </div>
      <div class="row row--section">
        <div class="col-12">
          <div class="row">
            <div class="col-auto" data-widget-name="column_default" data-widget-type="str">
              <simple-field-widget widget-name="column_default" :widget-config="fieldConfig('column_default', form.column_default, locked)" @input="patchField"></simple-field-widget>
            </div>
            <div class="col-auto" data-widget-name="is_nullable" data-widget-type="list">
              <list-widget widget-name="is_nullable" :widget-config="listConfig('is_nullable', form.is_nullable, ['YES', 'NO'], locked, false)" @input="patchField"></list-widget>
            </div>
            <div class="col-auto" data-widget-name="is_unique" data-widget-type="list">
              <list-widget widget-name="is_unique" :widget-config="listConfig('UNIQUE', form.is_unique, ['YES', 'NO'], uniqueLocked, false)" @input="patchField"></list-widget>
            </div>
          </div>
        </div>
      </div>

      <div class="row row--section row--text row--before-widgets">
        <div class="col-12"><span class="page-section-text">Тип данных</span></div>
      </div>
      <div class="row row--section">
        <div class="col-12">
          <div class="row">
            <div class="col-auto" data-widget-name="data_type" data-widget-type="voc">
              <voc-widget widget-name="data_type" :widget-config="dataTypeVocConfig" @input="patchField"></voc-widget>
            </div>
          </div>
        </div>
      </div>

      <template v-if="showStringLen">
        <div class="row row--section row--text row--before-widgets">
          <div class="col-12"><span class="page-section-text">Длина</span></div>
        </div>
        <div class="row row--section">
          <div class="col-12">
            <div class="row">
              <div class="col-auto" data-widget-name="character_maximum_length" data-widget-type="int">
                <simple-field-widget
                  widget-name="character_maximum_length"
                  :widget-config="fieldConfig('character_maximum_length', form.character_maximum_length, locked, 'int')"
                  @input="patchField"
                ></simple-field-widget>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="showNumeric || showFloatPrecision">
        <div class="row row--section row--text row--before-widgets">
          <div class="col-12"><span class="page-section-text">{{ showNumeric ? 'Числовые типы' : 'Float' }}</span></div>
        </div>
        <div class="row row--section">
          <div class="col-12">
            <div class="row">
              <div class="col-auto" data-widget-name="numeric_precision" data-widget-type="int">
                <simple-field-widget
                  widget-name="numeric_precision"
                  :widget-config="fieldConfig('numeric_precision', form.numeric_precision, locked, 'int')"
                  @input="patchField"
                ></simple-field-widget>
              </div>
              <div v-if="showNumeric" class="col-auto" data-widget-name="numeric_scale" data-widget-type="int">
                <simple-field-widget
                  widget-name="numeric_scale"
                  :widget-config="fieldConfig('numeric_scale', form.numeric_scale, locked, 'int')"
                  @input="patchField"
                ></simple-field-widget>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="showDateTimePrecision">
        <div class="row row--section row--text row--before-widgets">
          <div class="col-12"><span class="page-section-text">Дата и время</span></div>
        </div>
        <div class="row row--section">
          <div class="col-12">
            <div class="row">
              <div class="col-auto" data-widget-name="datetime_precision" data-widget-type="int">
                <simple-field-widget
                  widget-name="datetime_precision"
                  :widget-config="fieldConfig('datetime_precision', form.datetime_precision, locked, 'int')"
                  @input="patchField"
                ></simple-field-widget>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template v-if="showInterval">
        <div class="row row--section row--text row--before-widgets">
          <div class="col-12"><span class="page-section-text">Интервал</span></div>
        </div>
        <div class="row row--section">
          <div class="col-12">
            <div class="row">
              <div class="col-auto" data-widget-name="interval_type" data-widget-type="list">
                <list-widget
                  widget-name="interval_type"
                  :widget-config="listConfig('interval_type', form.interval_type, intervalTypeOptions, locked, false)"
                  @input="patchField"
                ></list-widget>
              </div>
              <div class="col-auto" data-widget-name="interval_precision" data-widget-type="int">
                <simple-field-widget
                  widget-name="interval_precision"
                  :widget-config="fieldConfig('interval_precision', form.interval_precision, locked, 'int')"
                  @input="patchField"
                ></simple-field-widget>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ListWidget from '@frontend/widgets/ListWidget.vue';
import VocWidget from '@frontend/widgets/voc/VocWidget.vue';
import { runDbSchemaDdlWithConfirm } from './db_schema_ddl_confirm.ts';
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import { pg16DdlDataTypeSqlNames, pg16DdlDataTypeVocRows } from './pg16_data_types.ts';
import type { ConfirmModalSurface } from '@frontend/widgets/common/confirm_modal_contract.ts';

const props = defineProps<{
  schema: string;
  table: string;
  column: string;
  columnMeta: Record<string, unknown> | null;
  confirmModal: ConfirmModalSurface | null;
}>();

const emit = defineEmits<{
  applied: [patch: Record<string, unknown>];
}>();

const locked = ref(true);
const saving = ref(false);

const form = reactive({
  column_name: '',
  column_default: '',
  data_type: '',
  character_maximum_length: '' as string | number,
  numeric_precision: '' as string | number,
  numeric_scale: '' as string | number,
  datetime_precision: '' as string | number,
  interval_type: '',
  interval_precision: '' as string | number,
  is_nullable: 'YES',
  is_unique: 'NO',
});

const pgTypeNames = pg16DdlDataTypeSqlNames();
const pgTypeRows = pg16DdlDataTypeVocRows();
// Guard: data_type обязан оставаться VocWidget-справочником; перед завершением работ проверять, что он открывается в разблокированном редакторе.
const dataTypeVocConfig = computed(() => ({
  label: 'data_type',
  readonly: locked.value,
  source: pgTypeRows,
  columns: ['Тип', 'Категория', 'Описание', 'Алиасы'],
  value: form.data_type,
  placeholder: 'Выберите тип',
  widget: 'voc',
}));

function iconSrc(icon: string): string {
  return `/templates/icons/${icon}`;
}

const dtNorm = computed(() => String(form.data_type || '').toLowerCase());
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

const showStringLen = computed(() =>
  ['character varying', 'varchar', 'character', 'char', 'bit', 'bit varying'].includes(dtNorm.value)
);

const showNumeric = computed(() => ['numeric', 'decimal'].includes(dtNorm.value));
const showFloatPrecision = computed(() => dtNorm.value === 'float');
const showDateTimePrecision = computed(() =>
  ['timestamp without time zone', 'timestamp with time zone', 'time without time zone', 'time with time zone'].includes(dtNorm.value)
);
const showInterval = computed(() => dtNorm.value === 'interval');
const uniqueLocked = computed(
  () => locked.value || String(props.columnMeta?.unique_constraint_type || '') === 'PRIMARY KEY'
);

watch(
  () => props.columnMeta,
  (meta) => {
    if (!meta) return;
    form.column_name = String(meta.column_name || '');
    form.column_default = meta.column_default == null ? '' : String(meta.column_default);
    form.data_type = String(meta.data_type || '');
    form.character_maximum_length =
      meta.character_maximum_length == null ? '' : Number(meta.character_maximum_length);
    form.numeric_precision = meta.numeric_precision == null ? '' : Number(meta.numeric_precision);
    form.numeric_scale = meta.numeric_scale == null ? '' : Number(meta.numeric_scale);
    form.datetime_precision = meta.datetime_precision == null ? '' : Number(meta.datetime_precision);
    form.interval_type = String(meta.interval_type || '');
    form.interval_precision = meta.interval_precision == null ? '' : Number(meta.interval_precision);
    form.is_nullable = String(meta.is_nullable || 'YES').toUpperCase() === 'NO' ? 'NO' : 'YES';
    form.is_unique = String(meta.is_unique || 'NO').toUpperCase() === 'YES' ? 'YES' : 'NO';
    locked.value = true;
  },
  { immediate: true }
);

function fieldConfig(label: string, value: unknown, ro: boolean, widget = 'str', extra: Record<string, unknown> = {}) {
  return { label, readonly: ro, value: value ?? '', widget, ...extra };
}

function listConfig(label: string, value: unknown, source: string[], ro: boolean, editable: boolean) {
  return { label, readonly: ro, source, value: value ?? '', widget: 'list', editable };
}

function patchField(payload: { name?: string; value?: unknown }): void {
  if (!payload?.name) return;
  (form as Record<string, unknown>)[payload.name] = payload.value ?? '';
}

function baselineValue(name: string): string {
  const meta = props.columnMeta || {};
  const value = meta[name];
  return value == null ? '' : String(value);
}

function normalizedNullable(value: unknown): string {
  return String(value || 'YES').toUpperCase() === 'NO' ? 'NO' : 'YES';
}

function optionalPositiveInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function optionalNonNegativeInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function typeNeedsStringLength(dataType: string): boolean {
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

function typeParamsChanged(dataType: string): boolean {
  if (typeNeedsStringLength(dataType) && String(form.character_maximum_length || '') !== baselineValue('character_maximum_length')) {
    return true;
  }
  if (
    typeNeedsNumericParams(dataType) &&
    (String(form.numeric_precision || '') !== baselineValue('numeric_precision') ||
      String(form.numeric_scale || '') !== baselineValue('numeric_scale'))
  ) {
    return true;
  }
  if (typeNeedsFloatPrecision(dataType) && String(form.numeric_precision || '') !== baselineValue('numeric_precision')) {
    return true;
  }
  if (typeNeedsDateTimePrecision(dataType) && String(form.datetime_precision || '') !== baselineValue('datetime_precision')) {
    return true;
  }
  if (
    typeNeedsIntervalParams(dataType) &&
    (String(form.interval_type || '') !== baselineValue('interval_type') ||
      String(form.interval_precision || '') !== baselineValue('interval_precision'))
  ) {
    return true;
  }
  return false;
}

function applyTypeParams(patch: Record<string, unknown>, dataType: string): void {
  if (typeNeedsStringLength(dataType)) {
    patch.character_maximum_length = optionalPositiveInt(form.character_maximum_length);
  }
  if (typeNeedsNumericParams(dataType)) {
    patch.numeric_precision = optionalPositiveInt(form.numeric_precision);
    patch.numeric_scale = optionalNonNegativeInt(form.numeric_scale);
  }
  if (typeNeedsFloatPrecision(dataType)) {
    patch.numeric_precision = optionalPositiveInt(form.numeric_precision);
  }
  if (typeNeedsDateTimePrecision(dataType)) {
    patch.datetime_precision = optionalNonNegativeInt(form.datetime_precision);
  }
  if (typeNeedsIntervalParams(dataType)) {
    patch.interval_type = String(form.interval_type || '').trim();
    patch.interval_precision = optionalNonNegativeInt(form.interval_precision);
  }
}

function buildPatch(): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const nextName = form.column_name.trim();
  const nextType = form.data_type.trim();
  const previousType = baselineValue('data_type').trim();
  const nextDefault = String(form.column_default ?? '');
  const previousDefault = baselineValue('column_default');
  const nextNullable = normalizedNullable(form.is_nullable);
  const previousNullable = normalizedNullable(props.columnMeta?.is_nullable);
  const nextUnique = String(form.is_unique || 'NO').toUpperCase() === 'YES' ? 'YES' : 'NO';
  const previousUnique = String(props.columnMeta?.is_unique || 'NO').toUpperCase() === 'YES' ? 'YES' : 'NO';

  if (nextName && nextName !== baselineValue('column_name')) {
    patch.column_name = nextName;
  }

  if (nextType && (nextType !== previousType || typeParamsChanged(nextType))) {
    patch.data_type = nextType;
    applyTypeParams(patch, nextType);
  }

  if (nextNullable !== previousNullable) {
    patch.is_nullable = nextNullable;
  }

  if (nextDefault !== previousDefault) {
    if (nextDefault === '') {
      patch.drop_default = true;
    } else {
      patch.column_default = nextDefault;
    }
  }

  if (nextUnique !== previousUnique) {
    patch.is_unique = nextUnique;
  }

  return patch;
}

async function save(): Promise<void> {
  saving.value = true;
  try {
    const patch = buildPatch();
    const payload = {
      operation: 'alter_column',
      schema: props.schema,
      table: props.table,
      column: props.column,
      previous_is_nullable: props.columnMeta ? String(props.columnMeta.is_nullable || '') : '',
      previous_unique_constraint: props.columnMeta ? String(props.columnMeta.unique_constraint_name || '') : '',
      patch,
    };
    await runDbSchemaDdlWithConfirm({
      confirmModal: props.confirmModal,
      payload,
      title: 'Подтверждение изменения столбца',
      onAfterExecute: async () => {
        locked.value = true;
        emit('applied', patch);
      },
    });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.column-editor__toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.column-editor__sections {
  display: block;
}
</style>
