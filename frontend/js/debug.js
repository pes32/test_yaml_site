import { createApp } from 'vue';
import frontendApiClient from './runtime/api_client.js';
import {
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError
} from './runtime/error_model.js';
import { DiagnosticsPanel, ErrorPanel } from './widgets/feedback.js';

createApp({
    data() {
        return {
            activeTab: 0,
            apiRoutes: [],
            apiLoading: false,
            logLines: [],
            logsLoading: false,
            pages: [],
            pagesLoading: false,
            diagnostics: [],
            scopeErrors: {
                api: null,
                logs: null,
                pages: null
            }
        };
    },
    computed: {
        logText() {
            return this.logLines.join('');
        },
        apiText() {
            const lines = [];
            for (const route of this.apiRoutes) {
                for (const method of route.methods) {
                    lines.push(`${method} ${route.rule} ${route.endpoint}`);
                }
            }
            return lines.join('\n');
        },
        visibleErrors() {
            return Object.entries(this.scopeErrors)
                .filter(([, item]) => Boolean(item))
                .map(([scope, item]) => ({ scope, item }));
        },
        apiError() {
            return this.scopeErrors.api;
        },
        logError() {
            return this.scopeErrors.logs;
        },
        pagesError() {
            return this.scopeErrors.pages;
        }
    },
    mounted() {
        this.loadApi();
        this.loadLogs();
        this.loadPages();
    },
    methods: {
        reportScopeError(scope, error, message) {
            const normalized = presentFrontendError(
                normalizeFrontendError(error, {
                    scope: FRONTEND_ERROR_SCOPES.debug,
                    recoverable: true,
                    message,
                    details: {
                        debugScope: scope
                    }
                })
            );
            this.scopeErrors = {
                ...this.scopeErrors,
                [scope]: normalized
            };
            return normalized;
        },
        clearScopeError(scope) {
            this.scopeErrors = {
                ...this.scopeErrors,
                [scope]: null
            };
        },
        dismissScopeError(scope) {
            this.clearScopeError(scope);
        },
        async loadApi() {
            this.apiLoading = true;
            this.clearScopeError('api');
            try {
                const data = await frontendApiClient.fetchDebugStructure();
                this.apiRoutes = data.routes || [];
            } catch (error) {
                this.reportScopeError('api', error, 'Не удалось загрузить структуру API');
            } finally {
                this.apiLoading = false;
            }
        },
        async loadLogs() {
            this.logsLoading = true;
            this.clearScopeError('logs');
            try {
                const data = await frontendApiClient.fetchDebugLogs();
                this.logLines = data.lines || [];
            } catch (error) {
                this.reportScopeError('logs', error, 'Не удалось загрузить debug-лог');
            } finally {
                this.logsLoading = false;
            }
        },
        async loadPages() {
            this.pagesLoading = true;
            this.clearScopeError('pages');
            try {
                const data = await frontendApiClient.fetchDebugPages();
                this.pages = data.pages || [];
                this.diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
                if (data.lastError) {
                    this.reportScopeError(
                        'pages',
                        new Error(data.lastError),
                        'Snapshot сообщает об ошибке'
                    );
                }
            } catch (error) {
                this.reportScopeError('pages', error, 'Не удалось загрузить YAML-страницы');
            } finally {
                this.pagesLoading = false;
            }
        }
    }
})
    .component('diagnostics-panel', DiagnosticsPanel)
    .component('error-panel', ErrorPanel)
    .mount('#debugApp');
