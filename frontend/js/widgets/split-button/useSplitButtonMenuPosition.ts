import { nextTick, onBeforeUnmount, shallowRef, type Ref } from 'vue';
import type { SplitButtonMenuLayout, SplitButtonMenuStyle } from './types.ts';
import {
  MAX_VISIBLE_ACTION_ROWS,
  clamp,
  getViewportPadding,
  parsePixelValue
} from './utils.ts';

type ScheduleMenuLayoutOptions = {
  attempt?: number;
  isCurrent: () => boolean;
  onAfterLayout?: () => void;
  onMeasured?: () => void;
  resetScroll?: boolean;
};

function useSplitButtonMenuPosition(
  controlRoot: Ref<HTMLElement | null>,
  dropdownMenu: Ref<HTMLElement | null>
) {
  const menuStyle = shallowRef<SplitButtonMenuStyle>({});
  const isMenuScrollable = shallowRef(false);

  let layoutFrameId = 0;
  let postLayoutFrameId = 0;

  function cancelLayoutFrame(): void {
    if (layoutFrameId) {
      window.cancelAnimationFrame(layoutFrameId);
      layoutFrameId = 0;
    }
  }

  function cancelPostLayoutFrame(): void {
    if (postLayoutFrameId) {
      window.cancelAnimationFrame(postLayoutFrameId);
      postLayoutFrameId = 0;
    }
  }

  function cancelDeferredWork(): void {
    cancelLayoutFrame();
    cancelPostLayoutFrame();
  }

  function resetMenuLayout(): void {
    menuStyle.value = {};
    isMenuScrollable.value = false;
  }

  function getVisibleMenuItems(): HTMLElement[] {
    const menu = dropdownMenu.value;
    if (!menu) {
      return [];
    }

    return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
      (element) => element.getClientRects().length > 0
    );
  }

  function measureMenuLayout(): SplitButtonMenuLayout | null {
    const toggle = controlRoot.value;
    const menu = dropdownMenu.value;
    if (!(toggle instanceof HTMLElement) || !(menu instanceof HTMLElement)) {
      return null;
    }

    const visibleMenuItems = getVisibleMenuItems();
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
    const menuChromeHeight =
      parsePixelValue(menuStyles.paddingTop) +
      parsePixelValue(menuStyles.paddingBottom) +
      parsePixelValue(menuStyles.borderTopWidth) +
      parsePixelValue(menuStyles.borderBottomWidth);
    const desiredVisibleRowCount = Math.min(visibleMenuItems.length, MAX_VISIBLE_ACTION_ROWS);
    const desiredMenuHeight = rowHeight * desiredVisibleRowCount + menuChromeHeight;

    const viewportPadding = getViewportPadding();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const toggleRect = toggle.getBoundingClientRect();
    if (!Number.isFinite(toggleRect.width) || toggleRect.width <= 0) {
      return null;
    }

    const availableWidth = Math.max(1, viewportWidth - viewportPadding * 2);
    const menuWidth = clamp(toggleRect.width, 1, availableWidth);
    const left = clamp(
      toggleRect.left,
      viewportPadding,
      viewportWidth - viewportPadding - menuWidth
    );

    const availableBelow = Math.max(0, viewportHeight - toggleRect.bottom - viewportPadding);
    const availableAbove = Math.max(0, toggleRect.top - viewportPadding);

    let placement: 'bottom' | 'top' = 'bottom';
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
    const topBase =
      placement === 'top'
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
  }

  function schedulePostLayout(isCurrent: () => boolean, callback?: () => void): void {
    cancelPostLayoutFrame();
    postLayoutFrameId = window.requestAnimationFrame(() => {
      postLayoutFrameId = 0;
      if (!isCurrent()) {
        return;
      }
      callback?.();
    });
  }

  function scheduleMenuLayout(options: ScheduleMenuLayoutOptions): void {
    const attempt = Number.isInteger(options.attempt) ? Number(options.attempt) : 0;

    cancelLayoutFrame();
    layoutFrameId = window.requestAnimationFrame(() => {
      layoutFrameId = 0;
      if (!options.isCurrent()) {
        return;
      }

      const menu = dropdownMenu.value;
      if (menu && options.resetScroll === true) {
        menu.scrollTop = 0;
      }

      const layout = measureMenuLayout();
      if (!layout) {
        if (attempt < 2) {
          void nextTick(() => {
            if (options.isCurrent()) {
              scheduleMenuLayout({
                ...options,
                attempt: attempt + 1,
                resetScroll: false
              });
            }
          });
        }
        return;
      }

      if (!options.isCurrent()) {
        return;
      }

      menuStyle.value = layout.style;
      isMenuScrollable.value = layout.isScrollable;
      options.onMeasured?.();
      schedulePostLayout(options.isCurrent, options.onAfterLayout);
    });
  }

  onBeforeUnmount(cancelDeferredWork);

  return {
    cancelDeferredWork,
    getVisibleMenuItems,
    isMenuScrollable,
    menuStyle,
    resetMenuLayout,
    scheduleMenuLayout
  };
}

export default useSplitButtonMenuPosition;
