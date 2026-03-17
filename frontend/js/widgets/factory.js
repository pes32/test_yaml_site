// Фабрика виджетов для Vue.js

class WidgetFactory {
    constructor() {
        this.widgetTypes = new Map();
        this.registerDefaultWidgets();
    }
    
    // Регистрация стандартных виджетов
    registerDefaultWidgets() {
        this.register('str', StringWidget);
        this.register('int', IntWidget);
        this.register('float', FloatWidget);
        this.register('list', ListWidget);
        this.register('ip', IpWidget);
        this.register('ip_mask', IpMaskWidget);
        this.register('datetime', DateTimeWidget);
        this.register('date', DateWidget);
        this.register('time', TimeWidget);
        this.register('text', TextWidget);
        this.register('table', TableWidget);
        this.register('button', ButtonWidget);
        this.register('modal', ModalWidget);
        this.register('img', ImgWidget);
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

// Экспорт для браузера
window.WidgetFactory = WidgetFactory;
window.widgetFactory = widgetFactory;
