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
        <img
          v-if="widgetConfig.icon && !isFontIcon(widgetConfig.icon)"
          class="button-icon"
          :src="getIconSrc(widgetConfig.icon)"
          :style="iconStyle"
          alt=""
          @error="onIconError"
        >
        <i v-else-if="widgetConfig.icon && isFontIcon(widgetConfig.icon)" :class="widgetConfig.icon"></i>
        <span v-if="widgetConfig.label" class="widget-split-button__label" v-text="widgetConfig.label"></span>
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
            ref="menuItems"
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
            <span v-text="action.displayLabel"></span>
          </a>
        </li>
      </ul>
    </Teleport>

    <div v-if="widgetConfig.sup_text" class="widget-info">
      <span v-text="widgetConfig.sup_text"></span>
    </div>
  </div>
</template>

<script>
import { getIconSrc, isFontIcon, onIconError } from '../gui_parser.js';
import {
  executeAction,
  getActionFallbackLabel,
  inspectSplitButtonAttrs,
  resolveActionLabel
} from '../runtime/action_runtime.js';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

const MAX_VISIBLE_ACTION_ROWS = 10;

function parsePixelValue(value) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, minValue, maxValue) {
  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : safeMin;
  const upperBound = safeMax < safeMin ? safeMin : safeMax;
  return Math.min(Math.max(value, safeMin), upperBound);
}

function buildActionDescriptors(items) {
  const seen = new Map();
  return (Array.isArray(items) ? items : []).map((item) => {
    const baseKey = [
      item?.type || '',
      item?.target || '',
      item?.label || ''
    ].join('\u0000');
    const occurrence = seen.get(baseKey) || 0;
    seen.set(baseKey, occurrence + 1);
    return {
      key: `${baseKey}\u0000${occurrence}`,
      item
    };
  });
}

