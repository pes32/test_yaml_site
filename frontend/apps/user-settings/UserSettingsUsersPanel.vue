<template>
  <div class="card page-section-card">
    <div class="card-header page-section-header">
      <h5 class="page-section-title">Пользователи</h5>
    </div>
    <div class="card-body page-section-body u-wide">
      <div class="row row--section">
        <div class="col-12 d-flex gap-2 flex-wrap">
          <button type="button" class="widget-button inline-flex-center" @click="emit('create')">
            <span class="button-icon button-icon--plus" aria-hidden="true"></span>
            Создать
          </button>
          <button type="button" class="widget-button inline-flex-center" @click="emit('refresh')">Обновить</button>
          <button v-if="blockToggleVisible" type="button" class="widget-button inline-flex-center" @click="emit('block-toggle')">
            <img class="button-icon" :src="iconSrc('lock.svg')" alt="">
            {{ blockToggleLabel }}
          </button>
        </div>
      </div>
      <div class="row row--section" @click.capture="onTablePointer" @dblclick.capture="onTableDoubleClick">
        <div class="col-12">
          <table-widget widget-name="adminUsersTable" :widget-config="usersTableConfig" @input="noop"></table-widget>
          <div v-if="usersHasMore" ref="usersLoadMoreSentinel" class="page-lazy-sentinel">
            <span v-if="usersLoadingMore">Загрузка...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TableWidget from '@frontend/widgets/table/TableWidget.vue';
import type { TableWidgetConfig } from '@frontend/widgets/table/table_contract.ts';
import { iconSrc } from './user_settings_field_helpers.ts';

const props = defineProps<{
  usersTableConfig: TableWidgetConfig;
  usersHasMore: boolean;
  usersLoadingMore: boolean;
  blockToggleVisible: boolean;
  blockToggleLabel: string;
}>();

const emit = defineEmits<{
  'select-user': [number];
  'open-user-card': [number];
  create: [];
  refresh: [];
  'block-toggle': [];
  'need-more': [];
}>();

const usersLoadMoreSentinel = ref<HTMLElement | null>(null);
let usersObserver: IntersectionObserver | null = null;

function noop(): void {}

function userIdFromTableEvent(event: Event): number | null {
  const target = event.target instanceof Element ? event.target : null;
  const cell = target?.closest('[data-row-id]');
  if (!(cell instanceof HTMLElement)) return null;
  const userId = Number(cell.dataset.rowId || '');
  return Number.isFinite(userId) ? userId : null;
}

function onTablePointer(event: Event): void {
  const userId = userIdFromTableEvent(event);
  if (userId != null) {
    emit('select-user', userId);
  }
}

function onTableDoubleClick(event: Event): void {
  const userId = userIdFromTableEvent(event);
  if (userId != null) emit('open-user-card', userId);
}

function setupUsersLazyObserver(): void {
  usersObserver?.disconnect();
  usersObserver = null;
  if (typeof IntersectionObserver === 'undefined') return;
  if (!props.usersHasMore || !usersLoadMoreSentinel.value) return;
  usersObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) emit('need-more');
  }, { root: null, rootMargin: '160px', threshold: 0 });
  usersObserver.observe(usersLoadMoreSentinel.value);
}

watch(
  () => [props.usersHasMore, props.usersLoadingMore] as const,
  () => void nextTick(setupUsersLazyObserver)
);

onMounted(() => {
  void nextTick(setupUsersLazyObserver);
});

onBeforeUnmount(() => {
  usersObserver?.disconnect();
});
</script>

<style scoped>
.button-icon--plus {
  position: relative;
  display: inline-block;
}

.button-icon--plus::before,
.button-icon--plus::after {
  content: '';
  position: absolute;
  inset: 50% auto auto 50%;
  width: 14px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: translate(-50%, -50%);
}

.button-icon--plus::after {
  transform: translate(-50%, -50%) rotate(90deg);
}
</style>
