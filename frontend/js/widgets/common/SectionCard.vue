<template>
  <div
    :class="wrapperClass"
    :data-section-index="sectionIndex"
    :data-section-name="section.name || ''"
    :data-section-collapsible="section.collapsible ? 'true' : 'false'"
  >
    <div class="card page-section-card u-wide">
      <div
        v-if="section.showHeader"
        class="card-header"
        :class="headerClass"
        :id="headerId || undefined"
        :style="headerStyle"
        @click="section.collapsible && onToggle ? onToggle() : null"
      >
        <component :is="titleTag" class="mb-0 d-flex align-items-center page-section-title">
          <span v-if="section.showHeader" class="page-section-arrow-slot inline-flex-center">
            <img v-if="section.collapsible" :src="collapseIconSrc" class="collapse-icon" alt="">
          </span>
          <ItemIcon v-if="section.icon" :icon="section.icon" />
          <span v-text="section.name"></span>
        </component>
      </div>
      <div
        ref="collapseEl"
        :class="collapseClass"
        :id="section.collapsible ? collapseId : null"
        :style="collapseStyle"
      >
        <div ref="collapseInner" class="collapse-inner">
          <div class="card-body page-section-body u-wide">
            <ContentRows
              :rows="sectionRows"
              :get-widget-attrs="getWidgetAttrs"
              :get-widget-value="getWidgetValue"
              text-class="page-section-text"
              @input="onInput ? onInput($event) : null"
              @execute="onExecute"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ParsedGuiSection } from '../../runtime/page_contract.ts';
import ContentRows from './ContentRows.vue';
import ItemIcon from './ItemIcon.vue';

defineOptions({
  name: 'SectionCard'
});

type SectionCardConfig = ParsedGuiSection & {
  collapsible?: boolean;
  hasFrame?: boolean;
  icon?: string;
  name?: string;
  rows?: unknown[];
  showHeader?: boolean;
};

const props = withDefaults(defineProps<{
  collapseId?: string;
  getWidgetAttrs: (widgetName: string) => Record<string, unknown>;
  getWidgetValue: (widgetName: string) => unknown;
  headerId?: string;
  isCollapsed?: boolean;
  onExecute: (payload: unknown) => void;
  onInput?: ((payload: unknown) => void) | null;
  onToggle?: (() => void) | null;
  section: SectionCardConfig;
  sectionIndex: number;
}>(), {
  collapseId: '',
  headerId: '',
  isCollapsed: false,
  onInput: null,
  onToggle: null
});

const collapseAnimating = ref(false);
const collapseStyle = ref<Record<string, string> | null>(null);
const collapseEl = ref<HTMLElement | null>(null);
const collapseInner = ref<HTMLElement | null>(null);

let collapseRafId = 0;
let removeCollapseTransitionListener: (() => void) | null = null;

const titleTag = 'h5';
const collapseIconSrc = '/templates/icons/arrow.svg';
const sectionRows = computed(() =>
  (props.section.rows || []) as Array<string | { widgets?: string[] }>
);

const collapseClass = computed(() => {
  if (!props.section.collapsible) {
    return '';
  }

  return {
    collapse: true,
    show: !props.isCollapsed,
    'collapse-animating': collapseAnimating.value
  };
});

const wrapperClass = computed(() => ({
  'page-section': true,
  'page-section--bare': !props.section.showHeader,
  'page-section--box': props.section.hasFrame
}));

const headerClass = computed(() => ({
  collapsed: props.section.collapsible && props.isCollapsed,
  'page-section-header': true
}));

const headerStyle = computed(() => (
  props.section.collapsible ? { cursor: 'pointer' } : null
));

function stopCollapseAnimation() {
  if (collapseRafId) {
    cancelAnimationFrame(collapseRafId);
    collapseRafId = 0;
  }

  if (removeCollapseTransitionListener) {
    removeCollapseTransitionListener();
    removeCollapseTransitionListener = null;
  }
}

function syncCollapseState() {
  if (!props.section.collapsible) {
    return;
  }

  stopCollapseAnimation();
  collapseAnimating.value = false;
  collapseStyle.value = props.isCollapsed ? { height: '0px' } : { height: 'auto' };
}

function animateCollapse() {
  if (!collapseEl.value || !collapseInner.value) {
    syncCollapseState();
    return;
  }

  stopCollapseAnimation();

  const startHeight = `${collapseEl.value.getBoundingClientRect().height}px`;
  const endHeight = props.isCollapsed ? '0px' : `${collapseInner.value.scrollHeight}px`;

  if (startHeight === endHeight) {
    collapseAnimating.value = false;
    collapseStyle.value = props.isCollapsed ? { height: '0px' } : { height: 'auto' };
    return;
  }

  collapseAnimating.value = true;
  collapseStyle.value = { height: startHeight };

  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== collapseEl.value || event.propertyName !== 'height') {
      return;
    }

    stopCollapseAnimation();
    collapseAnimating.value = false;
    collapseStyle.value = props.isCollapsed ? { height: '0px' } : { height: 'auto' };
  };

  collapseEl.value.addEventListener('transitionend', onTransitionEnd);
  removeCollapseTransitionListener = () => {
    collapseEl.value?.removeEventListener('transitionend', onTransitionEnd);
  };

  nextTick(() => {
    if (!collapseEl.value) {
      return;
    }

    void collapseEl.value.offsetHeight;

    collapseRafId = requestAnimationFrame(() => {
      collapseRafId = 0;
      collapseStyle.value = { height: endHeight };
    });
  });
}

watch(
  () => props.isCollapsed,
  (next, prev) => {
    if (!props.section.collapsible || next === prev) {
      return;
    }

    animateCollapse();
  }
);

onMounted(() => {
  syncCollapseState();
});

onBeforeUnmount(() => {
  stopCollapseAnimation();
});
</script>
