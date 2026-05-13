import type {
    ApiEnvelope,
    AttrsResponse,
    DbSettingsPublicResponse,
    ExecuteRequestPayload,
    ExecuteResponse,
    FrontendApiErrorOptions,
    ModalResponse,
    PageResponse,
    PageSummary,
    PagesIndexState,
    RoleRecord,
    TableCommandRequestPayload,
    TableCommandResponse,
    TableExportResponse,
    TableQueryRequestPayload,
    TableQueryResponse,
    WidgetSourceRequestPayload,
    WidgetSourceResponse,
    UserRecord
} from './api_contract.ts';
import { createAdminDbApiSegment } from './api_client_admin_db.ts';
import { createAdminUsersApiSegment } from './api_client_admin_users.ts';
import { createAuthApiSegment } from './api_client_auth.ts';
import {
    FrontendApiError,
    normalizePageResponse,
    requestData,
    requestEnvelope,
} from './api_client_core.ts';
import { createDbSchemaApiSegment } from './api_client_db_schema.ts';
import { createPageApiSegment } from './api_client_page.ts';
import { createUserSettingsApiSegment } from './api_client_user_settings.ts';

function createFrontendApiClient() {
    return {
        requestEnvelope,
        requestData,

        ...createPageApiSegment(),
        ...createAuthApiSegment(),
        ...createUserSettingsApiSegment(),
        ...createAdminUsersApiSegment(),
        ...createAdminDbApiSegment(),
        ...createDbSchemaApiSegment(),
    };
}

const frontendApiClient = createFrontendApiClient();

export type {
    ApiEnvelope,
    AttrsResponse,
    DbSettingsPublicResponse,
    ExecuteRequestPayload,
    ExecuteResponse,
    FrontendApiErrorOptions,
    ModalResponse,
    PageResponse,
    PageSummary,
    PagesIndexState,
    RoleRecord,
    TableCommandRequestPayload,
    TableCommandResponse,
    TableExportResponse,
    TableQueryRequestPayload,
    TableQueryResponse,
    WidgetSourceRequestPayload,
    WidgetSourceResponse,
    UserRecord
};

export {
    FrontendApiError,
    frontendApiClient,
    normalizePageResponse,
    requestData
};

export default frontendApiClient;
