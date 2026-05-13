export type WidgetPayload = { name?: string; value?: unknown };

export function fieldConfig(
  label: string,
  value: unknown,
  readonly = false,
  widget = 'str',
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { label, readonly, value: value ?? '', widget, ...extra };
}

export function listConfig(
  label: string,
  value: unknown,
  source: string[],
  readonly = false,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { label, readonly, source, value: value ?? '', widget: 'list', ...extra };
}

export function iconSrc(icon: string): string {
  return `/templates/icons/${icon}`;
}

export function statusLabel(status: unknown): string {
  return status === 'blocked' ? 'Заблокирован' : 'Активен';
}
