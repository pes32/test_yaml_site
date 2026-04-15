import frontendApiClient, { type ExecuteRequestPayload } from './api_client.ts';
import type { PageAttrConfig, UnknownRecord } from './page_contract.ts';

type ExecuteCommandData = {
    command: string;
    outputAttrs?: string[];
    widget: string;
};

type BoundaryResult<T> =
    | { status: 'executed'; value: T }
    | { status: string; value?: T };

type ExecuteFlowHost = {
    getCurrentPageName(): string;
    getWidgetConfig(widgetName: string): PageAttrConfig;
    getWidgetValue(widgetName: string): unknown;
    runBoundaryAction<T>(kind: string, action: () => Promise<T> | T): Promise<BoundaryResult<T>>;
    showNotification(message: string, type?: string): void;
};

function resolveCommandParams(vm: ExecuteFlowHost, commandData: ExecuteCommandData): UnknownRecord {
    const outputAttrs = commandData.outputAttrs;
    const names: string[] = Array.isArray(outputAttrs)
        ? outputAttrs
        : [];

    return names.reduce<UnknownRecord>((params, attrName) => {
        params[attrName] = vm.getWidgetValue(attrName);
        return params;
    }, {});
}

async function executeCommand(vm: ExecuteFlowHost, commandData: ExecuteCommandData) {
    const boundaryResult = await vm.runBoundaryAction('execute', async () => {
        const widgetConfig = vm.getWidgetConfig(commandData.widget);
        if (typeof widgetConfig.url === 'string' && widgetConfig.url) {
            window.location.href = widgetConfig.url;
            return null;
        }

        const payload: ExecuteRequestPayload = {
            command: commandData.command,
            params: resolveCommandParams(vm, commandData),
            output_attrs: commandData.outputAttrs || [],
            widget: commandData.widget,
            page: vm.getCurrentPageName()
        };

        const result = await frontendApiClient.executeCommand(payload);
        const data = result && result.data && typeof result.data === 'object'
            ? (result.data as UnknownRecord)
            : {};

        vm.showNotification(
            typeof data.message === 'string' && data.message
                ? data.message
                : 'Команда выполнена успешно',
            'success'
        );
        return result;
    });

    return boundaryResult.status === 'executed'
        ? boundaryResult.value
        : null;
}

export type { ExecuteCommandData, ExecuteFlowHost };

export { executeCommand, resolveCommandParams };
