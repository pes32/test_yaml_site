// Виджет для кнопок (button)

import { isFontIcon } from '../gui_parser.js';
import { executeAction, parseButtonAction } from '../runtime/action_runtime.js';

const ButtonWidget = {
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
    template: `
        <div class="widget-container u-wide">
            <button class="widget-button inline-flex-center"
                    :class="buttonClasses"
                    :style="buttonStyle"
                    @click="onButtonClick"
                    :title="buttonTitle">
                <!-- SVG иконка -->
                <img v-if="widgetConfig.icon && !$isFontIcon(widgetConfig.icon)" 
                     :src="$getIconSrc(widgetConfig.icon)"
                     :style="iconStyle"
                     alt=""
                     @error="$onIconError"
                     class="button-icon">
                <!-- FontAwesome иконка -->
                <i v-else-if="widgetConfig.icon && $isFontIcon(widgetConfig.icon)" 
                   :class="widgetConfig.icon"></i>
                <!-- Текст: при icon+text или text-only -->
                <span v-if="widgetConfig.label" 
                      v-text="widgetConfig.label"></span>
            </button>
            
            <div v-if="widgetConfig.sup_text" class="widget-info">
                <span v-text="widgetConfig.sup_text"></span>
            </div>
        </div>
    `,
    data() {
        return {
            value: ''
        };
    },
    computed: {
        buttonAction() {
            return parseButtonAction(this.widgetConfig);
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
            return 'Кнопка';
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
        buttonStyle() {
            const w = this.widgetConfig.width || this.widgetConfig.size;
            if (this.isIconOnly) {
                const iconRef = 24;
                const outerRef = 40;
                const borderTotal = 2;
                const padRef = (outerRef - borderTotal - iconRef) / 2;
                const iconSize = Number(this.widgetConfig.size) || iconRef;
                const widthRaw = this.widgetConfig.width;
                const hasExplicitWidth = widthRaw != null && widthRaw !== '';
                let widthVal;
                let pad;
                if (hasExplicitWidth) {
                    const nw = Number(widthRaw);
                    widthVal = Number.isFinite(nw) && nw > 0 ? nw : outerRef;
                    pad = Math.max(0, Math.floor((widthVal - borderTotal - iconSize) / 2));
                } else {
                    pad = Math.max(0, Math.round((padRef * iconSize) / iconRef));
                    widthVal = iconSize + borderTotal + 2 * pad;
                }
                return {
                    width: `${widthVal}px`,
                    minWidth: `${widthVal}px`,
                    height: `${widthVal}px`,
                    minHeight: `${widthVal}px`,
                    padding: `${pad}px`
                };
            }
            // Кнопка с текстом и иконкой: width задаёт ширину
            if (w != null && w !== '') {
                const widthVal = typeof w === 'number' ? `${w}px` : String(w);
                return {
                    width: widthVal,
                    justifyContent: 'flex-start',
                    textAlign: 'left'
                };
            }
            return {};
        }
    },
    methods: {
        onButtonClick() {
            if (!this.buttonAction) {
                return;
            }
            void executeAction(this, this.buttonAction, {
                dialog: this.widgetConfig.dialog || null,
                outputAttrs: this.widgetConfig.output_attrs,
                widgetName: this.widgetName
            });
        },

        setValue(value) {
            this.value = value;
        },

        getValue() {
            return this.value;
        }
    },
    
    mounted() {
        // Инициализация значений по умолчанию
        if (this.widgetConfig.default !== undefined) {
            this.value = this.widgetConfig.default;
        }
    }
};

export { ButtonWidget };
export default ButtonWidget;
