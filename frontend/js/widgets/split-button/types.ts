import type { CSSProperties } from 'vue';
import type {
  ActionItem,
  ActionMalformedFields,
  ActionWidgetProps,
  SplitButtonActionInspection
} from '../action-button/types.ts';

type SplitButtonActionDescriptor = {
  item: ActionItem;
  key: string;
};

type SplitButtonDisplayAction = SplitButtonActionDescriptor & {
  displayLabel: string;
};

type SplitButtonMenuStyle = CSSProperties & {
  '--split-menu-max-height'?: string;
};

type SplitButtonMenuLayout = {
  isScrollable: boolean;
  style: SplitButtonMenuStyle;
};

export type {
  ActionItem as SplitButtonActionItem,
  ActionMalformedFields as SplitButtonMalformedFields,
  ActionWidgetProps as SplitButtonWidgetProps,
  SplitButtonActionDescriptor,
  SplitButtonActionInspection,
  SplitButtonDisplayAction,
  SplitButtonMenuLayout,
  SplitButtonMenuStyle
};
