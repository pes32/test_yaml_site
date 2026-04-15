<template>
  <div class="widget-container widget-split-button u-wide" :class="{ 'widget-split-button--disabled': !hasActions }">
    <div
      ref="controlRoot"
      class="widget-split-button__control"
      :class="{ show: isDropdownOpen }"
      :style="controlStyle"
    >
      <div
        class="widget-button inline-flex-center widget-split-button__primary"
        :class="buttonClasses"
        :style="primaryStyle"
        :title="buttonTitle"
        aria-hidden="true"
      >
        <action-button-content
          :icon-name="iconName"
          :icon-style="iconStyle"
          :label="buttonLabel"
          label-class="widget-split-button__label"
        ></action-button-content>
      </div>

      <button
        ref="toggleButton"
        type="button"
        class="widget-button widget-split-button__toggle inline-flex-center"
        :disabled="!hasActions"
        aria-haspopup="menu"
        :aria-expanded="isDropdownOpen ? 'true' : 'false'"
        :aria-controls="menuId"
        :title="toggleTitle"
        @click="onToggleClick"
        @keydown="onToggleKeydown"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"></path>
        </svg>
      </button>
    </div>

    <Teleport to="body">
      <ul
        ref="dropdownMenu"
        class="dropdown-menu widget-dd-menu widget-dd-menu--teleport widget-split-button__menu"
        :class="{
          show: isDropdownOpen,
          scrollable: isMenuScrollable,
          'widget-split-button__menu--measuring': isMenuMeasuring
        }"
        :id="menuId"
        :style="menuStyle"
        role="menu"
        :aria-hidden="isDropdownOpen ? 'false' : 'true'"
        tabindex="-1"
      >
        <li
          v-for="(action, index) in displayActions"
          :key="action.key"
          role="presentation"
        >
          <a
            class="dropdown-item"
            href="#"
            role="menuitem"
            :tabindex="isDropdownOpen && highlightedIndex === index ? 0 : -1"
            :class="{ active: highlightedIndex === index }"
            :title="action.displayLabel"
            @click.prevent="onActionClick(action.item)"
            @focus="highlightedIndex = index"
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent="highlightedIndex = index"
            @keydown="onItemKeydown($event, index)"
          >
            <span>{{ action.displayLabel }}</span>
          </a>
        </li>
      </ul>
    </Teleport>

    <div v-if="supportingText" class="widget-info">
      <span>{{ supportingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  ref,
  watch
} from 'vue';
import ActionButtonContent from './action-button/ActionButtonContent.vue';
import useActionButtonVisual from './action-button/useActionButtonVisual.ts';
import useActionExecution from './action-button/useActionExecution.ts';
import type { ActionItem, ActionWidgetEmit, ActionWidgetProps } from './action-button/types.ts';
import useSplitButtonActions from './split-button/useSplitButtonActions.ts';
import useSplitButtonKeyboard from './split-button/useSplitButtonKeyboard.ts';
import useSplitButtonMenuPosition from './split-button/useSplitButtonMenuPosition.ts';

defineOptions({
  name: 'SplitButtonWidget'
});

const props = defineProps<ActionWidgetProps>();
const emit = defineEmits<ActionWidgetEmit>();

const getConfirmModal = inject<() => unknown | null>('getConfirmModal', () => null);
const openUiModal = inject<((modalName: string) => Promise<unknown> | unknown) | null>(
  'openUiModal',
  null
);
const closeUiModal = inject<(() => Promise<unknown> | unknown) | null>(
  'closeUiModal',
  null
);

const controlRoot = ref<HTMLElement | null>(null);
const toggleButton = ref<HTMLButtonElement | null>(null);
const dropdownMenu = ref<HTMLElement | null>(null);

const isDropdownOpen = ref(false);
const isMenuMeasuring = ref(false);
const highlightedIndex = ref(-1);
const openCycleId = ref(0);
const listId = `split-${Math.random().toString(36).slice(2, 9)}`;

let isComponentUnmounted = false;
let clickOutsideTimerId = 0;
let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;
let scrollHandler: EventListener | null = null;
let resizeHandler: EventListener | null = null;

const {
  displayActionKeys,
  displayActions,
  ensureActionLabelsResolved,
  hasActions,
  pruneResolvedLabels
} = useSplitButtonActions(props);

const {
  cancelDeferredWork,
  isMenuScrollable,
  menuStyle,
  resetMenuLayout,
  scheduleMenuLayout
} = useSplitButtonMenuPosition(controlRoot, dropdownMenu);

const { executeAction } = useActionExecution(props, emit, {
  closeUiModal,
  getConfirmModal,
  openUiModal
});

const menuId = computed(() => `split-button-menu-${listId}`);
const {
  buttonClasses,
  buttonLabel,
  buttonTitle,
  iconName,
  iconStyle,
  splitControlStyle: controlStyle,
  splitPrimaryStyle: primaryStyle,
  supportingText
} = useActionButtonVisual(props, { fallbackTitle: 'Split button' });

const toggleTitle = computed(() =>
  hasActions.value
    ? 'Открыть список действий'
    : 'Нет доступных действий'
);

function isOpenCycleCurrent(cycleId: number): boolean {
  return !isComponentUnmounted && isDropdownOpen.value && cycleId === openCycleId.value;
}

function isLayoutCycleCurrent(cycleId: number): boolean {
  return (
    !isComponentUnmounted &&
    cycleId === openCycleId.value &&
    (isDropdownOpen.value || isMenuMeasuring.value)
  );
}

function onToggleClick(): void {
  if (!hasActions.value) {
    return;
  }

  if (isDropdownOpen.value) {
    closeDropdown({ restoreFocus: true });
    return;
  }

  openDropdown({ focusIndex: 0 });
}

function openDropdown(options: { focusIndex?: number } = {}): void {
  if (!hasActions.value) {
    return;
  }

  ensureActionLabelsResolved();
  openCycleId.value += 1;
  const currentCycleId = openCycleId.value;
  const requestedFocusIndex = Number.isInteger(options.focusIndex)
    ? Number(options.focusIndex)
    : 0;
  const focusIndex = getSafeHighlightIndex(requestedFocusIndex);

  isMenuMeasuring.value = true;
  isDropdownOpen.value = false;
  highlightedIndex.value = focusIndex;
  resetMenuLayout();

  void nextTick(() => {
    if (!isLayoutCycleCurrent(currentCycleId)) {
      return;
    }

    if (dropdownMenu.value) {
      dropdownMenu.value.scrollTop = 0;
    }

    scheduleMenuLayout({
      isCurrent: () => isLayoutCycleCurrent(currentCycleId),
      onAfterLayout: () => {
        focusMenuItem(focusIndex);
      },
      onMeasured: () => {
        isMenuMeasuring.value = false;
        isDropdownOpen.value = true;
        addClickOutsideListener();
        addViewportListeners();
      },
      resetScroll: true
    });
  });
}

function closeDropdown(options: { restoreFocus?: boolean } = {}): void {
  openCycleId.value += 1;
  const shouldRestoreFocus = options.restoreFocus === true;
  cancelDeferredWork();
  removeClickOutsideListener();
  removeViewportListeners();

  if (!isDropdownOpen.value) {
    isMenuMeasuring.value = false;
    resetMenuLayout();
    if (shouldRestoreFocus) {
      toggleButton.value?.focus();
    }
    return;
  }

  isDropdownOpen.value = false;
  isMenuMeasuring.value = false;
  highlightedIndex.value = -1;
  resetMenuLayout();

  if (shouldRestoreFocus) {
    void nextTick(() => {
      toggleButton.value?.focus();
    });
  }
}

function onActionClick(action: ActionItem): void {
  closeDropdown({ restoreFocus: true });
  void executeAction(action);
}

function isFocusInsideWidget(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  const active = document.activeElement;
  return Boolean(
    active &&
    (
      (controlRoot.value && controlRoot.value.contains(active)) ||
      (dropdownMenu.value && dropdownMenu.value.contains(active))
    )
  );
}

function scheduleOpenMenuLayout(options: { focusAfterLayout?: boolean; focusIndex?: number } = {}): void {
  const currentCycleId = openCycleId.value;
  scheduleMenuLayout({
    isCurrent: () => isOpenCycleCurrent(currentCycleId),
    onAfterLayout: () => {
      if (options.focusAfterLayout === true) {
        focusMenuItem(options.focusIndex ?? highlightedIndex.value);
        return;
      }

      if (highlightedIndex.value >= 0) {
        scrollHighlightedItemIntoView();
      }
    },
    resetScroll: false
  });
}

function addViewportListeners(): void {
  removeViewportListeners();

  scrollHandler = () => {
    if (isDropdownOpen.value) {
      scheduleOpenMenuLayout();
    }
  };
  resizeHandler = () => {
    if (isDropdownOpen.value) {
      scheduleOpenMenuLayout();
    }
  };

  window.addEventListener('scroll', scrollHandler, true);
  window.addEventListener('resize', resizeHandler);
}

function removeViewportListeners(): void {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler, true);
    scrollHandler = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
}

