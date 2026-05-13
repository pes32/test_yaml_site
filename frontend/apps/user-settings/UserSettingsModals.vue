<template>
  <gui-modal-shell
    :show="passwordModalOpen"
    title="Смена пароля"
    content-class="user-settings-compact-modal"
    body-class="user-settings-modal-body-fields"
    @close="passwordModalOpen = false"
  >
    <div class="row row--section">
      <div class="col-12">
        <simple-field-widget widget-name="old_password" :widget-config="fieldConfig('Старый пароль', passwordForm.old_password, false, 'password')" @input="emitPwd"></simple-field-widget>
      </div>
    </div>
    <div class="row row--section">
      <div class="col-12">
        <simple-field-widget widget-name="new_password" :widget-config="fieldConfig('Новый пароль', passwordForm.new_password, false, 'password')" @input="emitPwd"></simple-field-widget>
      </div>
    </div>
    <div class="row row--section">
      <div class="col-12">
        <simple-field-widget
          widget-name="confirm_password"
          :widget-config="confirmPwdFieldConfig"
          @input="emitPwd"
          @blur="emit('password-confirm-blur')"
        ></simple-field-widget>
      </div>
    </div>
    <template #footer>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="passwordModalOpen = false">Отмена</button>
      <button type="button" class="widget-button confirm-modal-action" :disabled="passwordChangeBlocked || loading" @click="emit('change-own-password')">
        Изменить
      </button>
    </template>
  </gui-modal-shell>

  <gui-modal-shell
    :show="createUserModalOpen"
    title="Создание пользователя"
    content-class="user-settings-compact-modal"
    body-class="user-settings-modal-body-fields"
    @close="createUserModalOpen = false"
  >
    <div class="row row--section">
      <div class="col-12"><simple-field-widget widget-name="user_login" :widget-config="fieldConfig('Логин', createUserForm.user_login)" @input="emitCreate"></simple-field-widget></div>
    </div>
    <div class="row row--section">
      <div class="col-12">
        <list-widget
          widget-name="role_name"
          :widget-config="listConfig('Роль', createUserForm.role_name, roleOptions, false, { editable: false })"
          @input="emitCreate"
        ></list-widget>
      </div>
    </div>
    <div class="row row--section">
      <div class="col-12"><simple-field-widget widget-name="password" :widget-config="fieldConfig('Пароль', createUserForm.password, false, 'password')" @input="emitCreate"></simple-field-widget></div>
    </div>
    <template #footer>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="createUserModalOpen = false">Отмена</button>
      <button type="button" class="widget-button confirm-modal-action" @click="emit('create-user-submit')">Создать</button>
    </template>
  </gui-modal-shell>

  <gui-modal-shell :show="userCardModalOpen" :title="userCardTitle" body-class="user-settings-modal-body-fields" @close="userCardModalOpen = false">
    <div class="row row--section">
      <div class="col-auto"><simple-field-widget widget-name="user_status" :widget-config="fieldConfig('Статус', statusLabel(userCardForm.user_status), true)" @input="emitCard"></simple-field-widget></div>
      <div class="col-auto">
        <list-widget
          widget-name="role_name"
          :widget-config="listConfig('Роль', userCardForm.role_name, roleOptions, userCardForm.user_id === currentUser?.user_id, { editable: false })"
          @input="emitCard"
        ></list-widget>
      </div>
      <div class="col-auto"><simple-field-widget widget-name="user_login" :widget-config="fieldConfig('Логин', userCardForm.user_login)" @input="emitCard"></simple-field-widget></div>
    </div>
    <div class="row row--section">
      <div class="col-auto"><simple-field-widget widget-name="user_surname" :widget-config="fieldConfig('Фамилия', userCardForm.user_surname)" @input="emitCard"></simple-field-widget></div>
      <div class="col-auto"><simple-field-widget widget-name="user_name" :widget-config="fieldConfig('Имя', userCardForm.user_name)" @input="emitCard"></simple-field-widget></div>
      <div class="col-auto"><simple-field-widget widget-name="user_patronymic" :widget-config="fieldConfig('Отчество', userCardForm.user_patronymic)" @input="emitCard"></simple-field-widget></div>
    </div>
    <div class="row row--section">
      <div class="col-auto"><simple-field-widget widget-name="user_email" :widget-config="fieldConfig('Почта', userCardForm.user_email)" @input="emitCard"></simple-field-widget></div>
    </div>
    <template #footer>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="userCardModalOpen = false">Отмена</button>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="emit('open-admin-password')">Сменить пароль</button>
      <button type="button" class="widget-button confirm-modal-action" @click="emit('save-user-card')">Сохранить</button>
    </template>
  </gui-modal-shell>

  <gui-modal-shell
    :show="adminPasswordModalOpen"
    title="Смена пароля пользователя"
    content-class="user-settings-compact-modal"
    body-class="user-settings-modal-body-fields"
    @close="adminPasswordModalOpen = false"
  >
    <div class="row row--section">
      <div class="col-12">
        <simple-field-widget widget-name="password" :widget-config="fieldConfig('Новый пароль', adminPasswordForm.password, false, 'password')" @input="emitAdminPwd"></simple-field-widget>
      </div>
    </div>
    <template #footer>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="adminPasswordModalOpen = false">Отмена</button>
      <button type="button" class="widget-button confirm-modal-action confirm-modal-action--secondary" @click="emit('generate-admin-temp-password')">
        Сгенерировать временный пароль
      </button>
      <button type="button" class="widget-button confirm-modal-action" @click="emit('save-admin-password')">Изменить</button>
    </template>
  </gui-modal-shell>
</template>

<script setup lang="ts">
import type { UserRecord } from '@frontend/runtime/api_client.ts';
import GuiModalShell from './GuiModalShell.vue';
import ListWidget from '@frontend/widgets/ListWidget.vue';
import SimpleFieldWidget from '@frontend/widgets/fields/SimpleFieldWidget.vue';
import { fieldConfig, listConfig, statusLabel, type WidgetPayload } from './user_settings_field_helpers.ts';

const passwordModalOpen = defineModel<boolean>('passwordModalOpen', { required: true });
const createUserModalOpen = defineModel<boolean>('createUserModalOpen', { required: true });
const userCardModalOpen = defineModel<boolean>('userCardModalOpen', { required: true });
const adminPasswordModalOpen = defineModel<boolean>('adminPasswordModalOpen', { required: true });

defineProps<{
  passwordForm: Record<string, unknown>;
  createUserForm: Record<string, unknown>;
  userCardForm: Record<string, unknown>;
  userCardTitle: string;
  adminPasswordForm: Record<string, unknown>;
  confirmPwdFieldConfig: Record<string, unknown>;
  passwordChangeBlocked: boolean;
  loading: boolean;
  roleOptions: string[];
  currentUser: UserRecord | null;
}>();

const emit = defineEmits<{
  'password-confirm-blur': [];
  'change-own-password': [];
  'create-user-submit': [];
  'save-user-card': [];
  'open-admin-password': [];
  'generate-admin-temp-password': [];
  'save-admin-password': [];
  'password-field': [WidgetPayload];
  'create-user-field': [WidgetPayload];
  'user-card-field': [WidgetPayload];
  'admin-password-field': [WidgetPayload];
}>();

function emitPwd(payload: WidgetPayload): void {
  emit('password-field', payload);
}

function emitCreate(payload: WidgetPayload): void {
  emit('create-user-field', payload);
}

function emitCard(payload: WidgetPayload): void {
  emit('user-card-field', payload);
}

function emitAdminPwd(payload: WidgetPayload): void {
  emit('admin-password-field', payload);
}
</script>
