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
        hasSupporting: { type: Boolean, default: false }
    },
    emits: ['focusin', 'focusout', 'containerFocusout'],
    computed: {
        hasExplicitWidth() {
            const w = this.widgetConfig && this.widgetConfig.width;
            return w != null && w !== '';
        },
        wrapClass() {
            return {
                ...this.wrapExtra,
                floating: this.labelFloats,
                focused: this.isFocused,
                filled: this.hasValue,
                'widget-readonly': this.widgetConfig.readonly
            };
        }
    },
    template: `
        <div class="widget-container" :class="{ 'widget-explicit-width': hasExplicitWidth }" :style="containerStyle" @focusout="$emit('containerFocusout', $event)">
            <div class="md3-field" :class="{ filled: hasValue }">
                <div class="md3-field-wrap"
                     :class="wrapClass"
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

if (typeof window !== 'undefined') {
    window.Md3Field = Md3Field;
}
