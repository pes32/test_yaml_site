// Общий миксин для полевых виджетов: containerStyle и единый формат emit

const widgetMixin = {
    computed: {
        containerStyle() {
            const w = this.widgetConfig.width;
            if (w == null) return {};
            const widthVal = typeof w === 'number' ? w + 'px' : String(w);
            // min-width — начальный размер; контейнер может расти и сжиматься вместе с textarea
            return { minWidth: widthVal };
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
