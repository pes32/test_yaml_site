// Фабрика виджетов для Vue.js

class WidgetFactory {
    constructor() {
        this.widgetTypes = new Map();
        this.registerDefaultWidgets();
    }
    
    // Регистрация стандартных виджетов
    registerDefaultWidgets() {
        this.register('str', StringWidget);
        this.register('string', StringWidget);
        this.register('int', IntWidget);
        this.register('float', FloatWidget);
        this.register('list', ListWidget);
        this.register('ip', IpWidget);
        this.register('ip_mask', IpMaskWidget);
        this.register('datetime', DateTimeWidget);
        this.register('text', TextWidget);
        this.register('table', TableWidget);
        this.register('button', ButtonWidget);
    }
    
    // Регистрация нового типа виджета
    register(type, WidgetComponent) {
        this.widgetTypes.set(type, WidgetComponent);

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
    
    // Получение списка зарегистрированных типов
    getRegisteredTypes() {
        return Array.from(this.widgetTypes.keys());
    }
    
    // Проверка, зарегистрирован ли тип виджета
    isRegistered(type) {
        return this.widgetTypes.has(type);
    }
}

// Создаем глобальный экземпляр фабрики
const widgetFactory = new WidgetFactory();

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WidgetFactory, widgetFactory };
} else if (typeof window !== 'undefined') {
    window.WidgetFactory = WidgetFactory;
    window.widgetFactory = widgetFactory;
}
