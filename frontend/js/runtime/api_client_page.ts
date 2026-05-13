import type {
    ExecuteRequestPayload,
    TableCommandRequestPayload,
    TableQueryRequestPayload,
    WidgetSourceRequestPayload
} from './api_contract.ts';
import {
    normalizeAttrsResponse,
    normalizeExecuteResponse,
    normalizeModalResponse,
    normalizePageResponse,
    normalizePagesResponse,
    normalizeTableCommandResponse,
    normalizeTableExportResponse,
    normalizeTableQueryResponse,
    normalizeWidgetSourceResponse,
    jsonRequest,
    requestNormalized,
} from './api_client_core.ts';

export function createPageApiSegment() {
    return {
        async fetchPage(pageName: string) {
            return requestNormalized(`/api/page/${encodeURIComponent(pageName)}`, normalizePageResponse);
        },

        async fetchAttrs(pageName: string, names: unknown) {
            const query = encodeURIComponent((Array.isArray(names) ? names : []).join(','));
            return requestNormalized(
                `/api/attrs?page=${encodeURIComponent(pageName)}&names=${query}`,
                normalizeAttrsResponse
            );
        },

        async fetchModal(pageName: string, modalId: string) {
            return requestNormalized(
                `/api/modal-gui?page=${encodeURIComponent(pageName)}&id=${encodeURIComponent(modalId)}`,
                normalizeModalResponse
            );
        },

        async fetchPages() {
            return requestNormalized('/api/pages', normalizePagesResponse);
        },

        async queryTable(payload: TableQueryRequestPayload, options: RequestInit = {}) {
            const request = jsonRequest('POST', payload);
            return requestNormalized(
                '/api/table-query',
                normalizeTableQueryResponse,
                {
                    ...request,
                    ...options,
                    headers: {
                        ...request.headers,
                        ...(options.headers || {})
                    }
                }
            );
        },

        async submitTableCommands(payload: TableCommandRequestPayload, options: RequestInit = {}) {
            const request = jsonRequest('POST', payload);
            return requestNormalized(
                '/api/table-command',
                normalizeTableCommandResponse,
                {
                    ...request,
                    ...options,
                    headers: {
                        ...request.headers,
                        ...(options.headers || {})
                    }
                }
            );
        },

        async exportTable(payload: TableQueryRequestPayload, options: RequestInit = {}) {
            const request = jsonRequest('POST', payload);
            return requestNormalized(
                '/api/table-export',
                normalizeTableExportResponse,
                {
                    ...request,
                    ...options,
                    headers: {
                        ...request.headers,
                        ...(options.headers || {})
                    }
                }
            );
        },

        async executeCommand(payload: ExecuteRequestPayload) {
            return requestNormalized(
                '/api/execute',
                normalizeExecuteResponse,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );
        },

        async fetchWidgetSource(payload: WidgetSourceRequestPayload, options: RequestInit = {}) {
            const request = jsonRequest('POST', payload);
            return requestNormalized(
                '/api/widget-source',
                normalizeWidgetSourceResponse,
                {
                    ...request,
                    ...options,
                    headers: {
                        ...request.headers,
                        ...(options.headers || {})
                    }
                }
            );
        },
    };
}
