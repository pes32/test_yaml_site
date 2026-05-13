import type { UnknownRecord, UserRecord } from './api_contract.ts';
import { jsonRequest, requestData } from './api_client_core.ts';

export function createUserSettingsApiSegment() {
    return {
        async fetchUserSettingsBootstrap() {
            return requestData<{ is_admin: boolean; user: UserRecord }>('/api/user-settings/bootstrap');
        },

        async saveOwnProfile(payload: UnknownRecord) {
            return requestData<{ user: UserRecord }>('/api/user-settings/account', jsonRequest('PUT', payload));
        },

        async changeOwnPassword(payload: UnknownRecord) {
            return requestData<{ changed: boolean }>('/api/user-settings/password', jsonRequest('POST', payload));
        },
    };
}
