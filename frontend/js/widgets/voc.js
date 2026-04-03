import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';
import {
    filterVocRows,
    findFirstVocRowByValue,
    formatVocRowLabel,
    normalizeVocColumns,
    normalizeVocRows,
    parseVocDraft,
    replaceVocDraftActiveToken,
    resolveSingleVocDraftCommit,
    resolveVocManualTokens,
    restoreVocRowIdsByValues,
    rowsToSourceOrderValues,
    serializeVocValues
} from '../runtime/voc_contract.js';

function sortVocRows(rows, columnIndex, direction) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    if (columnIndex < 0 || !direction) {
        return list;
    }

    const dir = direction === 'desc' ? -1 : 1;
    return list.sort((left, right) => {
        const leftValue = left && Array.isArray(left.cells) ? left.cells[columnIndex] || '' : '';
        const rightValue = right && Array.isArray(right.cells) ? right.cells[columnIndex] || '' : '';
        return dir * String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });
}

const VocWidget = {
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
            :wrap-extra="{ 'md3-dropdown-wrap': true, error: !!combinedFieldError }"
            :has-supporting="!!(widgetConfig.sup_text || combinedFieldError)"
            @focusout="onWidgetFocusOut"
            @container-focusout="onWidgetFocusOut">
            <div class="dropdown widget-dropdown list-combobox w-100 min-w-0 max-w-none"
                 :class="{ show: shouldShowInlineDropdown }"
                 :data-dropdown-open="shouldShowInlineDropdown ? 'true' : undefined"
                 v-bind="tableCellRootAttrs"
                 ref="dropdownRoot">
                <div class="list-combobox-inner" ref="dropdownToggle">
                    <input type="text"
                           class="list-combobox-input"
                           data-table-editor-target="true"
                           role="combobox"
                           :aria-controls="listMenuId"
                           :aria-expanded="shouldShowInlineDropdown ? 'true' : 'false'"
                           :aria-activedescendant="highlightedId || undefined"
                           :value="inputDisplayValue"
                           @input="onInputChange"
                           @focus="onInputFocus"
                           @blur="onInputBlur"
                           @keydown="onInputKeydown"
                           :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                           :disabled="widgetConfig.readonly"
                           :tabindex="widgetConfig.readonly ? -1 : null"
                           :title="inputDisplayValue">
                    <span class="list-combobox-arrow-wrap">
                        <span class="list-combobox-arrow"
                              data-table-action-trigger="list"
                              role="button"
                              tabindex="-1"
                              aria-label="Открыть справочник"
                              @click.prevent="onArrowClick"
                              @mousedown.prevent>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M10 9.00002L6.16667 12.8334L5 11.6667L10 6.66669L15 11.6667L13.8333 12.8334L10 9.00002Z" fill="currentColor"/>
                            </svg>
                        </span>
                    </span>
                </div>
                <Teleport to="body">
                    <ul v-if="shouldShowInlineDropdown"
                        class="dropdown-menu widget-dd-menu widget-dd-menu--teleport"
                        :id="listMenuId"
                        :class="{ show: shouldShowInlineDropdown, scrollable: inlineRows.length > 10 }"
                        :style="menuPosition"
                        role="listbox"
                        tabindex="-1"
                        @keydown="onMenuKeydown"
                        ref="dropdownMenu">
                        <li v-for="(row, idx) in inlineRows"
                            :key="row.id"
                            role="option"
                            :id="listItemId(idx)">
                            <a class="dropdown-item"
                               href="#"
                               :tabindex="-1"
                               :class="{ active: highlightedIndex === idx }"
                               @click.prevent="selectInlineRow(row)"
                               @mousedown.prevent="highlightedIndex = idx"
                               :title="formatRowLabel(row)">
                                <span v-text="formatRowLabel(row)"></span>
                            </a>
                        </li>
                    </ul>
                </Teleport>
            </div>
            <Teleport to="body">
                <div v-if="isModalOpen"
                     class="modal-overlay flex-center"
                     @click.self="closeModalFromCancel">
                    <div class="modal-content gui-modal"
                         :style="modalInlineStyle"
                         ref="modalRoot"
                         @click.stop
                         @keydown.stop="onModalKeydown">
                        <div class="modal-header">
                            <h5 class="modal-title page-section-title" v-text="modalTitle"></h5>
                            <button type="button" class="ui-close-button" @click="closeModalFromCancel" aria-label="Закрыть"></button>
                        </div>
                        <div class="modal-body">
                            <div class="gui-modal-body-inner" :style="modalBodyInnerStyle">
                                <div>
                                    <input type="text"
                                           class="form-control voc-modal-search-input"
                                           ref="modalSearchInput"
                                           :value="modalSearch"
                                           :style="modalSearchInputStyle"
                                           @input="onModalSearchInput"
                                           @keydown.stop="onModalKeydown"
                                           placeholder="Поиск">
                                </div>
                                <div class="gui-modal-tab-single" :style="modalTableWrapStyle">
                                    <table class="table widget-table widget-table--sticky-header widget-table--sortable">
                                        <thead>
                                            <tr>
                                                <th v-if="isMultiselect" :style="checkboxCellStyle"></th>
                                                <th v-for="(columnLabel, columnIndex) in columns"
                                                    :key="'voc-th-' + columnIndex">
                                                    <div class="widget-table__th-inner"
                                                         role="button"
                                                         tabindex="0"
                                                         :aria-label="'Сортировать по колонке ' + columnLabel"
                                                         @click="toggleModalSort(columnIndex)"
                                                         @keydown.enter.prevent="toggleModalSort(columnIndex)"
                                                         @keydown.space.prevent="toggleModalSort(columnIndex)">
                                                        <span class="widget-table__th-text" v-text="columnLabel"></span>
                                                        <div class="widget-table__sort-icons" :class="modalSortControlClass(columnIndex)" aria-hidden="true">
                                                            <svg class="widget-table__sort-svg widget-table__sort-svg--up" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"/></svg>
                                                            <svg class="widget-table__sort-svg widget-table__sort-svg--down" width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M13.5845 17.7447L22.3941 8.93511C23.202 8.12722 23.202 6.80556 22.3941 5.99859L21.6588 5.26239C20.8528 4.45543 19.5302 4.45543 18.7232 5.26239L12 11.9856L5.27679 5.2624C4.46983 4.45543 3.14724 4.45543 2.34119 5.2624L1.60591 5.9986C0.798027 6.80556 0.798027 8.12723 1.60592 8.93511L10.4173 17.7447C10.8502 18.1785 11.4311 18.3715 12.0009 18.3393C12.568 18.3715 13.1498 18.1785 13.5845 17.7447Z"/></svg>
                                                        </div>
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody v-if="modalRows.length">
                                            <tr v-for="row in modalRows"
                                                :key="row.id"
                                                :data-modal-active="isModalRowActive(row) ? 'true' : null"
                                                :style="modalRowStyle(row)"
                                                @click="onModalRowClick(row)"
                                                @dblclick="onModalRowDoubleClick(row)">
                                                <td v-if="isMultiselect" :style="modalCellStyle(row, checkboxCellStyle)">
                                                    <input type="checkbox"
                                                           tabindex="-1"
                                                           :checked="isModalRowSelected(row)"
                                                           @click.stop="toggleModalRow(row)">
                                                </td>
                                                <td v-for="(cellValue, cellIndex) in row.cells"
                                                    :key="row.id + '-c-' + cellIndex"
                                                    :style="modalCellStyle(row)">
                                                    <span class="widget-table__cell-value" v-text="cellValue"></span>
                                                </td>
                                            </tr>
                                        </tbody>
                                        <tbody v-else>
                                            <tr>
                                                <td :colspan="columns.length + (isMultiselect ? 1 : 0)">
                                                    <span class="widget-table__cell-value">Нет данных</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button"
                                    class="widget-button confirm-modal-action confirm-modal-action--secondary"
                                    @click="closeModalFromCancel">
                                Отмена
                            </button>
                            <button type="button"
                                    class="widget-button confirm-modal-action"
                                    @click="applyModalSelection">
                                Выбрать
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
            <template #supporting>
                <span v-if="combinedFieldError" class="md3-error" v-text="combinedFieldError"></span>
                <span v-else v-text="widgetConfig.sup_text"></span>
            </template>
        </md3-field>
    `,
    data() {
        return {
            value: '',
            inputValue: '',
            isDropdownOpen: false,
            isFocused: false,
            menuPosition: {},
            listId: 'voc-' + Math.random().toString(36).slice(2, 9),
            highlightedIndex: -1,
            vocError: '',
            singleDraftDirty: false,
            isModalOpen: false,
            skipNextOutsideCommit: false,
            modalSearch: '',
            modalSortColumn: -1,
            modalSortDirection: '',
            modalActiveRowId: '',
            modalSelectedRowId: '',
            modalSelectedRowIds: []
        };
    },
    computed: {
        isMultiselect() {
            return this.widgetConfig.multiselect === true;
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
        columns() {
            return normalizeVocColumns(this.widgetConfig.columns);
        },
        rows() {
            return normalizeVocRows(this.columns, this.widgetConfig.source);
        },
        inlineQuery() {
            if (this.isMultiselect) {
                return parseVocDraft(this.inputValue).activeToken;
            }
            return this.inputValue;
        },
        inlineRows() {
            return filterVocRows(this.rows, this.inlineQuery);
        },
        inputDisplayValue() {
            if (this.isMultiselect) {
                if (this.isFocused || this.isDraftEditing) {
                    return this.inputValue;
                }
                return serializeVocValues(this.value);
            }

            if (this.isFocused || this.isDraftEditing) {
                return this.inputValue;
            }

            return String(this.value || '');
        },
        listMenuId() {
            return `voc-menu-${this.listId}`;
        },
        highlightedId() {
            return this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
                ? this.listItemId(this.highlightedIndex)
                : null;
        },
        shouldShowInlineDropdown() {
            return this.isDropdownOpen && this.inlineRows.length > 0;
        },
        combinedFieldError() {
            return this.vocError || this.fieldError || '';
        },
        modalTitle() {
            const label = String(this.widgetConfig.label || '').trim();
            return label || this.widgetName;
        },
        modalRows() {
            return sortVocRows(
                filterVocRows(this.rows, this.modalSearch),
                this.modalSortColumn,
                this.modalSortDirection
            );
        },
        modalSelectedRowIdSet() {
            return new Set(
                Array.isArray(this.modalSelectedRowIds) ? this.modalSelectedRowIds : []
            );
        },
        modalInlineStyle() {
            return {
                width: 'min(100%, 1100px)',
                maxWidth: 'min(1100px, 100%)',
                height: 'min(720px, calc(100vh - 2 * var(--space-md)))',
                maxHeight: 'min(720px, calc(100vh - 2 * var(--space-md)))'
            };
        },
        modalBodyInnerStyle() {
            return {
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
                minHeight: '0',
                padding: '0 20px 20px'
            };
        },
        modalSearchInputStyle() {
            return {
                display: 'block',
                width: '100%',
                boxSizing: 'border-box'
            };
        },
        modalTableWrapStyle() {
            return {
                minHeight: '0',
                width: '100%'
            };
        },
        checkboxCellStyle() {
            return {
                width: '52px',
                minWidth: '52px'
            };
        }
    },
    methods: {
        listItemId(index) {
            return `voc-item-${this.listId}-${index}`;
        },
        formatRowLabel(row) {
            return formatVocRowLabel(row);
        },
        modalRowStyle(row) {
            return {
                cursor: 'pointer'
            };
        },
        modalCellStyle(row, baseStyle = null) {
            const style = {
                ...(baseStyle && typeof baseStyle === 'object' ? baseStyle : {})
            };
            const isActive = this.isModalRowActive(row);
            const isSelected = this.isModalRowSelected(row);

            if (!isActive && !isSelected) {
                return style;
            }

            style.backgroundColor = isActive
                ? 'var(--color-dropdown-active)'
                : 'var(--color-table-hover)';

            if (isActive) {
                style.boxShadow = 'inset 0 2px 0 0 var(--color-text-main), inset 0 -2px 0 0 var(--color-text-main)';
            }

            return style;
        },
        setSingleValue(value, options = {}) {
            this.value = value == null ? '' : String(value);
            this.singleDraftDirty = false;
            if (options.forceSyncInput === true || (!this.isFocused && !this.isDraftEditing)) {
                this.inputValue = String(this.value || '');
            }
        },
        setMultiValue(value) {
            this.value = Array.isArray(value)
                ? value.map((item) => String(item ?? ''))
                : [];
            if (!this.isFocused && !this.isDraftEditing) {
                this.inputValue = serializeVocValues(this.value);
            }
        },
        setValue(value) {
            if (this.isMultiselect) {
                this.setMultiValue(value);
                return;
            }
            const nextValue = Array.isArray(value)
                ? String(value[0] ?? '')
                : String(value ?? '');
            this.setSingleValue(nextValue, { forceSyncInput: true });
        },
        getValue() {
            return this.value;
        },
        clearVocError() {
            this.vocError = '';
            this.handleTableCellCommitValidation('');
        },
        setVocError(message) {
            const errorMessage = String(message || '').trim();
            this.vocError = errorMessage;
            this.handleTableCellCommitValidation(errorMessage);
        },
        syncInputFromCommitted() {
            if (this.isFocused || this.isDraftEditing) {
                return;
            }
            this.inputValue = this.isMultiselect
                ? serializeVocValues(this.value)
                : String(this.value || '');
            if (!this.isMultiselect) {
                this.singleDraftDirty = false;
            }
        },
        resolveHighlightedIndex() {
            if (this.isMultiselect) {
                return this.inlineRows.length > 0 ? 0 : -1;
            }
            const selectedRow = findFirstVocRowByValue(this.inlineRows, this.value);
            return selectedRow
                ? this.inlineRows.findIndex((row) => row.id === selectedRow.id)
                : (this.inlineRows.length > 0 ? 0 : -1);
        },
        setHighlightedIndex(index, options = {}) {
            const scroll = options.scroll !== false;
            const maxIndex = this.inlineRows.length - 1;
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
            const length = this.inlineRows.length;
            if (!length) {
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
        getInputElement() {
            return this.$refs.dropdownToggle?.querySelector('.list-combobox-input') || null;
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
                if (this.shouldShowInlineDropdown) {
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
        addClickOutsideListener() {
            this.removeClickOutsideListener();
            this._clickOutside = (event) => {
                const target = event.target;
                const root = this.$refs.dropdownRoot;
                const menu = this.$refs.dropdownMenu;
                const modal = this.$refs.modalRoot;
                const inRoot = root && root.contains(target);
                const inMenu = menu && menu.contains(target);
                const inModal = modal && modal.contains(target);
                if (!inRoot && !inMenu && !inModal) {
                    this.onOutsideInteractionCommit();
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
        onOutsideInteractionCommit() {
            if (this.isModalOpen) {
                return;
            }
            if (this.isMultiselect && this.skipNextOutsideCommit) {
                this.skipNextOutsideCommit = false;
                this.syncInputFromCommitted();
                this.closeDropdown();
                this.deactivateDraftController();
                return;
            }
            this.commitDraft({ includeActiveToken: true, fromBlur: true });
            this.closeDropdown();
            this.deactivateDraftController();
        },
        isFocusInsideWidget() {
            const root = this.$refs.dropdownRoot;
            const menu = this.$refs.dropdownMenu;
            const modal = this.$refs.modalRoot;
            const active = document.activeElement;
            if (root && active && root.contains(active)) {
                return true;
            }
            if (menu && active && menu.contains(active)) {
                return true;
            }
            return Boolean(modal && active && modal.contains(active));
        },
        openDropdown(options = {}) {
            if (this.widgetConfig.readonly) {
                return;
            }
            this.isDropdownOpen = true;
            this.highlightedIndex = options.highlightFirst === true
                ? (this.inlineRows.length > 0 ? 0 : -1)
                : this.resolveHighlightedIndex();
            this.$nextTick(() => {
                this.updateMenuPosition();
                this.addClickOutsideListener();
                this.addScrollListener();
                this.scrollHighlightedItemIntoView();
            });
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
        normalizeMultiselectDraftAndSync(options = {}) {
            const draft = parseVocDraft(this.inputValue);
            const sourceTokens = draft.completedTokens.slice();
            if (options.includeActiveToken === true && draft.activeToken.trim()) {
                sourceTokens.push(draft.activeToken.trim());
            }
            const resolution = resolveVocManualTokens(this.rows, sourceTokens);
            const nextValues = resolution.resolvedValues.slice();

            if (
                Array.isArray(this.value) &&
                (nextValues.length !== this.value.length ||
                    nextValues.some((item, index) => item !== this.value[index]))
            ) {
                this.value = nextValues;
                this.emitInput(nextValues.slice());
            }
            if (!Array.isArray(this.value)) {
                this.value = nextValues;
                this.emitInput(nextValues.slice());
            }

            if (resolution.invalidToken) {
                this.setVocError(`Значение '${resolution.invalidToken}' отсутствует в справочнике`);
            } else {
                this.clearVocError();
            }

            if (options.fromBlur === true) {
                this.inputValue = serializeVocValues(nextValues);
            }

            return resolution;
        },
        commitDraft(options = {}) {
            if (this.isMultiselect) {
                this.normalizeMultiselectDraftAndSync({
                    includeActiveToken: options.includeActiveToken === true,
                    fromBlur: options.fromBlur === true
                });
                return;
            }

            const resolution = resolveSingleVocDraftCommit(
                this.rows,
                this.inputValue,
                this.value,
                { draftDirty: this.singleDraftDirty }
            );

            this.value = resolution.nextValue;
            this.inputValue = resolution.nextInputValue;
            this.singleDraftDirty = false;
            this.clearVocError();
            if (resolution.emit) {
                this.emitInput(resolution.emittedValue);
            }
        },
        selectInlineRow(row) {
            if (!row) {
                return;
            }
            if (this.isMultiselect) {
                this.inputValue = replaceVocDraftActiveToken(this.inputValue, row.value);
                this.normalizeMultiselectDraftAndSync({
                    includeActiveToken: false,
                    fromBlur: false
                });
                this.closeDropdown();
                this.getInputElement()?.focus();
                return;
            }

            this.setSingleValue(row.value, { forceSyncInput: true });
            this.clearVocError();
            this.emitInput(row.value);
            this.closeDropdown();
            this.deactivateDraftController();
        },
        onInputChange(event) {
            if (this.widgetConfig.readonly) {
                return;
            }
            this.activateDraftController();
            this.skipNextOutsideCommit = false;
            this.clearVocError();

            if (this.isMultiselect) {
                const rawValue = event?.target?.value == null ? '' : String(event.target.value);
                this.inputValue = parseVocDraft(rawValue).normalizedText;
                this.normalizeMultiselectDraftAndSync({
                    includeActiveToken: false,
                    fromBlur: false
                });
                const draft = parseVocDraft(this.inputValue);
                if (draft.activeToken.trim()) {
                    this.openDropdown({ highlightFirst: true });
                } else {
                    this.closeDropdown();
                }
                return;
            }

            this.inputValue = event?.target?.value == null ? '' : String(event.target.value);
            this.singleDraftDirty = true;
            if (!this.isDropdownOpen) {
                this.openDropdown({ highlightFirst: true });
                return;
            }
            this.setHighlightedIndex(this.inlineRows.length > 0 ? 0 : -1);
        },
        onInputFocus() {
            this.isFocused = true;
            this.activateDraftController();
            this.clearVocError();
            if (this.isMultiselect) {
                this.inputValue = this.inputValue !== ''
                    ? this.inputValue
                    : serializeVocValues(this.value);
                return;
            }
            this.inputValue = String(this.value || '');
        },
        onInputBlur() {
            this.isFocused = false;
            window.setTimeout(() => {
                if (this.isFocusInsideWidget()) {
                    return;
                }
                this.onOutsideInteractionCommit();
            }, 150);
        },
        onWidgetFocusOut() {
            window.setTimeout(() => {
                if (this.isFocusInsideWidget()) {
                    return;
                }
                this.onOutsideInteractionCommit();
            }, 0);
        },
        onInputKeydown(event) {
            if (this.widgetConfig.readonly) {
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

            const shouldOpenModal =
                event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                event.key === 'ArrowDown';
            if (shouldOpenModal) {
                event.preventDefault();
                this.openModal();
                return;
            }

            if (event.key === 'Enter' && !this.isDropdownOpen) {
                event.preventDefault();
                this.openDropdown({ highlightFirst: true });
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
                    const row =
                        this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
                            ? this.inlineRows[this.highlightedIndex]
                            : null;
                    if (row) {
                        this.selectInlineRow(row);
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
            if (!this.shouldShowInlineDropdown) {
                return;
            }

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
                const row =
                    this.highlightedIndex >= 0 && this.highlightedIndex < this.inlineRows.length
                        ? this.inlineRows[this.highlightedIndex]
                        : null;
                if (row) {
                    this.selectInlineRow(row);
                }
                this.getInputElement()?.focus();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeDropdown();
                this.getInputElement()?.focus();
            }
        },
        onArrowClick() {
            if (this.widgetConfig.readonly) {
                return;
            }
            this.getInputElement()?.focus?.();
            this.openModal();
        },
        setTableUiLocked(locked) {
            const lockHandler =
                this.widgetConfig &&
                this.widgetConfig.table_cell_ui_lock_handler;
            if (typeof lockHandler === 'function') {
                lockHandler(!!locked);
            }
        },
        openModal() {
            if (this.widgetConfig.readonly) {
                return;
            }
            this.skipNextOutsideCommit = false;
            this.closeDropdown();
            this.clearVocError();
            this.isModalOpen = true;
            this.setTableUiLocked(true);
            this.modalSortColumn = -1;
            this.modalSortDirection = '';
            this.modalSearch = this.isMultiselect
                ? parseVocDraft(this.inputValue).activeToken
                : String(this.inputValue || '').trim();

            if (this.isMultiselect) {
                this.modalSelectedRowIds = Array.from(
                    restoreVocRowIdsByValues(this.rows, this.value)
                );
                this.modalSelectedRowId = '';
            } else {
                const selectedRow = findFirstVocRowByValue(this.rows, this.value);
                this.modalSelectedRowId = selectedRow ? selectedRow.id : '';
                this.modalSelectedRowIds = [];
            }

            this.$nextTick(() => {
                this.syncModalActiveRow();
                this.$refs.modalSearchInput?.focus?.();
            });
        },
        closeModal(options = {}) {
            this.isModalOpen = false;
            this.setTableUiLocked(false);
            this.$nextTick(() => {
                if (options.restoreFocus !== false) {
                    this.getInputElement()?.focus?.();
                }
            });
        },
        closeModalFromCancel() {
            this.closeModal({ restoreFocus: true });
        },
        applyModalSelection() {
            if (this.isMultiselect) {
                const values = rowsToSourceOrderValues(
                    this.rows,
                    this.modalSelectedRowIdSet
                );
                this.setMultiValue(values);
                this.skipNextOutsideCommit = true;
                this.clearVocError();
                this.closeModal({ restoreFocus: true });
                this.emitInput(values.slice());
                return;
            }

            const selectedRowId = this.modalSelectedRowId || this.modalActiveRowId;
            const row = this.rows.find((item) => item.id === selectedRowId) || null;
            if (row) {
                this.setSingleValue(row.value, { forceSyncInput: true });
                this.clearVocError();
                this.closeModal({ restoreFocus: true });
                this.emitInput(row.value);
                return;
            }
            this.closeModal({ restoreFocus: true });
        },
        modalSortControlClass(columnIndex) {
            const active = this.modalSortColumn === columnIndex;
            if (!active || !this.modalSortDirection) {
                return {};
            }
            return {
                active: true,
                asc: this.modalSortDirection === 'asc',
                desc: this.modalSortDirection === 'desc'
            };
        },
        toggleModalSort(columnIndex) {
            if (this.modalSortColumn !== columnIndex) {
                this.modalSortColumn = columnIndex;
                this.modalSortDirection = 'asc';
            } else if (this.modalSortDirection === 'asc') {
                this.modalSortDirection = 'desc';
            } else if (this.modalSortDirection === 'desc') {
                this.modalSortColumn = -1;
                this.modalSortDirection = '';
            } else {
                this.modalSortDirection = 'asc';
            }
            this.$nextTick(() => this.syncModalActiveRow());
        },
        isModalRowSelected(row) {
            if (!row) {
                return false;
            }
            if (this.isMultiselect) {
                return this.modalSelectedRowIdSet.has(row.id);
            }
            return this.modalSelectedRowId === row.id;
        },
        isModalRowActive(row) {
            return !!(row && this.modalActiveRowId === row.id);
        },
        toggleModalRow(row) {
            if (!row) {
                return;
            }
            if (!this.isMultiselect) {
                this.modalSelectedRowId = row.id;
                this.modalActiveRowId = row.id;
                return;
            }

            const selected = this.modalSelectedRowIdSet;
            if (selected.has(row.id)) {
                selected.delete(row.id);
            } else {
                selected.add(row.id);
            }
            this.modalSelectedRowIds = Array.from(selected);
            this.modalActiveRowId = row.id;
        },
        onModalRowClick(row) {
            if (!row) {
                return;
            }
            if (this.isMultiselect) {
                this.toggleModalRow(row);
                return;
            }
            this.modalSelectedRowId = row.id;
            this.modalActiveRowId = row.id;
        },
        onModalRowDoubleClick(row) {
            this.onModalRowClick(row);
            if (!this.isMultiselect) {
                this.applyModalSelection();
            }
        },
        onModalSearchInput(event) {
            this.modalSearch = event?.target?.value == null ? '' : String(event.target.value);
        },
        syncModalActiveRow() {
            const visibleRows = this.modalRows;
            if (!visibleRows.length) {
                this.modalActiveRowId = '';
                if (!this.isMultiselect) {
                    this.modalSelectedRowId = '';
                }
                return;
            }

            if (!visibleRows.some((row) => row.id === this.modalActiveRowId)) {
                const preferredId = this.isMultiselect
                    ? (this.modalSelectedRowIds[0] || '')
                    : this.modalSelectedRowId;
                const preferredRow = preferredId
                    ? visibleRows.find((row) => row.id === preferredId)
                    : null;
                this.modalActiveRowId = preferredRow ? preferredRow.id : visibleRows[0].id;
            }

            if (!this.isMultiselect) {
                this.modalSelectedRowId = this.modalActiveRowId || visibleRows[0].id;
            }

            this.$nextTick(() => this.scrollModalActiveRowIntoView());
        },
        scrollModalActiveRowIntoView() {
            if (!this.modalActiveRowId) {
                return;
            }
            const activeRow =
                this.$refs.modalRoot?.querySelector('tr[data-modal-active="true"]') || null;
            if (activeRow && typeof activeRow.scrollIntoView === 'function') {
                activeRow.scrollIntoView({ block: 'nearest' });
            }
        },
        moveModalActiveRow(delta) {
            const visibleRows = this.modalRows;
            if (!visibleRows.length) {
                this.modalActiveRowId = '';
                return;
            }
            const currentIndex = visibleRows.findIndex((row) => row.id === this.modalActiveRowId);
            const nextIndex =
                currentIndex < 0
                    ? 0
                    : (currentIndex + delta + visibleRows.length) % visibleRows.length;
            this.modalActiveRowId = visibleRows[nextIndex].id;
            if (!this.isMultiselect) {
                this.modalSelectedRowId = this.modalActiveRowId;
            }
            this.$nextTick(() => this.scrollModalActiveRowIntoView());
        },
        onModalKeydown(event) {
            if (!this.isModalOpen) {
                return;
            }

            const targetTag = String(event.target?.tagName || '').toUpperCase();
            if (targetTag === 'BUTTON' && event.key === 'Enter') {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeModalFromCancel();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveModalActiveRow(1);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveModalActiveRow(-1);
                return;
            }
            if (event.key === 'Enter') {
                const activeRow =
                    this.modalRows.find((row) => row.id === this.modalActiveRowId) || null;
                if (!activeRow) {
                    return;
                }
                event.preventDefault();
                if (this.isMultiselect) {
                    this.toggleModalRow(activeRow);
                    return;
                }
                this.modalSelectedRowId = activeRow.id;
                this.modalActiveRowId = activeRow.id;
                this.applyModalSelection();
            }
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
        inlineRows() {
            if (this.inlineRows.length === 0) {
                this.highlightedIndex = -1;
                return;
            }
            if (this.highlightedIndex >= this.inlineRows.length) {
                this.setHighlightedIndex(0, { scroll: false });
            }
        },
        modalRows() {
            if (!this.isModalOpen) {
                return;
            }
            this.syncModalActiveRow();
        }
    },
    beforeUnmount() {
        this.closeDropdown();
        this.removeClickOutsideListener();
        this.removeScrollListener();
        if (this.isModalOpen) {
            this.setTableUiLocked(false);
        }
    }
};

export { VocWidget };
export default VocWidget;
