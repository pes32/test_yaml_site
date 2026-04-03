// Базовый компонент обёртки MD3: shell поля отдельно от layout/size-контекста.

function resolveMd3ContainerStyle(widgetConfig) {
    if (widgetConfig && widgetConfig.table_cell_mode === true) {
        return {};
    }
    const width = widgetConfig && widgetConfig.width;
    if (width == null || width === '') return {};

    const widthValue = typeof width === 'number' ? `${width}px` : String(width);
    const isTextarea = widgetConfig && widgetConfig.widget === 'text';
    if (isTextarea) {
        return {
            width: 'fit-content',
            minWidth: widthValue,
            maxWidth: 'none',
            '--widget-textarea-base-width': widthValue
        };
    }

    return {
        width: widthValue,
        maxWidth: 'none'
    };
}

function resolveMd3ContainerClass(hasExplicitWidth, containerModifier) {
    return {
        'widget-explicit-width': hasExplicitWidth,
        [`widget-container--${containerModifier}`]: containerModifier
    };
}

function resolveMd3WrapStateClass(ctx) {
    return {
        'is-filled': ctx.hasValue,
        'is-focused': ctx.isFocused,
        'is-error': ctx.wrapExtra.error,
        'is-floating': ctx.labelFloats,
        'is-readonly': ctx.widgetConfig.readonly
    };
}

function resolveMd3WrapClass(wrapExtra, wrapVariant) {
    const { error, ...rest } = wrapExtra;
    return {
        ...rest,
        [`md3-field-wrap--${wrapVariant}`]: wrapVariant
    };
}

const Md3Field = {
    inheritAttrs: false,
    props: {
        widgetConfig: { type: Object, required: true },
        hasValue: { type: Boolean, default: false },
        labelFloats: { type: Boolean, default: false },
        isFocused: { type: Boolean, default: false },
        wrapExtra: { type: Object, default: () => ({}) },
        wrapData: { type: Object, default: () => ({}) },
        hasSupporting: { type: Boolean, default: false },
        wrapVariant: { type: String, default: '' },   /* 'date' | 'time' | 'textarea' */
        containerModifier: { type: String, default: '' }  /* 'textarea' */
    },
    emits: ['focusin', 'focusout', 'containerFocusout'],
    computed: {
        isTableCellMode() {
            return !!(
                this.widgetConfig && this.widgetConfig.table_cell_mode === true
            );
        },
        hasExplicitWidth() {
            const w = this.widgetConfig && this.widgetConfig.width;
            return w != null && w !== '';
        },
        containerStyle() {
            return resolveMd3ContainerStyle(this.widgetConfig);
        },
        wrapStateClass() {
            return resolveMd3WrapStateClass(this);
        },
        wrapClass() {
            return resolveMd3WrapClass(this.wrapExtra, this.wrapVariant);
        },
        containerClass() {
            return Object.assign(
                {},
                resolveMd3ContainerClass(
                    this.hasExplicitWidth,
                    this.containerModifier
                ),
                {
                    'widget-container--table-cell': this.isTableCellMode
                }
            );
        },
        containerAttrs() {
            const attrs = {};
            if (this.isTableCellMode) {
                attrs['data-table-embedded-widget'] = 'true';
                if (this.widgetConfig.table_consume_keys) {
                    attrs['data-table-consume-keys'] = String(
                        this.widgetConfig.table_consume_keys
                    );
                }
            }
            return attrs;
        },
        supportingVisible() {
            return this.hasSupporting && !this.isTableCellMode;
        }
    },
    template: `
        <slot v-if="isTableCellMode"></slot>
        <div v-else
             class="widget-container u-wide"
             :class="containerClass"
             :style="containerStyle"
             v-bind="containerAttrs"
             @focusout="$emit('containerFocusout', $event)">
            <div class="md3-field" :class="{ filled: hasValue, 'md3-field--readonly': widgetConfig.readonly }">
                <div class="md3-field-wrap"
                     :class="[wrapClass, wrapStateClass]"
                     v-bind="wrapData"
                     @focusin="$emit('focusin', $event)"
                     @focusout="$emit('focusout', $event)">
                    <slot></slot>
                    <label v-if="widgetConfig.label && !isTableCellMode">{{ widgetConfig.label }}</label>
                </div>
                <div v-if="supportingVisible" class="md3-supporting">
                    <slot name="supporting"></slot>
                </div>
            </div>
        </div>
    `
};

export { Md3Field };
export default Md3Field;