function addClickOutsideListener(): void {
  removeClickOutsideListener();
  clickOutsideHandler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const inRoot = Boolean(controlRoot.value && controlRoot.value.contains(target));
    const inMenu = Boolean(dropdownMenu.value && dropdownMenu.value.contains(target));
    if (!inRoot && !inMenu) {
      closeDropdown({ restoreFocus: false });
    }
  };

  clickOutsideTimerId = window.setTimeout(() => {
    clickOutsideTimerId = 0;
    if (clickOutsideHandler) {
      document.addEventListener('click', clickOutsideHandler);
    }
  }, 0);
}

function removeClickOutsideListener(): void {
  if (clickOutsideTimerId) {
    window.clearTimeout(clickOutsideTimerId);
    clickOutsideTimerId = 0;
  }

  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler);
    clickOutsideHandler = null;
  }
}

const {
  focusMenuItem,
  getSafeHighlightIndex,
  onItemKeydown,
  onToggleKeydown,
  scrollHighlightedItemIntoView
} = useSplitButtonKeyboard({
  closeDropdown,
  displayActions,
  dropdownMenu,
  highlightedIndex,
  isDropdownOpen,
  onActionClick,
  openDropdown,
  toggleButton
});

watch(displayActionKeys, (newKeys, oldKeys) => {
  pruneResolvedLabels(newKeys);

  if (!isDropdownOpen.value && !isMenuMeasuring.value) {
    return;
  }

  if (!newKeys.length) {
    closeDropdown({ restoreFocus: false });
    return;
  }

  const currentKey =
    Array.isArray(oldKeys) &&
    highlightedIndex.value >= 0 &&
    highlightedIndex.value < oldKeys.length
      ? oldKeys[highlightedIndex.value]
      : null;
  const nextIndex = currentKey ? newKeys.indexOf(currentKey) : -1;
  const safeIndex = nextIndex >= 0 ? nextIndex : 0;
  const shouldRestoreFocus = isFocusInsideWidget();

  highlightedIndex.value = safeIndex;
  void nextTick(() => {
    if (!isDropdownOpen.value) {
      return;
    }

    scheduleOpenMenuLayout({
      focusAfterLayout: shouldRestoreFocus,
      focusIndex: safeIndex
    });
  });
});

onBeforeUnmount(() => {
  isComponentUnmounted = true;
  cancelDeferredWork();
  removeClickOutsideListener();
  removeViewportListeners();
  closeDropdown({ restoreFocus: false });
});
</script>
