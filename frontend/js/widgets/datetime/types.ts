import type { CSSProperties } from 'vue';
import type { CalendarDay } from './core.ts';

type DateTimeWidgetConfig = Record<string, unknown> & {
  readonly?: boolean;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  table_cell_validation_handler?: unknown;
  table_consume_keys?: unknown;
  value?: unknown;
};

type DateTimeWidgetProps = {
  widgetConfig: DateTimeWidgetConfig;
  widgetName: string;
};

type DateTimeInputPayload = {
  config: DateTimeWidgetConfig;
  name: string;
  value: unknown;
};

type DateTimeWidgetEmit = {
  (event: 'input', payload: DateTimeInputPayload): void;
};

type DateTimePopoverStyle = CSSProperties & {
  visibility?: string;
};

type SegmentKind = 'date' | 'time';

type DateTimeMode = 'date' | 'time' | 'datetime';

type DateTimeSegmentExpose = {
  getRoot: () => HTMLElement | null;
};

type PopoverExpose = {
  getRoot: () => HTMLElement | null;
};

export type {
  CalendarDay,
  DateTimeMode,
  DateTimePopoverStyle,
  DateTimeSegmentExpose,
  DateTimeWidgetConfig,
  DateTimeWidgetEmit,
  DateTimeWidgetProps,
  PopoverExpose,
  SegmentKind
};
