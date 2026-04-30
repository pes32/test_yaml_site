export function pad2(value: unknown): string {
    return String(value).padStart(2, '0');
}

export function formatNowValueForWidgetType(widgetType: string, now = new Date()): string {
    const datePart = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
    const timePart = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    if (widgetType === 'date') return datePart;
    if (widgetType === 'time') return timePart;
    if (widgetType === 'datetime') return `${datePart} ${timePart}`;
    return '';
}
