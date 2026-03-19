// Виджет для списков (list)

const ListWidget = {
    components: { Md3Field: window.Md3Field },
    mixins: [window.widgetMixin],
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
            @focusout="onListFocusOut"
            @container-focusout="onFocusOut">
            <div class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none" :class="{ show: isDropdownOpen }" ref="dropdownRoot">
                <div class="list-combobox-inner" ref="dropdownToggle">
                    <input type="text"
                           class="list-combobox-input"
                           :value="inputDisplayValue"
                           @input="onInputChange"
                           @focus="onInputFocus"
                           @blur="onInputBlur"
                           @keydown="onInputKeydown"
                           :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                           :readonly="!isEditable || widgetConfig.multiselect"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           :title="inputDisplayValue"
                           :aria-expanded="isDropdownOpen">
                    <span class="list-combobox-arrow-wrap">
                        <span class="list-combobox-arrow"
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
                        :class="{ show: isDropdownOpen, scrollable: filteredList.length > 10 }"
                        :style="menuPosition"
                        role="listbox"
                        :aria-activedescendant="highlightedId"
                        tabindex="-1"
                        @keydown="onMenuKeydown"
                        ref="dropdownMenu">
                        <li v-for="(item, idx) in filteredList" :key="item" role="option" :id="'list-item-' + listId + '-' + idx">
                            <a class="dropdown-item"
                               href="#"
                               :tabindex="-1"
                               :class="{
                                   'active': (highlightedIndex >= 0 ? highlightedIndex === idx : isItemSelected(item)),
                                   'dropdown-item--selected': widgetConfig.multiselect && isItemSelected(item)
                               }"
                               @click.prevent="selectItem(item, $event)"
                               @mousedown.prevent="highlightedIndex = idx"
                               :title="item">
                                <span v-text="item"></span>
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
            value: null,
            inputValue: '',
            lastSelectedItem: null,
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
        hasValue() {
            const v = this.widgetConfig.multiselect ? this.value : this.inputDisplayValue;
            if (this.widgetConfig.multiselect) {
                return Array.isArray(this.value) && this.value.length > 0;
            }
            return v !== null && v !== undefined && String(v).trim() !== '';
        },
        labelFloats() {
            return this.hasValue || this.isFocused;
        },
        showPlaceholder() {
            return !this.hasValue && this.isFocused && this.widgetConfig.placeholder;
        },
        inputDisplayValue() {
            if (this.widgetConfig.multiselect) {
                return (Array.isArray(this.value) && this.value.length > 0)
                    ? this.value.join(', ')
                    : '';
            }
            if (!this.isEditable) {
                return this.value != null ? String(this.value) : '';
            }
            return this.inputValue !== '' ? this.inputValue : (this.value != null ? String(this.value) : '');
        },
        listSource() {
            if (Array.isArray(this.widgetConfig.source)) {
                return this.widgetConfig.source;
            }
            return [];
        },
        filteredList() {
            if (this.isEditable && !this.widgetConfig.multiselect && this.isDropdownOpen && this.inputValue.trim()) {
                const q = this.inputValue.trim().toLowerCase();
                return this.listSource.filter(item =>
                    String(item).toLowerCase().includes(q)
                );
            }
            return this.listSource;
        },
        highlightedId() {
            return this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredList.length
                ? `list-item-${this.listId}-${this.highlightedIndex}`
                : null;
        }
    },
    methods: {
        onInputChange(e) {
            if (!this.isEditable || this.widgetConfig.multiselect) return;
            this.inputValue = e.target.value;
            this.value = this.inputValue;
            this.emitInput(this.value);
        },
        onInputFocus() {
            this.isFocused = true;
        },
        onInputBlur() {
            this.isFocused = false;
            const input = this.$refs.dropdownToggle?.querySelector('.list-combobox-input');
            if (input) {
                input.scrollLeft = 0;
                input.setSelectionRange(0, 0);
            }
            setTimeout(() => {
                const active = document.activeElement;
                const inMenu = this.$refs.dropdownMenu?.contains(active);
                if (!inMenu) this.closeDropdown();
            }, 150);
        },
        onInputKeydown(e) {
            if (this.widgetConfig.readonly) return;
            if (this.widgetConfig.multiselect && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                this.removeLastSelected();
                return;
            }
            if (!this.isEditable && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                this.clearValue();
                return;
            }
            const expandKeys = (e.altKey || e.metaKey) && e.key === 'ArrowDown';
            if (expandKeys || (e.key === 'Enter' && !this.isDropdownOpen)) {
                e.preventDefault();
                this.toggleDropdown();
                return;
            }
            if (this.isDropdownOpen && this.filteredList.length > 0) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.focusMenuItem(this.highlightedIndex >= 0 ? this.highlightedIndex : 0);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.focusMenuItem(this.filteredList.length - 1);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const len = this.filteredList.length;
                    if (this.highlightedIndex >= 0 && this.highlightedIndex < len) {
                        this.selectItem(this.filteredList[this.highlightedIndex], e);
                    }
                    return;
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeDropdown();
                    this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
                    return;
                }
            }
        },
        focusMenuItem(index) {
            const items = this.$refs.dropdownMenu?.querySelectorAll('[role="option"]');
            if (!items || index < 0 || index >= items.length) return;
            this.highlightedIndex = index;
            this.$nextTick(() => {
                const el = items[index]?.querySelector('.dropdown-item') || items[index];
                if (el) {
                    el.focus();
                    el.scrollIntoView({ block: 'nearest' });
                }
            });
        },
        onMenuKeydown(e) {
            if (!this.isDropdownOpen) return;
            const items = this.filteredList;
            const len = items.length;
            if (len === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightedIndex = (this.highlightedIndex + 1) % len;
                this.$nextTick(() => this.focusMenuItem(this.highlightedIndex));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.highlightedIndex <= 0) {
                    this.highlightedIndex = -1;
                    this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
                } else {
                    this.highlightedIndex = this.highlightedIndex - 1;
                    this.$nextTick(() => this.focusMenuItem(this.highlightedIndex));
                }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.highlightedIndex >= 0 && this.highlightedIndex < len) {
                    this.selectItem(items[this.highlightedIndex], e);
                    this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeDropdown();
                this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
                return;
            }
            if (e.key === 'Tab') {
                this.closeDropdown();
            }
            if (this.widgetConfig.multiselect && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                this.removeLastSelected();
                this.closeDropdown();
                this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
            }
            if (!this.isEditable && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                this.clearValue();
                this.closeDropdown();
                this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
            }
        },
        onArrowClick() {
            if (this.widgetConfig.readonly) return;
            this.$refs.dropdownToggle?.querySelector('.list-combobox-input')?.focus();
            this.toggleDropdown();
        },
        selectItem(item, event) {
            if (this.widgetConfig.multiselect) {
                if (!Array.isArray(this.value)) this.value = [];
                if (event && event.shiftKey && this.lastSelectedItem) {
                    const lastIndex = this.listSource.indexOf(this.lastSelectedItem);
                    const currentIndex = this.listSource.indexOf(item);
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);
                    for (let i = start; i <= end; i++) {
                        const rangeItem = this.listSource[i];
                        if (!this.value.includes(rangeItem)) this.value.push(rangeItem);
                    }
                } else {
                    const index = this.value.indexOf(item);
                    if (index > -1) {
                        this.value.splice(index, 1);
                    } else {
                        this.value.push(item);
                    }
                }
                this.lastSelectedItem = item;
            } else {
                if (this.value === item) {
                    this.clearValue();
                } else {
                    this.value = item;
                    this.inputValue = item;
                }
                this.closeDropdown();
            }
            this.emitInput(this.value);
        },
        isItemSelected(item) {
            if (this.widgetConfig.multiselect) {
                return Array.isArray(this.value) && this.value.includes(item);
            }
            return this.value === item;
        },
        toggleDropdown() {
            if (this.widgetConfig.readonly) return;
            this.isDropdownOpen = !this.isDropdownOpen;
            if (this.isDropdownOpen) {
                this.highlightedIndex = this.filteredList.indexOf(this.value);
                this.$nextTick(() => {
                    this.updateMenuPosition();
                    this.addClickOutsideListener();
                    this.addScrollListener();
                });
            } else {
                this.highlightedIndex = -1;
                this.removeClickOutsideListener();
                this.removeScrollListener();
            }
        },
        updateMenuPosition() {
            const toggle = this.$refs.dropdownToggle;
            if (!toggle) return;
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
                if (this.isDropdownOpen) this.updateMenuPosition();
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
            if (this.isDropdownOpen) {
                this.isDropdownOpen = false;
                this.highlightedIndex = -1;
                this.removeClickOutsideListener();
                this.removeScrollListener();
            }
        },
        addClickOutsideListener() {
            this.removeClickOutsideListener();
            this._clickOutside = (e) => {
                const root = this.$refs.dropdownRoot;
                const menu = this.$refs.dropdownMenu;
                const target = e.target;
                const inRoot = root && root.contains(target);
                const inMenu = menu && menu.contains(target);
                if (!inRoot && !inMenu) {
                    this.closeDropdown();
                }
            };
            setTimeout(() => document.addEventListener('click', this._clickOutside), 0);
        },
        removeClickOutsideListener() {
            if (this._clickOutside) {
                document.removeEventListener('click', this._clickOutside);
                this._clickOutside = null;
            }
        },
        onTab() {
            if (this.widgetConfig.multiselect) this.closeDropdown();
        },
        onFocusOut() {
            if (!this.widgetConfig.multiselect) return;
            setTimeout(() => {
                const root = this.$refs.dropdownRoot;
                const menu = this.$refs.dropdownMenu;
                const active = document.activeElement;
                if (root && root.contains(active)) return;
                if (menu && menu.contains(active)) return;
                this.closeDropdown();
            }, 0);
        },
        onListFocusOut() {
            setTimeout(() => {
                const root = this.$refs.dropdownRoot;
                const menu = this.$refs.dropdownMenu;
                const active = document.activeElement;
                if (root && root.contains(active)) return;
                if (menu && menu.contains(active)) return;
                this.closeDropdown();
            }, 0);
        },
        removeLastSelected() {
            if (!this.widgetConfig.multiselect || !Array.isArray(this.value) || this.value.length === 0) return;
            this.value = this.value.slice(0, -1);
            this.emitInput(this.value);
        },
        clearValue() {
            if (this.widgetConfig.multiselect) {
                this.value = [];
            } else {
                this.value = '';
                this.inputValue = '';
            }
            this.emitInput(this.value);
        },
        setValue(value) {
            this.value = value;
            if (!this.widgetConfig.multiselect) {
                this.inputValue = value != null ? String(value) : '';
            }
        },
        getValue() { return this.value; }
    },
    watch: {
        value: {
            handler(val) {
                if (!this.widgetConfig.multiselect && this.inputValue !== val) {
                    this.inputValue = val != null ? String(val) : '';
                }
            },
            immediate: true
        },
        filteredList() {
            if (this.highlightedIndex >= this.filteredList.length) {
                this.highlightedIndex = Math.max(0, this.filteredList.length - 1);
            }
        }
    },
    mounted() {
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
        if (this.widgetConfig.multiselect) {
            if (!Array.isArray(this.value)) this.value = [];
        } else {
            if (Array.isArray(this.value)) {
                this.value = this.value[0] || '';
            } else if (this.value === null || this.value === undefined) {
                this.value = '';
            }
            this.inputValue = this.value != null ? String(this.value) : '';
        }
    }
};

window.ListWidget = ListWidget;
