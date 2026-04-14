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
              :rows="section.rows"
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

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ContentRows from './ContentRows.vue';
import ItemIcon from './ItemIcon.vue';

defineOptions({
  name: 'SectionCard'
});

const props = defineProps({
  section: {
    type: Object,
    required: true
  },
  sectionIndex: {
    type: Number,
    required: true
  },
  collapseId: {
    type: String,
    default: ''
  },
  isCollapsed: {
    type: Boolean,
    default: false
  },
  onToggle: {
    type: Function,
    default: null
  },
  onInput: {
    type: Function,
    default: null
  },
  getWidgetAttrs: {
    type: Function,
    required: true
  },
  getWidgetValue: {
    type: Function,
    required: true
  },
  onExecute: {
    type: Function,
    required: true
  },
  headerId: {
    type: String,
    default: ''
  }
});

const collapseAnimating = ref(false);
const collapseStyle = ref(null);
const collapseEl = ref(null);
const collapseInner = ref(null);

let collapseRafId = 0;
let removeCollapseTransitionListener = null;

const titleTag = 'h5';
const collapseIconSrc = '/templates/icons/arrow.svg';

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

  const onTransitionEnd = (event) => {
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
