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
        <dropdown-chevron-icon></dropdown-chevron-icon>
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
  nextTick,
  onBeforeUnmount,
  ref,
  watch
} from 'vue';
import ActionButtonContent from './action-button/ActionButtonContent.vue';
import useActionWidgetBase from './action-button/useActionWidgetBase.ts';
import DropdownChevronIcon from './common/DropdownChevronIcon.vue';
import type { ActionItem, ActionWidgetEmit, ActionWidgetProps } from './action-button/types.ts';
import {
  createDropdownOutsideClickController,
  createDropdownViewportController
} from './dropdown/dropdown_runtime.ts';
import useSplitButtonActions from './split-button/useSplitButtonActions.ts';
import useSplitButtonKeyboard from './split-button/useSplitButtonKeyboard.ts';
import useSplitButtonMenuPosition from './split-button/useSplitButtonMenuPosition.ts';

defineOptions({
  name: 'SplitButtonWidget'
});

const props = defineProps<ActionWidgetProps>();
const emit = defineEmits<ActionWidgetEmit>();

const controlRoot = ref<HTMLElement | null>(null);
const toggleButton = ref<HTMLButtonElement | null>(null);
const dropdownMenu = ref<HTMLElement | null>(null);

const isDropdownOpen = ref(false);
const isMenuMeasuring = ref(false);
const highlightedIndex = ref(-1);
const openCycleId = ref(0);
const listId = `split-${Math.random().toString(36).slice(2, 9)}`;

let isComponentUnmounted = false;

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
const outsideClickController = createDropdownOutsideClickController({
  getElements: () => [controlRoot.value, dropdownMenu.value],
  onOutsideClick: () => closeDropdown({ restoreFocus: false })
});
const viewportController = createDropdownViewportController({
  onResize: () => {
    if (isDropdownOpen.value) {
      scheduleOpenMenuLayout();
    }
  },
  onScroll: () => {
    if (isDropdownOpen.value) {
      scheduleOpenMenuLayout();
    }
  }
});

const menuId = computed(() => `split-button-menu-${listId}`);
const {
  buttonClasses,
  buttonLabel,
  buttonTitle,
  iconName,
  iconStyle,
  executeAction,
  splitControlStyle: controlStyle,
  splitPrimaryStyle: primaryStyle,
  supportingText
} = useActionWidgetBase(props, emit, { fallbackTitle: 'Split button' });

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
        outsideClickController.add();
        viewportController.add();
      },
      resetScroll: true
    });
  });
}

function closeDropdown(options: { restoreFocus?: boolean } = {}): void {
  openCycleId.value += 1;
  const shouldRestoreFocus = options.restoreFocus === true;
  cancelDeferredWork();
  outsideClickController.remove();
  viewportController.remove();

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
  outsideClickController.remove();
  viewportController.remove();
  closeDropdown({ restoreFocus: false });
});
</script>
