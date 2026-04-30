import type { Component } from 'vue';
import DateTimeInputWidget from '../datetime/DateTimeInputWidget.vue';
import ListWidget from '../ListWidget.vue';
import VocWidget from '../voc/VocWidget.vue';

const embeddedWidgetComponents: Record<string, Component> = {
    date: DateTimeInputWidget,
    datetime: DateTimeInputWidget,
    list: ListWidget,
    time: DateTimeInputWidget,
    voc: VocWidget
};

function tableEmbeddedWidgetComponent(type: unknown): Component | null {
    const key = String(type || '').trim();
    return embeddedWidgetComponents[key] || null;
}

export { tableEmbeddedWidgetComponent };
