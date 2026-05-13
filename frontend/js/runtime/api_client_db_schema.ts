import type { UnknownRecord } from './api_contract.ts';
import { jsonRequest, requestData } from './api_client_core.ts';

function adminDbSchemaTableQueryString(schema: string, table: string): string {
    return new URLSearchParams({ schema, table }).toString();
}

export function createDbSchemaApiSegment() {
    return {
        async fetchDbSchemaTables() {
            return requestData<{ items: UnknownRecord[] }>('/api/admin/db-schema/tables');
        },

        async fetchDbSchemaColumns(schema: string, table: string) {
            const qs = adminDbSchemaTableQueryString(schema, table);
            return requestData<{ columns: UnknownRecord[] }>(`/api/admin/db-schema/columns?${qs}`);
        },

        async fetchDbSchemaConstraints(schema: string, table: string) {
            const qs = adminDbSchemaTableQueryString(schema, table);
            return requestData<{ primary_key: UnknownRecord | null; foreign_keys: UnknownRecord[] }>(
                `/api/admin/db-schema/constraints?${qs}`
            );
        },

        async previewDbSchemaDdl(payload: UnknownRecord) {
            return requestData<{ statements: string[]; sql: string }>(
                '/api/admin/db-schema/ddl/preview',
                jsonRequest('POST', payload)
            );
        },

        async executeDbSchemaDdl(payload: UnknownRecord) {
            return requestData<UnknownRecord>('/api/admin/db-schema/ddl/execute', jsonRequest('POST', payload));
        },
    };
}
