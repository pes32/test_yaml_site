import type { DbSettingsPublicResponse, UnknownRecord } from './api_contract.ts';
import { jsonRequest, requestData } from './api_client_core.ts';

export function createAdminDbApiSegment() {
    return {
        async fetchAdminDbSettings() {
            return requestData<DbSettingsPublicResponse>('/api/admin/db-settings');
        },

        async fetchFallbackDbSettings() {
            return requestData<DbSettingsPublicResponse>('/api/admin/db-settings/fallback');
        },

        async testDbSettings(payload: UnknownRecord) {
            return requestData<UnknownRecord>('/api/admin/db-settings/test', jsonRequest('POST', payload));
        },

        async saveDbSettings(payload: UnknownRecord) {
            return requestData<DbSettingsPublicResponse>('/api/admin/db-settings/save', jsonRequest('POST', payload));
        },

        async runAdminSql(query: string) {
            return requestData<UnknownRecord>('/api/admin/sql', jsonRequest('POST', { query }));
        },
    };
}
