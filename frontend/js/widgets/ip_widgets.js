// Виджеты IP и IP/CIDR: ввод с живой валидацией по завершённым октетам.

import Md3Field from './md3_field.js';
import widgetMixin from './mixin.js';

const IP_OCTET_SEPARATOR_KEYS = new Set(['.', ',', ' ', '|', '\\']);
const IP_CONTROL_KEYS = new Set([
    'Backspace',
    'Delete',
    'Tab',
    'Enter',
    'Escape',
    'Home',
    'End',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown'
]);

function isDigitChar(ch) {
    return ch >= '0' && ch <= '9';
}

function isCommittedOctetValid(octet) {
    if (!octet) return false;
    if (!/^\d{1,3}$/.test(octet)) return false;
    const n = Number(octet);
    if (n < 0 || n > 255) return false;
    return String(n) === octet;
}

function normalizeIpLikeValue(rawValue, allowMask) {
    const raw = String(rawValue || '');
    const octets = [''];
    let maskDigits = '';
    let inMask = false;
    let justCommittedOctet = false;
    let justCommittedByAutoAdvance = false;

    for (const ch of raw) {
        if (isDigitChar(ch)) {
            justCommittedOctet = false;
            justCommittedByAutoAdvance = false;
            if (inMask) {
                if (maskDigits.length < 2) {
                    maskDigits += ch;
                }
                continue;
            }

            const current = octets[octets.length - 1];
            if (current.length < 3) {
                const nextOctet = current + ch;
                octets[octets.length - 1] = nextOctet;
                if (
                    nextOctet.length === 3 &&
                    octets.length < 4 &&
                    isCommittedOctetValid(nextOctet)
                ) {
                    octets.push('');
                    justCommittedOctet = true;
                    justCommittedByAutoAdvance = true;
                }
                continue;
            }

            if (octets.length < 4) {
                octets.push(ch);
            }
            justCommittedOctet = false;
            justCommittedByAutoAdvance = false;
            continue;
        }

        const isOctetSeparator = IP_OCTET_SEPARATOR_KEYS.has(ch) || (!allowMask && ch === '/');
        if (isOctetSeparator) {
            justCommittedByAutoAdvance = false;
            if (!inMask && octets.length < 4 && octets[octets.length - 1].length > 0) {
                octets.push('');
                justCommittedOctet = true;
            }
            continue;
        }

        if (allowMask && ch === '/') {
            justCommittedOctet = false;
            justCommittedByAutoAdvance = false;
            if (!inMask && octets.some(Boolean)) {
                inMask = true;
            }
        }
    }

    let ipPart = octets[0] || '';
    for (let i = 1; i < octets.length; i++) {
        ipPart += '.' + octets[i];
    }

    return {
        value: allowMask && inMask ? `${ipPart}/${maskDigits}` : ipPart,
        completedOctets: octets.slice(0, -1),
        activeOctet: octets[octets.length - 1] || '',
        maskDigits,
        hasMaskSeparator: inMask,
        justCommittedOctet,
        justCommittedByAutoAdvance
    };
}

function hasLiveIpLikeError(normalized, allowMask) {
    if (normalized.completedOctets.some((octet) => !isCommittedOctetValid(octet))) {
        return true;
    }

    if (!allowMask || !normalized.hasMaskSeparator || normalized.maskDigits.length < 2) {
        return false;
    }

    const maskValue = Number(normalized.maskDigits);
    return !Number.isFinite(maskValue) || maskValue < 0 || maskValue > 32;
}

function isAllowedIpKey(key, allowMask) {
    if (IP_CONTROL_KEYS.has(key)) return true;
    if (key.length !== 1) return true;
    if (isDigitChar(key)) return true;
    if (IP_OCTET_SEPARATOR_KEYS.has(key)) return true;
    if (key === '/') return true;
    return false;
}

function validateRegexValue(rawValue, regex, errText) {
    if (!regex) return '';
    try {
        const re = typeof regex === 'string' ? new RegExp(regex) : regex;
        return rawValue !== '' && !re.test(String(rawValue))
            ? errText || 'Неверный формат'
            : '';
    } catch (e) {
        return '';
    }
}

