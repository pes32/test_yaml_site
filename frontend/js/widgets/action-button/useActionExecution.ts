import { executeAction as runActionItem } from '../../runtime/action_runtime.ts';
import type {
  ActionInjectedServices,
  ActionItem,
  ActionRuntimeContext,
  ActionWidgetEmit,
  ActionWidgetProps
} from './types.ts';

function useActionExecution(
  props: Readonly<ActionWidgetProps>,
  emit: ActionWidgetEmit,
  services: ActionInjectedServices
) {
  const runtimeContext: ActionRuntimeContext = {
    $emit: emit,
    getConfirmModal: services.getConfirmModal
  };

  if (services.openUiModal) {
    runtimeContext.openUiModal = services.openUiModal;
  }

  if (services.closeUiModal) {
    runtimeContext.closeUiModal = services.closeUiModal;
  }

  function executeAction(action: ActionItem): Promise<unknown> {
    return runActionItem(runtimeContext, action, {
      dialog: props.widgetConfig.dialog || null,
      outputAttrs: props.widgetConfig.output_attrs,
      widgetName: props.widgetName
    });
  }

  return {
    executeAction
  };
}

export default useActionExecution;
