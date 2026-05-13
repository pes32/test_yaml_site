<template>
  <div class="page-section page-section--bare page-section--box">
    <div class="card page-section-card u-wide">
      <div class="card-body page-section-body u-wide">
        <div class="row row--section">
          <div class="col-auto"><simple-field-widget widget-name="address" :widget-config="fieldConfig('Адрес сервера', dbForm.address)" @input="emitDb" @live-input="emitDb"></simple-field-widget></div>
          <div class="col-auto"><simple-field-widget widget-name="port" :widget-config="fieldConfig('Порт БД', dbForm.port, false, 'int')" @input="emitDb" @live-input="emitDb"></simple-field-widget></div>
          <div class="col-auto"><simple-field-widget widget-name="db_name" :widget-config="fieldConfig('Имя БД', dbForm.db_name)" @input="emitDb" @live-input="emitDb"></simple-field-widget></div>
        </div>
        <div class="row row--section">
          <div class="col-auto"><simple-field-widget widget-name="user" :widget-config="fieldConfig('Пользователь БД', dbForm.user)" @input="emitDb" @live-input="emitDb"></simple-field-widget></div>
          <div class="col-auto">
            <simple-field-widget
              widget-name="password"
              :widget-config="fieldConfig('Пароль', dbForm.password, false, 'password', { placeholder: dbPasswordPlaceholder, no_copy: true })"
              @input="emitDb"
              @live-input="emitDb"
            ></simple-field-widget>
          </div>
        </div>
        <div class="row row--section">
          <div class="col-12 d-flex gap-2 flex-wrap">
            <button type="button" class="widget-button inline-flex-center" @click="emit('test-db')">Проверить</button>
            <button type="button" class="widget-button inline-flex-center" :disabled="!dbChecked" @click="emit('save-db')">Сохранить</button>
            <button type="button" class="widget-button inline-flex-center" @click="emit('reset-db')">Сбросить</button>
          </div>
        </div>
        <div class="row row--section">
          <div class="col-12">
            <label class="widget-label" for="adminSql">SQL</label>
            <textarea id="adminSql" v-model="sqlQueryModel" class="form-control" rows="7"></textarea>
          </div>
        </div>
        <div class="row row--section">
          <div class="col-12 d-flex gap-2 flex-wrap">
            <button type="button" class="widget-button inline-flex-center" :disabled="!sqlQueryModel.trim()" @click="emit('run-sql')">Выполнить</button>
          </div>
        </div>
        <div v-if="sqlResult" class="row row--section">
          <div class="col-12">
            <ul class="nav nav-tabs page-tabs mb-2" role="tablist">
              <li class="nav-item">
                <a class="nav-link" :class="{ active: sqlActiveViewModel === 'raw' }" href="#" role="tab" @click.prevent="sqlActiveViewModel = 'raw'">RAW</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" :class="{ active: sqlActiveViewModel === 'table' }" href="#" role="tab" @click.prevent="sqlActiveViewModel = 'table'">Таблица</a>
              </li>
            </ul>
            <pre v-if="sqlActiveViewModel === 'raw' && sqlResult" class="text-muted user-settings-sql-raw">{{ sqlResult }}</pre>
            <table-widget v-if="sqlActiveViewModel === 'table'" widget-name="adminSqlTable" :widget-config="sqlTableWidgetConfig" @input="noop"></table-widget>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import TableWidget from '@frontend/widgets/table/TableWidget.vue';
import type { TableWidgetConfig } from '@frontend/widgets/table/table_contract.ts';
import { fieldConfig, type WidgetPayload } from './user_settings_field_helpers.ts';

defineProps<{
  dbForm: Record<string, unknown>;
  dbPasswordPlaceholder: string;
  dbChecked: boolean;
  sqlResult: string;
  sqlTableWidgetConfig: TableWidgetConfig;
}>();

const sqlQueryModel = defineModel<string>('sqlQuery', { required: true });
const sqlActiveViewModel = defineModel<'raw' | 'table'>('sqlActiveView', { required: true });

const emit = defineEmits<{
  'db-field': [WidgetPayload];
  'test-db': [];
  'save-db': [];
  'reset-db': [];
  'run-sql': [];
}>();

function noop(): void {}

function emitDb(payload: WidgetPayload): void {
  emit('db-field', payload);
}
</script>
