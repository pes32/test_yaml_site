import { nextTick, type ComputedRef, type Ref } from 'vue';
import type { ActionItem } from '../action-button/types.ts';
import type { SplitButtonDisplayAction } from './types.ts';
import { getFocusableItems } from './utils.ts';

type CloseDropdownOptions = {
  restoreFocus?: boolean;
};

type OpenDropdownOptions = {
  focusIndex?: number;
};

type UseSplitButtonKeyboardOptions = {
  closeDropdown: (options?: CloseDropdownOptions) => void;
  displayActions: ComputedRef<SplitButtonDisplayAction[]>;
  dropdownMenu: Ref<HTMLElement | null>;
  highlightedIndex: Ref<number>;
  isDropdownOpen: Ref<boolean>;
  onActionClick: (action: ActionItem) => void;
  openDropdown: (options?: OpenDropdownOptions) => void;
  toggleButton: Ref<HTMLButtonElement | null>;
};

function useSplitButtonKeyboard(options: UseSplitButtonKeyboardOptions) {
  function getMenuItems(): HTMLElement[] {
    const menu = options.dropdownMenu.value;
    if (!menu) {
      return [];
    }
    return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  function getSafeHighlightIndex(index: number): number {
    if (!options.displayActions.value.length) {
      return -1;
    }

    if (!Number.isInteger(index)) {
      return 0;
    }

    return Math.max(0, Math.min(index, options.displayActions.value.length - 1));
  }

  function scrollHighlightedItemIntoView(): void {
    const items = options.dropdownMenu.value?.querySelectorAll('[role="presentation"]');
    if (
      !items ||
      options.highlightedIndex.value < 0 ||
      options.highlightedIndex.value >= items.length
    ) {
      return;
    }

    const element =
      items[options.highlightedIndex.value]?.querySelector('.dropdown-item') ||
      items[options.highlightedIndex.value];
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }

  function focusMenuItem(index: number): void {
    const menuItems = getMenuItems();
    if (!menuItems.length) {
      return;
    }

    const safeIndex = getSafeHighlightIndex(index);
    if (safeIndex < 0) {
      return;
    }

    options.highlightedIndex.value = safeIndex;
    const target = menuItems[safeIndex];
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
    scrollHighlightedItemIntoView();
  }

  function moveFocusRelativeToToggle(direction: number): void {
    const toggleButton = options.toggleButton.value;
    if (!toggleButton || typeof document === 'undefined') {
      return;
    }

    const focusableItems = getFocusableItems();
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

  function onToggleKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options.openDropdown({ focusIndex: 0 });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      options.openDropdown({ focusIndex: options.displayActions.value.length - 1 });
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options.isDropdownOpen.value) {
        options.closeDropdown({ restoreFocus: true });
      } else {
        options.openDropdown({ focusIndex: 0 });
      }
      return;
    }

    if (event.key === 'Escape' && options.isDropdownOpen.value) {
      event.preventDefault();
      options.closeDropdown({ restoreFocus: true });
    }
  }

  function onItemKeydown(event: KeyboardEvent, index: number): void {
    if (!options.isDropdownOpen.value) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusMenuItem(index + 1 >= options.displayActions.value.length ? 0 : index + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusMenuItem(index - 1 < 0 ? options.displayActions.value.length - 1 : index - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const selectedAction = options.displayActions.value[index]?.item;
      if (selectedAction) {
        options.onActionClick(selectedAction);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      options.closeDropdown({ restoreFocus: true });
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const moveDirection = event.shiftKey ? -1 : 1;
      options.closeDropdown({ restoreFocus: false });
      void nextTick(() => {
        moveFocusRelativeToToggle(moveDirection);
      });
    }
  }

  return {
    focusMenuItem,
    getSafeHighlightIndex,
    onItemKeydown,
    onToggleKeydown,
    scrollHighlightedItemIntoView
  };
}

export default useSplitButtonKeyboard;
