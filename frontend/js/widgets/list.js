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
            :is-focused="isDropdownOpen"
            :wrap-extra="{ 'md3-dropdown-wrap': true }"
            :has-supporting="!!widgetConfig.sup_text"
            @focusout="onListFocusOut"
            @container-focusout="onFocusOut">
            <div class="dropdown widget-dropdown w-100 min-w-0 max-w-none" ref="dropdownRoot">
                <button class="btn md3-dropdown-toggle dropdown-toggle w-100 min-w-0 max-w-none"
                        type="button"
                        :aria-expanded="isDropdownOpen"
                        ref="dropdownToggle"
                        @click.prevent="toggleDropdown"
                        :disabled="widgetConfig.readonly"
                        :tabindex="widgetConfig.readonly ? -1 : null"
                        :title="getDisplayValue()">
                    <span v-text="getDisplayValue()"></span>
                </button>
                <ul class="dropdown-menu widget-dd-menu" :class="{ show: isDropdownOpen }" @keydown.tab="onTab">
                    <li v-for="item in listSource" :key="item">
                        <a class="dropdown-item"
                           href="#"
                           @click.prevent="selectItem(item, $event)"
                           :class="{ 'active': isItemSelected(item) }"
                           :title="item">
                            <span v-text="item"></span>
                        </a>
                    </li>
                </ul>
            </div>
            <template #supporting>
                <span v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return {
            value: null,
            lastSelectedItem: null,
            isDropdownOpen: false
        };
    },
    computed: {
        hasValue() {
            return this.widgetConfig.multiselect
                ? (Array.isArray(this.value) && this.value.length > 0)
                : (this.value !== null && this.value !== undefined && this.value !== '');
        },
        labelFloats() {
            return this.hasValue || this.isDropdownOpen;
        },
        listSource() {
            if (this.widgetConfig.source) {
                if (Array.isArray(this.widgetConfig.source)) {
                    return this.widgetConfig.source;
                }
                if (typeof this.widgetConfig.source === 'object' && this.widgetConfig.source.command) {
                    return ['Загрузка...'];
                }
            }
            return [];
        }
    },
    methods: {
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
                this.value = item;
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
        getDisplayValue() {
            if (this.widgetConfig.multiselect) {
                return (Array.isArray(this.value) && this.value.length > 0)
                    ? this.value.join(', ')
                    : (this.isDropdownOpen && this.widgetConfig.placeholder ? this.widgetConfig.placeholder : 'Выберите элементы');
            }
            return this.value || (this.isDropdownOpen && this.widgetConfig.placeholder ? this.widgetConfig.placeholder : 'Выберите элемент');
        },
        toggleDropdown() {
            if (this.widgetConfig.readonly) return;
            this.isDropdownOpen = !this.isDropdownOpen;
            if (this.isDropdownOpen) {
                this.$nextTick(() => this.addClickOutsideListener());
            } else {
                this.removeClickOutsideListener();
            }
        },
        closeDropdown() {
            if (this.isDropdownOpen) {
                this.isDropdownOpen = false;
                this.removeClickOutsideListener();
            }
        },
        addClickOutsideListener() {
            this.removeClickOutsideListener();
            this._clickOutside = (e) => {
                const root = this.$refs.dropdownRoot;
                if (root && !root.contains(e.target)) {
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
                if (!root || root.contains(document.activeElement)) return;
                this.closeDropdown();
            }, 0);
        },
        onListFocusOut() {
            setTimeout(() => {
                const root = this.$refs.dropdownRoot;
                if (!root || root.contains(document.activeElement)) return;
                this.closeDropdown();
            }, 0);
        },
        setValue(value) { this.value = value; },
        getValue() { return this.value; }
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
        }
    }
};

window.ListWidget = ListWidget;
