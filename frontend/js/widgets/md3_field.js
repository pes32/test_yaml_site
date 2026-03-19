// Базовый компонент обёртки MD3: shell поля отдельно от layout/size-контекста.

function resolveMd3ContainerStyle(widgetConfig) {
    const width = widgetConfig && widgetConfig.width;
    if (width == null || width === '') return {};

    const widthValue = typeof width === 'number' ? `${width}px` : String(width);
    const isTextarea = widgetConfig && widgetConfig.widget === 'text';
    return isTextarea ? { minWidth: widthValue } : { width: widthValue };
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
            return resolveMd3ContainerClass(this.hasExplicitWidth, this.containerModifier);
        }
    },
    template: `
        <div class="widget-container u-wide" :class="containerClass" :style="containerStyle" @focusout="$emit('containerFocusout', $event)">
            <div class="md3-field" :class="{ filled: hasValue, 'md3-field--readonly': widgetConfig.readonly }">
                <div class="md3-field-wrap"
                     :class="[wrapClass, wrapStateClass]"
                     v-bind="wrapData"
                     @focusin="$emit('focusin', $event)"
                     @focusout="$emit('focusout', $event)">
                    <slot></slot>
                    <label v-if="widgetConfig.label">{{ widgetConfig.label }}</label>
                </div>
                <div v-if="hasSupporting" class="md3-supporting">
                    <slot name="supporting"></slot>
                </div>
            </div>
        </div>
    `
};

window.Md3Field = Md3Field;
