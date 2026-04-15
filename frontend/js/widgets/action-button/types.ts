import type { CSSProperties } from 'vue';
import type {
  ActionExecutionContext,
  ActionExecutionOptions,
  ActionItem,
  ActionItemType,
  ActionMalformedFields,
  ActionWidgetConfig,
  SplitButtonActionInspection
} from '../../runtime/action_runtime.ts';

type VisualActionWidgetConfig = ActionWidgetConfig & {
  default?: unknown;
  fon?: unknown;
  hint?: string;
  icon?: string;
  label?: string;
  size?: number | string;
  sup_text?: unknown;
  width?: number | string;
};

type ActionWidgetProps = {
  widgetConfig: VisualActionWidgetConfig;
  widgetName: string;
};

type ActionWidgetEmit = {
  (event: 'execute', payload: unknown): void;
};

type ActionInjectedServices = {
  closeUiModal: (() => Promise<unknown> | unknown) | null;
  getConfirmModal: () => unknown | null;
  openUiModal: ((modalName: string) => Promise<unknown> | unknown) | null;
};

type ActionRuntimeContext = ActionExecutionContext & {
  $emit: ActionWidgetEmit;
  getConfirmModal: () => unknown | null;
};

type ActionButtonVisualOptions = {
  fallbackTitle: string;
};

type ActionButtonContentProps = {
  iconName: string;
  iconStyle: CSSProperties;
  label: string;
  labelClass?: string;
};

export type {
  ActionButtonContentProps,
  ActionButtonVisualOptions,
  ActionExecutionOptions,
  ActionInjectedServices,
  ActionItem,
  ActionItemType,
  ActionMalformedFields,
  ActionRuntimeContext,
  ActionWidgetConfig,
  ActionWidgetEmit,
  ActionWidgetProps,
  SplitButtonActionInspection
};
