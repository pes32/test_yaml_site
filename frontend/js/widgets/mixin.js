// Общий миксин для полевых виджетов: containerStyle и единый формат emit

const widgetMixin = {
    computed: {
        containerStyle() {
            const w = this.widgetConfig.width;
            if (w == null) return {};
            const widthVal = typeof w === 'number' ? w + 'px' : String(w);
            // text: minWidth (растягивается при resize вверх); остальные — фиксированная width
            const isText = this.widgetConfig.widget === 'text';
            return isText ? { minWidth: widthVal } : { width: widthVal };
        }
    },
    methods: {
        /** Единый формат события input: { name, value, config } */
        emitInput(value) {
            this.$emit('input', {
                name: this.widgetName,
                value,
                config: this.widgetConfig
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.widgetMixin = widgetMixin;
}
