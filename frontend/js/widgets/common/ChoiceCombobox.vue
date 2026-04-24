<template>
  <div
    ref="dropdownRoot"
    class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
    :class="{ show: isOpen }"
    :data-dropdown-open="isOpen ? 'true' : undefined"
    v-bind="rootAttrs"
  >
    <div ref="dropdownToggle" class="list-combobox-inner">
      <input
        type="text"
        class="list-combobox-input"
        data-table-editor-target="true"
        role="combobox"
        :aria-controls="menuId"
        :aria-expanded="isOpen ? 'true' : 'false'"
        :aria-activedescendant="activeDescendant || undefined"
        :value="inputValue"
        :placeholder="placeholder"
        :readonly="readonly"
        :disabled="disabled"
        :tabindex="tabindex"
        :title="inputValue"
        @input="emit('input', $event)"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
        @keydown="emit('input-keydown', $event)"
      >
      <span class="list-combobox-arrow-wrap">
        <span
          class="list-combobox-arrow"
          data-table-action-trigger="list"
          role="button"
          tabindex="-1"
          :aria-label="arrowLabel"
          @click.prevent="emit('arrow-click', $event)"
          @mousedown.prevent
        >
          <dropdown-chevron-icon></dropdown-chevron-icon>
        </span>
      </span>
    </div>
    <Teleport to="body">
      <ul
        v-if="renderMenu"
        ref="dropdownMenu"
        class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
        :id="menuId"
        :class="{ show: isOpen, scrollable: isScrollable }"
        :style="menuPosition"
        role="listbox"
        tabindex="-1"
        @keydown="emit('menu-keydown', $event)"
      >
        <li
          v-for="(item, idx) in menuItems"
          :id="itemId(idx)"
          :key="itemKey(item, idx)"
          role="option"
        >
          <a
            class="dropdown-item"
            href="#"
            :tabindex="-1"
            :class="itemClass(item, idx)"
            :title="itemTitle(item)"
            @click.prevent="emit('item-select', item, $event)"
            @mousedown.prevent="emit('item-mousedown', idx)"
          >
            <span v-text="itemLabel(item)"></span>
          </a>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue';
import DropdownChevronIcon from './DropdownChevronIcon.vue';

type ChoiceItemClass = Record<string, boolean>;

type ChoiceComboboxProps = {
  activeDescendant?: string | null;
  arrowLabel: string;
  disabled?: boolean;
  inputValue: string;
  isOpen: boolean;
  isScrollable: boolean;
  menuId: string;
  menuItems: unknown[];
  menuPosition: CSSProperties;
  placeholder?: string;
  readonly?: boolean;
  renderMenu?: boolean;
  rootAttrs?: Record<string, string>;
  tabindex?: number | string | null;
  itemClass(item: unknown, index: number): ChoiceItemClass;
  itemId(index: number): string;
  itemKey(item: unknown, index: number): string | number;
  itemLabel(item: unknown): string;
  itemTitle(item: unknown): string;
};

type ChoiceComboboxEmit = {
  (event: 'arrow-click', mouseEvent: MouseEvent): void;
  (event: 'blur', focusEvent: FocusEvent): void;
  (event: 'focus', focusEvent: FocusEvent): void;
  (event: 'input', inputEvent: Event): void;
  (event: 'input-keydown', keyboardEvent: KeyboardEvent): void;
  (event: 'item-mousedown', index: number): void;
  (event: 'item-select', item: unknown, mouseEvent: MouseEvent): void;
  (event: 'menu-keydown', keyboardEvent: KeyboardEvent): void;
};

withDefaults(defineProps<ChoiceComboboxProps>(), {
  activeDescendant: null,
  disabled: false,
  placeholder: '',
  readonly: false,
  renderMenu: true,
  rootAttrs: () => ({}),
  tabindex: null
});
const emit = defineEmits<ChoiceComboboxEmit>();

const dropdownRoot = ref<HTMLElement | null>(null);
const dropdownToggle = ref<HTMLElement | null>(null);
const dropdownMenu = ref<HTMLElement | null>(null);

defineExpose({
  dropdownMenu,
  dropdownRoot,
  dropdownToggle
});
</script>
