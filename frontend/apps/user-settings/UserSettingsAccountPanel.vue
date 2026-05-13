<template>
  <div class="card page-section-card">
    <div class="card-header page-section-header">
      <h5 class="page-section-title">{{ accountTitle }}</h5>
    </div>
    <div class="card-body page-section-body u-wide">
      <div class="row row--section">
        <div class="col-auto">
          <simple-field-widget
            widget-name="user_status"
            :widget-config="fieldConfig('Статус', statusLabel(accountForm.user_status), true)"
            @input="noop"
          ></simple-field-widget>
        </div>
        <div class="col-auto">
          <simple-field-widget widget-name="role_name" :widget-config="fieldConfig('Роль', accountForm.role_name, true)" @input="noop"></simple-field-widget>
        </div>
      </div>
      <div class="row row--section">
        <div class="col-auto"><simple-field-widget widget-name="user_surname" :widget-config="fieldConfig('Фамилия', accountForm.user_surname)" @input="emitField" @live-input="emitField"></simple-field-widget></div>
        <div class="col-auto"><simple-field-widget widget-name="user_name" :widget-config="fieldConfig('Имя', accountForm.user_name)" @input="emitField" @live-input="emitField"></simple-field-widget></div>
        <div class="col-auto"><simple-field-widget widget-name="user_patronymic" :widget-config="fieldConfig('Отчество', accountForm.user_patronymic)" @input="emitField" @live-input="emitField"></simple-field-widget></div>
      </div>
      <div class="row row--section">
        <div class="col-auto"><simple-field-widget widget-name="user_email" :widget-config="fieldConfig('Почта', accountForm.user_email)" @input="emitField" @live-input="emitField"></simple-field-widget></div>
      </div>
      <div class="row row--section">
        <div class="col-12 d-flex gap-2">
          <button type="button" class="widget-button inline-flex-center" :disabled="loading || !accountDirty" @click="emit('save')">Сохранить</button>
          <button type="button" class="widget-button inline-flex-center" @click="emit('open-password')">Сменить пароль</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import { fieldConfig, statusLabel, type WidgetPayload } from './user_settings_field_helpers.ts';

defineProps<{
  accountTitle: string;
  accountForm: Record<string, unknown>;
  accountDirty: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  save: [];
  'open-password': [];
  'account-field': [WidgetPayload];
}>();

function noop(): void {}

function emitField(payload: WidgetPayload): void {
  emit('account-field', payload);
}
</script>
