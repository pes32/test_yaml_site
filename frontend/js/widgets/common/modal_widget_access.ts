import type { PageHostRuntimeServices } from '../../runtime/widget_runtime_bridge.ts';

function getModalWidgetAttrs(
    hostServices: PageHostRuntimeServices | null | undefined,
    widgetName: string
) {
    if (typeof hostServices?.getWidgetAttrsByName === 'function') {
        return hostServices.getWidgetAttrsByName(widgetName);
    }

    return {
        widget: 'str',
        label: widgetName
    };
}

function getModalWidgetValue(
    hostServices: PageHostRuntimeServices | null | undefined,
    widgetName: string
) {
    return typeof hostServices?.getWidgetRuntimeValueByName === 'function'
        ? hostServices.getWidgetRuntimeValueByName(widgetName)
        : undefined;
}

function createModalWidgetAccess(hostServices: PageHostRuntimeServices | null | undefined) {
    return {
        getWidgetAttrs: (widgetName: string) => getModalWidgetAttrs(hostServices, widgetName),
        getWidgetValue: (widgetName: string) => getModalWidgetValue(hostServices, widgetName)
    };
}

export { createModalWidgetAccess, getModalWidgetAttrs, getModalWidgetValue };
