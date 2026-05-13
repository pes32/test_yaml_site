import type { RoleRecord, UnknownRecord, UserRecord } from './api_contract.ts';
import { jsonRequest, requestData } from './api_client_core.ts';

export function createAdminUsersApiSegment() {
    return {
        async fetchAdminRoles() {
            return requestData<{ roles: RoleRecord[] }>('/api/admin/roles');
        },

        async fetchAdminUsers(limit: number, offset: number) {
            return requestData<{ users: UserRecord[] }>(`/api/admin/users?limit=${limit}&offset=${offset}`);
        },

        async createAdminUser(payload: UnknownRecord) {
            return requestData<{ user: UserRecord }>('/api/admin/users', jsonRequest('POST', payload));
        },

        async updateAdminUser(userId: unknown, payload: UnknownRecord) {
            return requestData<{ user: UserRecord }>(`/api/admin/users/${userId}`, jsonRequest('PUT', payload));
        },

        async setAdminUserPassword(userId: unknown, payload: UnknownRecord) {
            return requestData<{ changed: boolean }>(`/api/admin/users/${userId}/password`, jsonRequest('POST', payload));
        },

        async toggleAdminUserBlock(userId: unknown) {
            return requestData<{ user: UserRecord }>(`/api/admin/users/${userId}/toggle-block`, { method: 'POST' });
        },
    };
}
