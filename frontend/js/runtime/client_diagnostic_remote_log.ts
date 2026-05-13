import { FRONTEND_ERROR_SCOPES } from './error_model.ts';

type RemoteDiagnosticPayload = {
    message: string;
    details?: string;
    context?: string;
    widgetName?: string;
    widgetType?: string;
    vueInfo?: string;
    source?: string;
};

function shouldForwardClientDiagnostic(options: Record<string, unknown>): boolean {
    if (options.scope === FRONTEND_ERROR_SCOPES.widget) return true;
    if (typeof options.widgetName === 'string' && options.widgetName.trim()) return true;
    if (options.context === 'widget_render_fallback') return true;
    return false;
}

export function remoteLogClientDiagnostic(error: unknown, options: Record<string, unknown> = {}): void {
    if (typeof window === 'undefined' || !shouldForwardClientDiagnostic(options)) {
        return;
    }
    const message = error instanceof Error ? error.message : String(error || 'Ошибка клиента');
    const payload: RemoteDiagnosticPayload = {
        message,
        details:
            typeof options.details === 'string'
                ? options.details
                : error instanceof Error && error.stack
                  ? error.stack
                  : '',
        context: typeof options.context === 'string' ? options.context : '',
        widgetName: typeof options.widgetName === 'string' ? options.widgetName : '',
        widgetType: typeof options.widgetType === 'string' ? options.widgetType : '',
        vueInfo: typeof options.vueInfo === 'string' ? options.vueInfo : '',
        source: typeof options.source === 'string' ? options.source : ''
    };
    const body = JSON.stringify({
        message: payload.message,
        details: payload.details,
        context: payload.context,
        widget_name: payload.widgetName,
        widget_type: payload.widgetType,
        vue_info: payload.vueInfo,
        source: payload.source
    });
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon('/api/client-diagnostic', blob);
            return;
        }
    } catch {
        /* fall through */
    }
    void fetch('/api/client-diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'same-origin',
        keepalive: true
    }).catch(() => {});
}
