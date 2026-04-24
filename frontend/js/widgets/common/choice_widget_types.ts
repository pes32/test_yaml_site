type ChoiceWidgetConfigBase = Record<string, unknown> & {
  multiselect?: boolean;
  placeholder?: string;
  readonly?: boolean;
  source?: unknown;
  sup_text?: unknown;
  table_cell_mode?: boolean;
  table_cell_tab_handler?: unknown;
  table_cell_validation_handler?: unknown;
  table_consume_keys?: unknown;
  value?: unknown;
};

export type {
  ChoiceWidgetConfigBase
};
