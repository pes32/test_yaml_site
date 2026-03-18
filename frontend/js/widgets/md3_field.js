// Базовый компонент обёртки MD3: контейнер, поле, wrap, label, блок supporting (слот)

const Md3Field = {
    inheritAttrs: false,
    mixins: [window.widgetMixin],
    props: {
        widgetConfig: { type: Object, required: true },
        hasValue: { type: Boolean, default: false },
        labelFloats: { type: Boolean, default: false },
        isFocused: { type: Boolean, default: false },
        wrapExtra: { type: Object, default: () => ({}) },
        hasSupporting: { type: Boolean, default: false },
        wrapVariant: { type: String, default: '' },   /* 'date' | 'time' | 'textarea' | 'datetime' */
        containerModifier: { type: String, default: '' }  /* 'textarea' */
    },
    emits: ['focusin', 'focusout', 'containerFocusout'],
    computed: {
        hasExplicitWidth() {
            const w = this.widgetConfig && this.widgetConfig.width;
            return w != null && w !== '';
        },
        dataState() {
            const s = [];
            if (this.hasValue) s.push('filled');
            if (this.isFocused) s.push('focused');
            if (this.wrapExtra.error) s.push('error');
            if (this.labelFloats) s.push('floating');
            if (this.widgetConfig.readonly) s.push('readonly');
            return s.length ? s.join(' ') : undefined;
        },
        wrapClass() {
            const { error, ...rest } = this.wrapExtra;
            return {
                ...rest,
                [`md3-field-wrap--${this.wrapVariant}`]: this.wrapVariant
            };
        },
        containerClass() {
            return {
                'widget-explicit-width': this.hasExplicitWidth,
                [`widget-container--${this.containerModifier}`]: this.containerModifier
            };
        }
    },
    template: `
        <div class="widget-container u-wide" :class="containerClass" :style="containerStyle" @focusout="$emit('containerFocusout', $event)">
            <div class="md3-field" :class="{ filled: hasValue, 'md3-field--readonly': widgetConfig.readonly }">
                <div class="md3-field-wrap"
                     :class="wrapClass"
                     :data-state="dataState"
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
