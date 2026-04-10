import frontendApiClient from './api_client.js';

function resolveCommandParams(vm, commandData) {
    const names = Array.isArray(commandData && commandData.outputAttrs)
        ? commandData.outputAttrs
        : [];

    return names.reduce((params, attrName) => {
        params[attrName] = vm.getWidgetValue(attrName);
        return params;
    }, {});
}

async function executeCommand(vm, commandData) {
    const boundaryResult = await vm.runBoundaryAction('execute', async () => {
        const widgetConfig = vm.getWidgetConfig(commandData.widget);
        if (widgetConfig.url) {
            window.location.href = widgetConfig.url;
            return null;
        }

        const result = await frontendApiClient.executeCommand({
            command: commandData.command,
            params: resolveCommandParams(vm, commandData),
            output_attrs: commandData.outputAttrs || [],
            widget: commandData.widget,
            page: vm.getCurrentPageName()
        });
        const data = result && result.data && typeof result.data === 'object'
            ? result.data
            : {};

        vm.showNotification(data.message || 'Команда выполнена успешно', 'success');
        return result;
    });

    return boundaryResult.status === 'executed'
        ? boundaryResult.value
        : null;
}

export { executeCommand, resolveCommandParams };