export default {
  name: 'SplitButtonWidget',
  inject: {
    getConfirmModal: { from: 'getConfirmModal', default: () => null },
    openUiModal: { from: 'openUiModal', default: null },
    closeUiModal: { from: 'closeUiModal', default: null }
  },
  props: {
    widgetConfig: {
      type: Object,
      required: true
    },
    widgetName: {
      type: String,
      required: true
    }
  },
  emits: ['execute'],
  data() {
    return {
      isDropdownOpen: false,
      isMenuMeasuring: false,
      highlightedIndex: -1,
      resolvedLabels: {},
      warnedFields: new Set(),
      isComponentUnmounted: false,
      listId: `split-${Math.random().toString(36).slice(2, 9)}`,
      menuStyle: {},
      isMenuScrollable: false,
      openCycleId: 0,
      clickOutsideTimerId: 0,
      clickOutsideHandler: null,
      scrollHandler: null,
      resizeHandler: null,
      layoutFrameId: 0,
      postLayoutFrameId: 0
    };
  },
  computed: {
    actionInspection() {
      return inspectSplitButtonAttrs(this.widgetConfig);
    },
    actions() {
      return this.actionInspection.items || [];
    },
    actionDescriptors() {
      return buildActionDescriptors(this.actions);
    },
    displayActionKeys() {
      return this.actionDescriptors.map((descriptor) => descriptor.key);
    },
    hasActions() {
      return this.actionDescriptors.length > 0;
    },
    malformedWarningsKey() {
      return JSON.stringify(this.actionInspection.malformedByField || {});
    },
    displayActions() {
      return this.actionDescriptors.map((descriptor) => ({
        key: descriptor.key,
        item: descriptor.item,
        displayLabel: this.resolvedLabels[descriptor.key] || getActionFallbackLabel(descriptor.item)
      }));
    },
    menuId() {
      return `split-button-menu-${this.listId}`;
    },
    isIconOnly() {
      return Boolean(this.widgetConfig.icon && !this.widgetConfig.label);
    },
    hasBackground() {
      return Boolean(this.widgetConfig.fon);
    },
    buttonClasses() {
      return {
        'icon-only': this.isIconOnly,
        'icon-only--ghost': this.isIconOnly && !this.hasBackground
      };
    },
    buttonTitle() {
      if (this.isIconOnly && this.widgetConfig.hint) return this.widgetConfig.hint;
      if (this.widgetConfig.label) return this.widgetConfig.label;
      return 'Split button';
    },
    toggleTitle() {
      return this.hasActions
        ? 'Открыть список действий'
        : 'Нет доступных действий';
    },
    iconStyle() {
      if (!this.widgetConfig.icon || isFontIcon(this.widgetConfig.icon)) {
        return {};
      }

      const size = Number(this.widgetConfig.size) || 24;
      return {
        width: `${size}px`,
        height: `${size}px`
      };
    },
    controlStyle() {
      const widthValue = this.widgetConfig.width;
      if (widthValue == null || widthValue === '') {
        return {};
      }

      return {
        width: typeof widthValue === 'number' ? `${widthValue}px` : String(widthValue)
      };
    },
    primaryStyle() {
      if (this.controlStyle.width) {
        return {
          justifyContent: this.widgetConfig.label ? 'flex-start' : 'center',
          textAlign: 'left'
        };
      }

      if (this.isIconOnly) {
        const iconRef = 24;
        const outerRef = 40;
        const borderTotal = 2;
        const padRef = (outerRef - borderTotal - iconRef) / 2;
        const iconSize = Number(this.widgetConfig.size) || iconRef;
        const pad = Math.max(0, Math.round((padRef * iconSize) / iconRef));
        const widthValue = iconSize + borderTotal + 2 * pad;

        return {
          width: `${widthValue}px`,
          minWidth: `${widthValue}px`,
          padding: `${pad}px`
        };
      }

      return {
        justifyContent: this.widgetConfig.label ? 'flex-start' : 'center',
        textAlign: 'left'
      };
    }
  },
  methods: {
    isFontIcon,
    getIconSrc,
    onIconError,
    emitMalformedWarnings() {
      const malformedByField = this.actionInspection.malformedByField || {};
      Object.entries(malformedByField).forEach(([fieldName, lineNumbers]) => {
        if (this.warnedFields.has(fieldName) || !Array.isArray(lineNumbers) || !lineNumbers.length) {
          return;
        }

        this.warnedFields.add(fieldName);
        console.warn(
          `[split_button] malformed DSL lines skipped for widget "${this.widgetName}" ` +
          `field "${fieldName}": ${lineNumbers.join(', ')}`
        );
      });
    },
    pruneResolvedLabels(validKeys) {
      const nextLabels = {};
      (Array.isArray(validKeys) ? validKeys : []).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(this.resolvedLabels, key)) {
          nextLabels[key] = this.resolvedLabels[key];
        }
      });
      this.resolvedLabels = nextLabels;
    },
    getViewportPadding() {
      const rootStyles = window.getComputedStyle(document.documentElement);
      return parsePixelValue(rootStyles.getPropertyValue('--space-sm')) || 8;
    },
    getSafeHighlightIndex(index) {
      if (!this.displayActions.length) {
        return -1;
      }

      if (!Number.isInteger(index)) {
        return 0;
      }

      return Math.max(0, Math.min(index, this.displayActions.length - 1));
    },
    isOpenCycleCurrent(cycleId) {
      return !this.isComponentUnmounted && this.isDropdownOpen && cycleId === this.openCycleId;
    },
    isLayoutCycleCurrent(cycleId) {
      return (
        !this.isComponentUnmounted &&
        cycleId === this.openCycleId &&
        (this.isDropdownOpen || this.isMenuMeasuring)
      );
    },
    cancelLayoutFrame() {
      if (this.layoutFrameId) {
        window.cancelAnimationFrame(this.layoutFrameId);
        this.layoutFrameId = 0;
      }
    },
    cancelPostLayoutFrame() {
      if (this.postLayoutFrameId) {
        window.cancelAnimationFrame(this.postLayoutFrameId);
        this.postLayoutFrameId = 0;
      }
    },
    cancelDeferredWork() {
      this.cancelLayoutFrame();
      this.cancelPostLayoutFrame();
    },
    onToggleClick() {
      if (!this.hasActions) {
        return;
      }

      if (this.isDropdownOpen) {
        this.closeDropdown({ restoreFocus: true });
        return;
      }

      this.openDropdown({ focusIndex: 0 });
    },
    onToggleKeydown(event) {
      if (!this.hasActions) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.openDropdown({ focusIndex: 0 });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.openDropdown({ focusIndex: this.displayActions.length - 1 });
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (this.isDropdownOpen) {
          this.closeDropdown({ restoreFocus: true });
        } else {
          this.openDropdown({ focusIndex: 0 });
        }
        return;
      }

      if (event.key === 'Escape' && this.isDropdownOpen) {
        event.preventDefault();
        this.closeDropdown({ restoreFocus: true });
      }
    },
    onItemKeydown(event, index) {
      if (!this.isDropdownOpen) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.focusMenuItem(index + 1 >= this.displayActions.length ? 0 : index + 1);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.focusMenuItem(index - 1 < 0 ? this.displayActions.length - 1 : index - 1);
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const selectedAction = this.displayActions[index]?.item;
        if (selectedAction) {
          this.onActionClick(selectedAction);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeDropdown({ restoreFocus: true });
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const moveDirection = event.shiftKey ? -1 : 1;
        this.closeDropdown({ restoreFocus: false });
        this.$nextTick(() => {
          this.moveFocusRelativeToToggle(moveDirection);
        });
      }
    },
    onActionClick(action) {
      this.closeDropdown({ restoreFocus: true });
      void executeAction(this, action, {
        dialog: this.widgetConfig.dialog || null,
        outputAttrs: this.widgetConfig.output_attrs,
        widgetName: this.widgetName
      });
    },
    openDropdown(options = {}) {
      if (!this.hasActions) {
        return;
      }

      this.ensureActionLabelsResolved();
      this.openCycleId += 1;
      const currentCycleId = this.openCycleId;
      const focusIndex = this.getSafeHighlightIndex(options.focusIndex);

      this.isMenuMeasuring = true;
      this.isDropdownOpen = false;
      this.isMenuScrollable = false;
      this.highlightedIndex = focusIndex;

      this.$nextTick(() => {
        if (!this.isLayoutCycleCurrent(currentCycleId)) {
          return;
        }

        const menu = this.$refs.dropdownMenu;
        if (menu) {
          menu.scrollTop = 0;
        }

        this.scheduleMenuLayout({
          cycleId: currentCycleId,
          focusIndex,
          openAfterMeasure: true,
          focusAfterLayout: true,
          resetScroll: true
        });
      });
    },
    closeDropdown(options = {}) {
      this.openCycleId += 1;
      const shouldRestoreFocus = options.restoreFocus === true;
      this.cancelDeferredWork();
      this.removeClickOutsideListener();
      this.removeViewportListeners();

      if (!this.isDropdownOpen) {
        this.isMenuMeasuring = false;
        this.isMenuScrollable = false;
        if (shouldRestoreFocus) {
          this.$refs.toggleButton?.focus();
        }
        return;
      }

      this.isDropdownOpen = false;
      this.isMenuMeasuring = false;
      this.highlightedIndex = -1;
      this.isMenuScrollable = false;

      if (shouldRestoreFocus) {
        this.$nextTick(() => {
          this.$refs.toggleButton?.focus();
        });
      }
    },
    getMenuItems() {
      const menuItems = this.$refs.menuItems;
      return Array.isArray(menuItems)
        ? menuItems
        : menuItems
          ? [menuItems]
          : [];
    },
    getVisibleMenuItems() {
      return this.getMenuItems().filter((element) =>
        element instanceof HTMLElement && element.getClientRects().length > 0
      );
    },
    focusMenuItem(index) {
      const menuItems = this.getMenuItems();
      if (!menuItems.length) {
        return;
      }

      const safeIndex = this.getSafeHighlightIndex(index);
      if (safeIndex < 0) {
        return;
      }

      this.highlightedIndex = safeIndex;
      const target = menuItems[safeIndex];
      if (target && typeof target.focus === 'function') {
        target.focus();
      }
      this.scrollHighlightedItemIntoView();
    },
    scrollHighlightedItemIntoView() {
      const items = this.$refs.dropdownMenu?.querySelectorAll('[role="presentation"]');
      if (!items || this.highlightedIndex < 0 || this.highlightedIndex >= items.length) {
        return;
      }

      const element =
        items[this.highlightedIndex]?.querySelector('.dropdown-item') ||
        items[this.highlightedIndex];
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ block: 'nearest' });
      }
    },
    ensureActionLabelsResolved() {
      this.actionDescriptors.forEach((descriptor) => {
        if (Object.prototype.hasOwnProperty.call(this.resolvedLabels, descriptor.key)) {
          return;
        }

        void resolveActionLabel(descriptor.item)
          .then((resolvedLabel) => {
            if (this.isComponentUnmounted) {
              return;
            }

            const nextLabel = String(resolvedLabel || '').trim();
            if (!nextLabel || nextLabel === getActionFallbackLabel(descriptor.item)) {
              return;
            }

            this.resolvedLabels = {
              ...this.resolvedLabels,
              [descriptor.key]: nextLabel
            };
          })
          .catch(() => {});
      });
    },
    isFocusInsideWidget() {
      const root = this.$refs.controlRoot;
      const menu = this.$refs.dropdownMenu;
      const active = document.activeElement;
      if (root && active && root.contains(active)) {
        return true;
      }
      return Boolean(menu && active && menu.contains(active));
    },
    measureMenuLayout() {
      const toggle = this.$refs.controlRoot;
      const menu = this.$refs.dropdownMenu;
      if (!(toggle instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
        return null;
      }

      const visibleMenuItems = this.getVisibleMenuItems();
      const rowElement = visibleMenuItems[0];
      if (!(rowElement instanceof HTMLElement)) {
        return null;
      }

      const rowRect = rowElement.getBoundingClientRect();
      const rowStyles = window.getComputedStyle(rowElement);
      const rowHeight = rowRect.height;
      const fontSize = parsePixelValue(rowStyles.fontSize);
      if (
        !Number.isFinite(rowHeight) ||
        rowHeight <= 0 ||
        !Number.isFinite(fontSize) ||
        rowHeight < fontSize
      ) {
        return null;
      }

      const menuStyles = window.getComputedStyle(menu);
      const paddingTop = parsePixelValue(menuStyles.paddingTop);
      const paddingBottom = parsePixelValue(menuStyles.paddingBottom);
      const borderTopWidth = parsePixelValue(menuStyles.borderTopWidth);
      const borderBottomWidth = parsePixelValue(menuStyles.borderBottomWidth);
      const menuChromeHeight =
        paddingTop +
        paddingBottom +
        borderTopWidth +
        borderBottomWidth;

      const desiredVisibleRowCount = Math.min(visibleMenuItems.length, MAX_VISIBLE_ACTION_ROWS);
      const desiredMenuHeight = rowHeight * desiredVisibleRowCount + menuChromeHeight;

      const viewportPadding = this.getViewportPadding();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const toggleRect = toggle.getBoundingClientRect();
      if (!Number.isFinite(toggleRect.width) || toggleRect.width <= 0) {
        return null;
      }

      const availableWidth = Math.max(1, viewportWidth - viewportPadding * 2);
      const menuWidth = Math.min(Math.max(toggleRect.width, 1), availableWidth);
      const left = clamp(
        toggleRect.left,
        viewportPadding,
        viewportWidth - viewportPadding - menuWidth
      );

      const availableBelow = Math.max(0, viewportHeight - toggleRect.bottom - viewportPadding);
      const availableAbove = Math.max(0, toggleRect.top - viewportPadding);

      let placement = 'bottom';
      let availableHeight = availableBelow;
      if (availableBelow >= desiredMenuHeight) {
        placement = 'bottom';
        availableHeight = availableBelow;
      } else if (availableAbove >= desiredMenuHeight) {
        placement = 'top';
        availableHeight = availableAbove;
      } else if (availableAbove > availableBelow) {
        placement = 'top';
        availableHeight = availableAbove;
      }

      const targetMaxHeight = Math.max(0, Math.min(desiredMenuHeight, availableHeight));
      const topBase = placement === 'top'
        ? toggleRect.top - targetMaxHeight
        : toggleRect.bottom;
      const top = clamp(
        topBase,
        viewportPadding,
        viewportHeight - viewportPadding - targetMaxHeight
      );
      const isScrollable =
        visibleMenuItems.length > MAX_VISIBLE_ACTION_ROWS ||
        targetMaxHeight + 0.5 < desiredMenuHeight;

      return {
        isScrollable,
        style: {
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: `${menuWidth}px`,
          minWidth: `${menuWidth}px`,
          '--split-menu-max-height': `${targetMaxHeight}px`
        }
      };
    },
    schedulePostLayout(cycleId, options = {}) {
      this.cancelPostLayoutFrame();
      this.postLayoutFrameId = window.requestAnimationFrame(() => {
        this.postLayoutFrameId = 0;
        if (!this.isOpenCycleCurrent(cycleId)) {
          return;
        }

        if (options.focusAfterLayout === true) {
          this.focusMenuItem(options.focusIndex);
          return;
        }

        if (this.highlightedIndex >= 0) {
          this.scrollHighlightedItemIntoView();
        }
      });
    },
    scheduleMenuLayout(options = {}) {
      const cycleId = Number.isInteger(options.cycleId)
        ? options.cycleId
        : this.openCycleId;
      const attempt = Number.isInteger(options.attempt) ? options.attempt : 0;

      this.cancelLayoutFrame();
      this.layoutFrameId = window.requestAnimationFrame(() => {
        this.layoutFrameId = 0;
        if (!this.isLayoutCycleCurrent(cycleId)) {
          return;
        }

        const menu = this.$refs.dropdownMenu;
        if (menu && options.resetScroll === true) {
          menu.scrollTop = 0;
        }

        const layout = this.measureMenuLayout();
        if (!layout) {
          if (attempt < 2) {
            this.$nextTick(() => {
              if (this.isLayoutCycleCurrent(cycleId)) {
                this.scheduleMenuLayout({
                  ...options,
                  cycleId,
                  attempt: attempt + 1,
                  resetScroll: false
                });
              }
            });
          }
          return;
        }

        if (!this.isLayoutCycleCurrent(cycleId)) {
          return;
        }

        this.menuStyle = layout.style;
        this.isMenuScrollable = layout.isScrollable;

        if (options.openAfterMeasure === true) {
          this.isMenuMeasuring = false;
          this.isDropdownOpen = true;
          this.addClickOutsideListener();
          this.addViewportListeners();

          this.$nextTick(() => {
            if (!this.isOpenCycleCurrent(cycleId)) {
              return;
            }
            this.schedulePostLayout(cycleId, options);
          });
          return;
        }

        this.schedulePostLayout(cycleId, options);
      });
    },
    addViewportListeners() {
      this.removeViewportListeners();

      this.scrollHandler = () => {
        if (!this.isDropdownOpen) {
          return;
        }

        this.scheduleMenuLayout({
          cycleId: this.openCycleId,
          focusAfterLayout: false,
          focusIndex: this.getSafeHighlightIndex(this.highlightedIndex),
          resetScroll: false
        });
      };
      this.resizeHandler = () => {
        if (!this.isDropdownOpen) {
          return;
        }

        this.scheduleMenuLayout({
          cycleId: this.openCycleId,
          focusAfterLayout: false,
          focusIndex: this.getSafeHighlightIndex(this.highlightedIndex),
          resetScroll: false
        });
      };

      window.addEventListener('scroll', this.scrollHandler, true);
      window.addEventListener('resize', this.resizeHandler);
    },
    removeViewportListeners() {
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler, true);
        this.scrollHandler = null;
      }

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = null;
      }
    },
    addClickOutsideListener() {
      this.removeClickOutsideListener();
      this.clickOutsideHandler = (event) => {
        const target = event.target;
        const root = this.$refs.controlRoot;
        const menu = this.$refs.dropdownMenu;
        const inRoot = root && target && root.contains(target);
        const inMenu = menu && target && menu.contains(target);
        if (!inRoot && !inMenu) {
          this.closeDropdown({ restoreFocus: false });
        }
      };

      this.clickOutsideTimerId = window.setTimeout(() => {
        this.clickOutsideTimerId = 0;
        if (this.clickOutsideHandler) {
          document.addEventListener('click', this.clickOutsideHandler);
        }
      }, 0);
    },
    removeClickOutsideListener() {
      if (this.clickOutsideTimerId) {
        window.clearTimeout(this.clickOutsideTimerId);
        this.clickOutsideTimerId = 0;
      }

      if (this.clickOutsideHandler) {
        document.removeEventListener('click', this.clickOutsideHandler);
        this.clickOutsideHandler = null;
      }
    },
    moveFocusRelativeToToggle(direction) {
      const toggleButton = this.$refs.toggleButton;
      if (!toggleButton || typeof document === 'undefined') {
        return;
      }

      const focusableItems = Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          if (element.hasAttribute('disabled')) {
            return false;
          }
          if (element.getAttribute('aria-hidden') === 'true') {
            return false;
          }
          return element.offsetParent !== null || document.activeElement === element;
        });

      const currentIndex = focusableItems.indexOf(toggleButton);
      if (currentIndex === -1) {
        return;
      }

      const step = direction < 0 ? -1 : 1;
      let nextIndex = currentIndex + step;
      while (nextIndex >= 0 && nextIndex < focusableItems.length) {
        const candidate = focusableItems[nextIndex];
        if (candidate && typeof candidate.focus === 'function') {
          candidate.focus();
          break;
        }
        nextIndex += step;
      }
    }
  },
  watch: {
    malformedWarningsKey: {
      immediate: true,
      handler() {
        this.emitMalformedWarnings();
      }
    },
    displayActionKeys(newKeys, oldKeys) {
      this.pruneResolvedLabels(newKeys);

      if (!this.isDropdownOpen && !this.isMenuMeasuring) {
        return;
      }

      if (!newKeys.length) {
        this.closeDropdown({ restoreFocus: false });
        return;
      }

      const currentKey =
        Array.isArray(oldKeys) &&
        this.highlightedIndex >= 0 &&
        this.highlightedIndex < oldKeys.length
          ? oldKeys[this.highlightedIndex]
          : null;
      const nextIndex = currentKey ? newKeys.indexOf(currentKey) : -1;
      const safeIndex = nextIndex >= 0 ? nextIndex : 0;
      const shouldRestoreFocus = this.isFocusInsideWidget();

      this.highlightedIndex = safeIndex;
      this.$nextTick(() => {
        if (!this.isDropdownOpen) {
          return;
        }

        this.scheduleMenuLayout({
          cycleId: this.openCycleId,
          focusAfterLayout: shouldRestoreFocus,
          focusIndex: safeIndex,
          resetScroll: false
        });
      });
    }
  },
  beforeUnmount() {
    this.isComponentUnmounted = true;
    this.cancelDeferredWork();
    this.removeClickOutsideListener();
    this.removeViewportListeners();
    this.closeDropdown({ restoreFocus: false });
  }
};
</script>