function createIpLikeWidget(maskTemplate, validateFn, allowMask) {
    return {
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
                :wrap-extra="{ error: !!displayError }"
                :has-supporting="!!(widgetConfig.sup_text || displayError)">
                <input type="text"
                       class="form-control widget-ip"
                       data-table-editor-target="true"
                       v-bind="tableCellRootAttrs"
                       :disabled="widgetConfig.readonly"
                       :tabindex="widgetConfig.readonly ? -1 : null"
                       :maxlength="maxLength"
                       :placeholder="showPlaceholder ? widgetConfig.placeholder : ''"
                       v-model="inputValue"
                       @input="onInputHandler"
                       @keydown="onKeyDown"
                       @blur="handleBlur"
                       @focus="onFocus">
                <template #supporting>
                    <span v-if="displayError" class="md3-error" v-text="displayError"></span>
                    <span v-else v-text="widgetConfig.sup_text"></span>
                </template>
            </md3-field>
        `,
        data() {
            return {
                maskTemplate,
                inputValue: '',
                error: '',
                isFocused: false
            };
        },
        computed: {
            hasValue() { return Boolean(this.inputValue); },
            labelFloats() {
                return this.hasValue || this.isFocused;
            },
            displayError() {
                return this.tableCellCommitError || this.error || '';
            },
            showPlaceholder() {
                return !this.hasValue && this.isFocused && this.widgetConfig.placeholder;
            },
            maxLength() {
                return this.maskTemplate.length;
            }
        },
        methods: {
            emitValue() {
                this.emitInput(this.inputValue);
            },
            onFocus() {
                this.isFocused = true;
                this.activateDraftController();
            },
            applyNormalizedValue(rawValue, caretPosition) {
                const prevValue = this.inputValue;
                const normalized = normalizeIpLikeValue(rawValue, allowMask);
                this.inputValue = normalized.value;
                this.error = hasLiveIpLikeError(normalized, allowMask) ? 'Неверный формат' : '';
                if (this.tableCellMode) {
                    this.emitValue();
                } else {
                    this.activateDraftController();
                }

                let nextCursor = null;
                if (
                    normalized.justCommittedByAutoAdvance &&
                    caretPosition != null &&
                    caretPosition === String(rawValue || '').length
                ) {
                    nextCursor = normalized.value.length;
                } else if (caretPosition != null) {
                    nextCursor = Math.max(0, Math.min(caretPosition, normalized.value.length));
                }

                if (nextCursor == null) {
                    return;
                }

                this.$nextTick(() => {
                    const el = this.$el && this.$el.querySelector
                        ? this.$el.querySelector('input.widget-ip')
                        : null;
                    if (!el || el.value !== this.inputValue || this.inputValue === prevValue) return;
                    if (typeof el.setSelectionRange === 'function') {
                        el.setSelectionRange(nextCursor, nextCursor);
                    }
                });
            },
            handleBackspaceAcrossSeparator(target) {
                if (!target) return false;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                if (start == null || end == null || start !== end || start < 1) {
                    return false;
                }

                const value = String(this.inputValue || '');
                if (value.charAt(start - 1) !== '.' || !isDigitChar(value.charAt(start - 2))) {
                    return false;
                }

                const nextRaw = start === value.length
                    ? value.slice(0, Math.max(0, start - 2))
                    : value.slice(0, Math.max(0, start - 2)) + value.slice(start - 1);

                this.applyNormalizedValue(nextRaw, Math.max(0, start - 2));
                return true;
            },
            onKeyDown(e) {
                if (e.ctrlKey || e.metaKey) return;
                if (e.altKey && e.key.length > 1) return;
                if (e.key === 'Backspace' && this.handleBackspaceAcrossSeparator(e.target)) {
                    e.preventDefault();
                    return;
                }
                if (isAllowedIpKey(e.key, allowMask)) return;
                e.preventDefault();
            },
            onInputHandler(e) {
                const rawInputValue = String(e.target.value || '');
                const prevCursor = typeof e.target.selectionStart === 'number'
                    ? e.target.selectionStart
                    : null;
                this.applyNormalizedValue(rawInputValue, prevCursor);
            },
            handleBlur() {
                this.isFocused = false;
                this.commitDraft();
                this.deactivateDraftController();
            },
            onBlur() {
                if (this.inputValue === '') {
                    this.error = '';
                    return;
                }
                const regexError = validateRegexValue(
                    this.inputValue,
                    this.widgetConfig.regex,
                    this.widgetConfig.err_text
                );
                if (regexError) {
                    this.error = regexError;
                    return;
                }
                this.error = validateFn(this.inputValue)
                    ? ''
                    : this.widgetConfig.err_text || 'Неверный формат';
            },
            commitDraft() {
                this.onBlur();
                this.handleTableCellCommitValidation(this.error);
                this.emitValue();
            },
            setValue(value) {
                const raw = value == null ? '' : String(value);
                this.inputValue = normalizeIpLikeValue(raw, allowMask).value;
                this.onBlur();
            }
        },
        watch: {
            'widgetConfig.value': {
                immediate: true,
                handler(value) {
                    if (value === undefined) return;
                    this.syncCommittedValue(value, (nextValue) => this.setValue(nextValue));
                }
            }
        }
    };
}

// Валидация IP строго по октетам 0..255, без лидирующих нулей для многозначных
function validateIPv4(ip) {
    if (!ip) return true;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => isCommittedOctetValid(p));
}

// Валидация IP/CIDR
function validateIPv4Cidr(s) {
    if (!s) return true;
    const [ip, mask] = s.split('/');
    if (!validateIPv4(ip)) return false;
    if (mask === undefined) return false;
    if (!/^\d{1,2}$/.test(mask)) return false;
    const n = Number(mask);
    return n >= 0 && n <= 32;
}

const IP_MASK_TEMPLATE = 'xxx.xxx.xxx.xxx';
const IP_CIDR_TEMPLATE = 'xxx.xxx.xxx.xxx/xx';

const IpWidget = createIpLikeWidget(IP_MASK_TEMPLATE, validateIPv4, false);
const IpMaskWidget = createIpLikeWidget(IP_CIDR_TEMPLATE, validateIPv4Cidr, true);

export { IpWidget, IpMaskWidget };
