// Фабрика виджетов для Vue.js

import StringWidget from './string.js';
import IntWidget from './int.js';
import FloatWidget from './float.js';
import ListWidget from './list.js';
import { IpMaskWidget, IpWidget } from './ip_widgets.js';
import { DateTimeWidget, DateWidget, TimeWidget } from './datetime_widgets.js';
import TextWidget from './text.js';
import ButtonWidget from './button.js';
import ImgWidget from './img.js';
import TableWidget from './table/index.js';

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
    ['img', ImgWidget],
    ['table', TableWidget]
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

const widgetFactory = new WidgetFactory();

export { DEFAULT_WIDGET_REGISTRY, WidgetFactory, widgetFactory };
export default widgetFactory;
