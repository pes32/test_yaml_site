// Фабрика виджетов для Vue.js

const DEFAULT_WIDGET_REGISTRY = Object.freeze([
    ['str', StringWidget],
    ['int', IntWidget],
    ['float', FloatWidget],
    ['list', ListWidget],
    ['ip', IpWidget],
    ['ip_mask', IpMaskWidget],
    ['datetime', DateTimeWidget],
    ['date', DateWidget],
    ['time', TimeWidget],
    ['text', TextWidget],
    ['button', ButtonWidget],
    ['img', ImgWidget]
]);

class WidgetFactory {
    constructor() {
        this.widgetTypes = new Map();
        this.registerDefaultWidgets();
    }
    
    // Регистрация стандартных виджетов
    registerDefaultWidgets(registry = DEFAULT_WIDGET_REGISTRY) {
        registry.forEach(([type, component]) => {
            this.register(type, component);
        });
    }
    
    // Регистрация нового типа виджета
    register(type, WidgetComponent) {
        this.widgetTypes.set(type, WidgetComponent);
        // Возвращаем this, чтобы можно было вызывать методы цепочкой
        return this;
    }
    
    // Получение компонента виджета по типу
    getWidgetComponent(type) {
        const WidgetComponent = this.widgetTypes.get(type);
        
        if (!WidgetComponent) {
            console.warn(`Неизвестный тип виджета: ${type}, используем StringWidget`);
            return StringWidget;
        }
        
        return WidgetComponent;
    }
}

// Создаем глобальный экземпляр фабрики
const widgetFactory = new WidgetFactory();

if (typeof window.registerTableWidget === 'function') {
    window.registerTableWidget(widgetFactory);
}

// Экспорт для браузера
window.WidgetFactory = WidgetFactory;
window.widgetFactory = widgetFactory;
