// Общий миксин для полевых виджетов: containerStyle и единый формат emit

const widgetMixin = {
    computed: {
        containerStyle() {
            const w = this.widgetConfig.width;
            if (w == null) return {};
            return { width: typeof w === 'number' ? w + 'px' : String(w) };
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
