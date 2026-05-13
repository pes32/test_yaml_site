import type { UserRecord } from './api_contract.ts';
import { jsonRequest, requestData } from './api_client_core.ts';

export function createAuthApiSegment() {
    return {
        async fetchCurrentUser() {
            return requestData<{ user: UserRecord | null }>('/api/auth/me');
        },

        async login(payload: { login: string; password: string }) {
            return requestData<{ user: UserRecord }>('/api/auth/login', jsonRequest('POST', payload));
        },

        async logout() {
            return requestData<{ logged_out: boolean }>('/api/auth/logout', { method: 'POST' });
        },
    };
}
