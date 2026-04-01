export interface Diagnostic {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  page?: string | null;
  file?: string | null;
  line?: number | null;
  url?: string | null;
  node_path?: string | null;
}

export interface ApiEnvelope<TData> {
  ok: boolean;
  snapshot_version?: string;
  snapshot_created_at?: string;
  data?: TData;
  diagnostics?: Diagnostic[];
  error?: {
    code: string;
    message: string;
  };
}

export interface PageConfig {
  name: string;
  url: string;
  title: string;
  gui: Record<string, unknown>;
  guiMenuKeys: string[];
  modalGuiIds: string[];
}

export interface PageBootstrapData {
  page: PageConfig;
  attrs: Record<string, unknown>;
}

export interface PageState {
  page: PageConfig | null;
  attrs: Record<string, unknown>;
  diagnostics: Diagnostic[];
  snapshotVersion: string;
}

export interface AttrsState {
  page: string;
  attrs: Record<string, unknown>;
  resolvedNames: string[];
  missingNames: string[];
  diagnostics: Diagnostic[];
  snapshotVersion: string;
}

export interface ModalDependencyData {
  widget_names: string[];
}

export interface NormalizedModal {
  id: string;
  name: string;
  title?: string | null;
  icon?: string | null;
  tabs: Array<Record<string, unknown>>;
  content: Array<Record<string, unknown>>;
  buttons: string[];
  widgetNames: string[];
  source: 'embedded' | 'file';
  sourceFile?: string | null;
}

export interface ModalBootstrapData {
  page: string;
  modal: NormalizedModal;
  attrs: Record<string, unknown>;
  resolved_names: string[];
  missing_names: string[];
  dependencies: ModalDependencyData;
}

export interface ModalState {
  page: string;
  modal: NormalizedModal | null;
  attrs: Record<string, unknown>;
  resolvedNames: string[];
  missingNames: string[];
  dependencies: ModalDependencyData;
  diagnostics: Diagnostic[];
  snapshotVersion: string;
}

export interface ExecuteResult {
  command: string;
  params: Record<string, unknown>;
  page: string | null;
  widget: string | null;
  message: string;
  data: unknown;
  diagnostics: Diagnostic[];
  snapshotVersion: string;
}

export interface DebugSqlResult {
  query: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  maxRows: number;
  durationMs: number;
  diagnostics: Diagnostic[];
  snapshotVersion: string;
}
