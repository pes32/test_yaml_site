// Виджет для списков (list)

import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';
import { normalizeListOptions } from '../runtime/widget_contract.js';

const ListWidget = {
    components: { Md3Field },
    mixins: [widgetMixin],
    props: {
        widgetConfig: { type: Object, required: true },
        widgetName: { type: String, required: true }
    },
    emits: ['input'],
    template: `
        <md3-field
            :widget-config="widgetConfig"
            :has-value="hasValue"
            :label-floats="labelFloats"
            :is-focused="isFocused"
            :wrap-extra="{ 'md3-dropdown-wrap': true }"
            :has-supporting="!!widgetConfig.sup_text"
            @focusout="onWidgetFocusOut"
            @container-focusout="onWidgetFocusOut">
            <div class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
                 :class="{ show: isDropdownOpen }"
                 :data-dropdown-open="isDropdownOpen ? 'true' : undefined"
                 v-bind="tableCellRootAttrs"
                 ref="dropdownRoot">
                <div class="list-combobox-inner" ref="dropdownToggle">
                    <input type="text"
                           class="list-combobox-input"
                           data-table-editor-target="true"
                           role="combobox"
                           :aria-controls="listMenuId"
                           :aria-expanded="isDropdownOpen ? 'true' : 'false'"
                           :aria-activedescendant="highlightedId || undefined"
                           :value="inputDisplayValue"
                           @input="onInputChange"
                           @focus="onInputFocus"
                           @blur="onInputBlur"
                           @keydown="onInputKeydown"
                           :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                           :readonly="!isEditable || widgetConfig.multiselect"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           :title="inputDisplayValue">
                        <span class="list-combobox-arrow-wrap">
                            <span class="list-combobox-arrow"
                              data-table-action-trigger="list"
                              role="button"
                              tabindex="-1"
                              aria-label="Развернуть список"
                              @click.prevent="onArrowClick"
                              @mousedown.prevent>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                            </svg>
                        </span>
                    </span>
                </div>
                <Teleport to="body">
                    <ul class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
                        :id="listMenuId"
                        :class="{ show: isDropdownOpen, scrollable: filteredOptions.length > 10 }"
                        :style="menuPosition"
                        role="listbox"
                        tabindex="-1"
                        @keydown="onMenuKeydown"
                        ref="dropdownMenu">
                        <li v-for="(option, idx) in filteredOptions"
                            :key="option.id"
                            role="option"
                            :id="listItemId(idx)">
                            <a class="dropdown-item"
                               href="#"
                               :tabindex="-1"
                               :class="{
                                   'active': (highlightedIndex >= 0 ? highlightedIndex === idx : isOptionSelected(option)),
                                   'dropdown-item--selected': widgetConfig.multiselect && isOptionSelected(option)
                               }"
                               @click.prevent="selectOption(option, $event)"
                               @mousedown.prevent="highlightedIndex = idx"
                               :title="option.label">
                                <span v-text="option.label"></span>
                            </a>
                        </li>
                    </ul>
                </Teleport>
            </div>
            <template #supporting>
                <span v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return {
            value: '',
            inputValue: '',
            lastSelectedOptionId: '',
            isDropdownOpen: false,
            isFocused: false,
            menuPosition: {},
            listId: 'list-' + Math.random().toString(36).slice(2, 9),
            highlightedIndex: -1
        };
    },
    computed: {
        isEditable() {
            return this.widgetConfig.editable !== false;
        },
        isMultiselect() {
            return this.widgetConfig.multiselect === true;
        },
        isSearchable() {
            return this.isEditable && !this.isMultiselect;
        },
        hasValue() {
            if (this.isMultiselect) {
                return Array.isArray(this.value) && this.value.length > 0;
            }

            return String(this.value || '').trim() !== '';
        },
        labelFloats() {
            return this.hasValue || this.isFocused;
        },
        showPlaceholder() {
            return !this.hasValue && this.isFocused && this.widgetConfig.placeholder;
        },
        listOptions() {
            return normalizeListOptions(this.widgetConfig.source);
        },
        filteredOptions() {
            if (this.isSearchable && this.isDropdownOpen && this.inputValue.trim()) {
                const query = this.inputValue.trim().toLowerCase();
                return this.listOptions.filter((option) =>
                    option.label.toLowerCase().includes(query)
                );
            }

            return this.listOptions;
        },
        inputDisplayValue() {
            if (this.isMultiselect) {
                return this.getSelectedLabels().join(', ');
            }

            if (!this.isEditable) {
                return this.getOptionLabelByValue(this.value);
            }

            if (this.isDraftEditing) {
                return this.inputValue;
            }

            return this.inputValue !== ''
                ? this.inputValue
                : this.getOptionLabelByValue(this.value);
        },
        listMenuId() {
            return `list-menu-${this.listId}`;
        },
        highlightedId() {
            return this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredOptions.length
                ? this.listItemId(this.highlightedIndex)
                : null;
        }
    },
    methods: {
        listItemId(index) {
            return `list-item-${this.listId}-${index}`;
        },
        getOptionByValue(value, options = this.listOptions) {
            return options.find((option) => option.value === String(value ?? '')) || null;
        },
        getOptionById(optionId, options = this.listOptions) {
            return options.find((option) => option.id === optionId) || null;
        },
        getOptionLabelByValue(value) {
            const normalized = value == null ? '' : String(value);
            if (!normalized) {
                return '';
            }

            const option = this.getOptionByValue(normalized);
            return option ? option.label : normalized;
        },
        getSelectedLabels() {
            if (!this.isMultiselect || !Array.isArray(this.value)) {
                return [];
            }

            return this.value
                .map((itemValue) => this.getOptionLabelByValue(itemValue))
                .filter(Boolean);
        },
        resolveSingleCommittedValue(rawDraft) {
            const draft = String(rawDraft ?? '');
            if (!draft) {
                return '';
            }

            const matchedOption = this.listOptions.find((option) =>
                option.label === draft || option.value === draft
            );

            return matchedOption ? matchedOption.value : draft;
        },
        setSingleValue(value) {
            this.value = value == null ? '' : String(value);
            if (!this.isDraftEditing) {
                this.inputValue = this.getOptionLabelByValue(this.value);
            }
        },
        setMultiValue(value) {
            this.value = Array.isArray(value)
                ? value.map((item) => String(item ?? ''))
                : [];
        },
        setValue(value) {
            if (this.isMultiselect) {
                this.setMultiValue(value);
                return;
            }

            const nextValue = Array.isArray(value)
                ? (value[0] == null ? '' : String(value[0]))
                : String(value ?? '');
            this.setSingleValue(nextValue);
        },
        syncInputDraftFromCommittedValue() {
            if (this.isMultiselect || this.isDraftEditing) {
                return;
            }

            this.inputValue = this.getOptionLabelByValue(this.value);
        },
        resolveHighlightedIndex() {
            if (this.isMultiselect) {
                const anchorOption = this.getOptionById(this.lastSelectedOptionId, this.filteredOptions);
                if (anchorOption) {
                    return this.filteredOptions.findIndex((option) => option.id === anchorOption.id);
                }
                return -1;
            }

            const selectedOption = this.getOptionByValue(this.value, this.filteredOptions);
            if (selectedOption) {
                return this.filteredOptions.findIndex((option) => option.id === selectedOption.id);
            }
            return -1;
        },
        getInputElement() {
            return this.$refs.dropdownToggle?.querySelector('.list-combobox-input') || null;
        },
        scrollHighlightedItemIntoView() {
            const items = this.$refs.dropdownMenu?.querySelectorAll('[role="option"]');
            if (!items || this.highlightedIndex < 0 || this.highlightedIndex >= items.length) {
                return;
            }

            const element =
                items[this.highlightedIndex]?.querySelector('.dropdown-item') ||
                items[this.highlightedIndex];
            if (element) {
                element.scrollIntoView({ block: 'nearest' });
            }
        },
        setHighlightedIndex(index, options = {}) {
            const scroll = options.scroll !== false;
            const maxIndex = this.filteredOptions.length - 1;
            const nextIndex =
                maxIndex < 0
                    ? -1
                    : Math.min(Math.max(index, 0), maxIndex);
            this.highlightedIndex = nextIndex;
            if (scroll && nextIndex >= 0) {
                this.$nextTick(() => this.scrollHighlightedItemIntoView());
            }
        },
        moveHighlightedIndex(delta) {
            const length = this.filteredOptions.length;
            if (length === 0) {
                this.highlightedIndex = -1;
                return;
            }

            const nextIndex =
                this.highlightedIndex < 0
                    ? delta > 0
                        ? 0
                        : length - 1
                    : (this.highlightedIndex + delta + length) % length;
            this.setHighlightedIndex(nextIndex);
        },
        resetHighlightToFirstFilteredOption() {
            this.$nextTick(() => {
                this.setHighlightedIndex(
                    this.filteredOptions.length > 0 ? 0 : -1
                );
            });
        },
        getCurrentHighlightedOption() {
            const options = this.filteredOptions;
            if (this.highlightedIndex >= 0 && this.highlightedIndex < options.length) {
                return options[this.highlightedIndex];
            }

            const resolvedIndex = this.resolveHighlightedIndex();
            return resolvedIndex >= 0 && resolvedIndex < options.length
                ? options[resolvedIndex]
                : null;
        },
        onInputChange(event) {
            if (!this.isSearchable) {
                return;
            }

            this.inputValue = String(event.target.value || '');
            this.activateDraftController();
            if (!this.isDropdownOpen) {
                this.openDropdown({ highlightFirstFiltered: true });
                return;
            }

            this.resetHighlightToFirstFilteredOption();
        },
        onInputFocus() {
            this.isFocused = true;
            if (!this.isMultiselect && this.isEditable && !this.isDraftEditing) {
                this.inputValue = this.getOptionLabelByValue(this.value);
                this.activateDraftController();
            }
        },
        onInputBlur() {
            this.isFocused = false;
            const input = this.getInputElement();
            if (input) {
                input.scrollLeft = 0;
                input.setSelectionRange(0, 0);
            }

            window.setTimeout(() => {
                if (this.isFocusInsideWidget()) {
                    return;
                }

                if (!this.isMultiselect && this.isEditable) {
                    this.commitDraft();
                }
                this.closeDropdown();
                this.deactivateDraftController();
            }, 150);
        },
        onInputKeydown(event) {
            if (this.widgetConfig.readonly) {
                return;
            }

            if (this.isMultiselect && (event.key === 'Backspace' || event.key === 'Delete')) {
                event.preventDefault();
                this.removeLastSelected();
                return;
            }

            if (!this.isEditable && (event.key === 'Backspace' || event.key === 'Delete')) {
                event.preventDefault();
                this.clearValue();
                return;
            }

            if (event.key === 'Tab') {
                const tabHandler =
                    this.widgetConfig &&
                    this.widgetConfig.table_cell_tab_handler;
                if (
                    this.tableCellMode &&
                    typeof tabHandler === 'function'
                ) {
                    event.preventDefault();
                    this.closeDropdown();
                    tabHandler(!!event.shiftKey);
                    return;
                }
            }

            const expandKeys =
                event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                event.key === 'ArrowDown';
            if (expandKeys) {
                event.preventDefault();
                this.openDropdown();
                return;
            }

            if (event.key === 'Enter' && !this.isDropdownOpen) {
                event.preventDefault();
                this.openDropdown();
                return;
            }

            if (this.isDropdownOpen) {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    this.moveHighlightedIndex(1);
                    return;
                }
                if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    this.moveHighlightedIndex(-1);
                    return;
                }
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const option = this.getCurrentHighlightedOption();
                    if (option) {
                        this.selectOption(option, event);
                    }
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.closeDropdown();
                    this.getInputElement()?.focus();
                }
            }
        },
        onMenuKeydown(event) {
            if (!this.isDropdownOpen) {
                return;
            }

            const options = this.filteredOptions;
            const length = options.length;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveHighlightedIndex(1);
                this.getInputElement()?.focus();
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveHighlightedIndex(-1);
                this.getInputElement()?.focus();
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                if (length > 0) {
                    const option = this.getCurrentHighlightedOption();
                    if (option) {
                        this.selectOption(option, event);
                    }
                }
                this.getInputElement()?.focus();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeDropdown();
                this.getInputElement()?.focus();
                return;
            }

            if (event.key === 'Tab') {
                const tabHandler =
                    this.widgetConfig &&
                    this.widgetConfig.table_cell_tab_handler;
                if (
                    this.tableCellMode &&
                    typeof tabHandler === 'function'
                ) {
                    event.preventDefault();
                    this.closeDropdown();
                    tabHandler(!!event.shiftKey);
                    return;
                }

                this.closeDropdown();
            }

            if (this.isMultiselect && (event.key === 'Backspace' || event.key === 'Delete')) {
                event.preventDefault();
                this.removeLastSelected();
                this.closeDropdown();
                this.getInputElement()?.focus();
            }
        },
        onArrowClick() {
            if (this.widgetConfig.readonly) {
                return;
            }

            this.getInputElement()?.focus();
            if (this.isDropdownOpen) {
                this.closeDropdown();
            } else {
                this.openDropdown();
            }
        },
        buildNextMultiValue(option, event) {
            const currentValues = Array.isArray(this.value) ? [...this.value] : [];
            if (event && event.shiftKey && this.lastSelectedOptionId) {
                const anchorIndex = this.listOptions.findIndex((item) => item.id === this.lastSelectedOptionId);
                const currentIndex = this.listOptions.findIndex((item) => item.id === option.id);

                if (anchorIndex !== -1 && currentIndex !== -1) {
                    const start = Math.min(anchorIndex, currentIndex);
                    const end = Math.max(anchorIndex, currentIndex);
                    const nextValues = [...currentValues];

                    for (let index = start; index <= end; index += 1) {
                        const rangeOption = this.listOptions[index];
                        if (!rangeOption || nextValues.includes(rangeOption.value)) {
                            continue;
                        }
                        nextValues.push(rangeOption.value);
                    }

                    return nextValues;
                }
            }

            const optionIndex = currentValues.indexOf(option.value);
            if (optionIndex >= 0) {
                currentValues.splice(optionIndex, 1);
                return currentValues;
            }

            currentValues.push(option.value);
            return currentValues;
        },
        selectOption(option, event) {
            if (!option) {
                return;
            }

            if (this.isMultiselect) {
                this.value = this.buildNextMultiValue(option, event);
                this.lastSelectedOptionId = option.id;
                this.emitInput([...this.value]);
                return;
            }

            const nextValue = this.value === option.value ? '' : option.value;
            this.value = nextValue;
            this.inputValue = this.getOptionLabelByValue(nextValue);
            this.lastSelectedOptionId = option.id;
            this.emitInput(nextValue);
            this.closeDropdown();
            this.deactivateDraftController();
        },
        isOptionSelected(option) {
            if (!option) {
                return false;
            }

            if (this.isMultiselect) {
                return Array.isArray(this.value) && this.value.includes(option.value);
            }

            return this.value === option.value;
        },
        openDropdown(options = {}) {
            if (this.widgetConfig.readonly) {
                return;
            }

            const highlightFirstFiltered =
                options && options.highlightFirstFiltered === true;
            this.isDropdownOpen = true;
            this.highlightedIndex = highlightFirstFiltered
                ? this.filteredOptions.length > 0
                    ? 0
                    : -1
                : this.resolveHighlightedIndex();
            this.$nextTick(() => {
                this.updateMenuPosition();
                this.addClickOutsideListener();
                this.addScrollListener();
                this.scrollHighlightedItemIntoView();
            });
        },
        updateMenuPosition() {
            const toggle = this.$refs.dropdownToggle;
            if (!toggle) {
                return;
            }

            const rect = toggle.getBoundingClientRect();
            this.menuPosition = {
                position: 'fixed',
                top: `${rect.bottom}px`,
                left: `${rect.left}px`,
                width: `${rect.width}px`,
                minWidth: `${rect.width}px`
            };
        },
        addScrollListener() {
            this.removeScrollListener();
            this._scrollUpdate = () => {
                if (this.isDropdownOpen) {
                    this.updateMenuPosition();
                }
            };
            window.addEventListener('scroll', this._scrollUpdate, true);
        },
        removeScrollListener() {
            if (this._scrollUpdate) {
                window.removeEventListener('scroll', this._scrollUpdate, true);
                this._scrollUpdate = null;
            }
        },
        closeDropdown() {
            if (!this.isDropdownOpen) {
                return;
            }

            this.isDropdownOpen = false;
            this.highlightedIndex = -1;
            this.removeClickOutsideListener();
            this.removeScrollListener();
        },
        addClickOutsideListener() {
            this.removeClickOutsideListener();
            this._clickOutside = (event) => {
                const target = event.target;
                const root = this.$refs.dropdownRoot;
                const menu = this.$refs.dropdownMenu;
                const inRoot = root && root.contains(target);
                const inMenu = menu && menu.contains(target);
                if (!inRoot && !inMenu) {
                    if (!this.isMultiselect && this.isEditable) {
                        this.commitDraft();
                    }
                    this.closeDropdown();
                    this.deactivateDraftController();
                }
            };
            this._clickOutsideTimerId = window.setTimeout(() => {
                this._clickOutsideTimerId = 0;
                if (this._clickOutside) {
                    document.addEventListener('click', this._clickOutside);
                }
            }, 0);
        },
        removeClickOutsideListener() {
            if (this._clickOutsideTimerId) {
                clearTimeout(this._clickOutsideTimerId);
                this._clickOutsideTimerId = 0;
            }
            if (this._clickOutside) {
                document.removeEventListener('click', this._clickOutside);
                this._clickOutside = null;
            }
        },
        isFocusInsideWidget() {
            const root = this.$refs.dropdownRoot;
            const menu = this.$refs.dropdownMenu;
            const active = document.activeElement;
            if (root && active && root.contains(active)) {
                return true;
            }
            return Boolean(menu && active && menu.contains(active));
        },
        onWidgetFocusOut() {
            window.setTimeout(() => {
                if (this.isFocusInsideWidget()) {
                    return;
                }

                if (!this.isMultiselect && this.isEditable) {
                    this.commitDraft();
                }
                this.closeDropdown();
                this.deactivateDraftController();
            }, 0);
        },
        removeLastSelected() {
            if (!this.isMultiselect || !Array.isArray(this.value) || this.value.length === 0) {
                return;
            }

            this.value = this.value.slice(0, -1);
            this.emitInput([...this.value]);
        },
        clearValue() {
            if (this.isMultiselect) {
                this.value = [];
                this.emitInput([]);
                this.lastSelectedOptionId = '';
                return;
            }

            this.value = '';
            this.inputValue = '';
            this.emitInput('');
        },
        commitDraft() {
            if (this.isMultiselect || !this.isEditable) {
                return;
            }

            const committedValue = this.resolveSingleCommittedValue(this.inputValue);
            this.value = committedValue;
            this.inputValue = this.getOptionLabelByValue(committedValue);
            this.emitInput(committedValue);
        },
        getValue() {
            return this.value;
        }
    },
    watch: {
        'widgetConfig.value': {
            immediate: true,
            handler(value) {
                if (value === undefined) {
                    return;
                }

                this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
            }
        },
        filteredOptions() {
            if (this.filteredOptions.length === 0) {
                this.highlightedIndex = -1;
                return;
            }

            if (this.highlightedIndex >= this.filteredOptions.length) {
                this.setHighlightedIndex(
                    Math.max(0, this.filteredOptions.length - 1),
                    { scroll: false }
                );
            }
        },
        listOptions() {
            if (this.lastSelectedOptionId && !this.getOptionById(this.lastSelectedOptionId)) {
                this.lastSelectedOptionId = '';
            }

            this.syncInputDraftFromCommittedValue();
        }
    },
    beforeUnmount() {
        this.closeDropdown();
        this.removeClickOutsideListener();
        this.removeScrollListener();
    }
};

export { ListWidget };
export default ListWidget;
