import frontendApiClient from './runtime/api_client.ts';
import {
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError
} from './runtime/error_model.ts';

type DebugCompatVm = any;

function compatOptions<T extends Record<string, unknown>>(options: T & ThisType<DebugCompatVm>): any {
    return options;
}

function compatBlock<T extends Record<string, unknown>>(block: T & ThisType<DebugCompatVm>): T {
    return block;
}

const debugAppOptions = compatOptions({
    data() {
        return {
            activeTab: 0,
            apiRoutes: [],
            apiLoading: false,
            logLines: [],
            logsLoading: false,
            pages: /** @type {Array<{ name: string, title?: string, url: string }>} */ ([]),
            pagesLoading: false,
            sqlQuery: '',
            sqlLoading: false,
            sqlResult: null,
            diagnostics: [],
            scopeErrors: {
                api: null,
                logs: null,
                pages: null,
                sql: null
            }
        };
    },
    computed: compatBlock({
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
        },
        sqlError() {
            return this.scopeErrors.sql;
        },
        canRunSql() {
            return Boolean((this.sqlQuery || '').trim());
        },
        sqlColumns() {
            return Array.isArray(this.sqlResult?.columns) ? this.sqlResult.columns : [];
        },
        sqlRows() {
            return Array.isArray(this.sqlResult?.rows) ? this.sqlResult.rows : [];
        },
        sqlSummary() {
            if (!this.sqlResult) {
                return '';
            }

            const parts = [`Показано строк: ${this.sqlResult.rowCount || 0}`];
            if (this.sqlResult.truncated) {
                parts.push(`результат ограничен первыми ${this.sqlResult.maxRows} строками`);
            }
            if (this.sqlResult.durationMs > 0) {
                parts.push(`время: ${this.sqlResult.durationMs} мс`);
            }
            return parts.join(' · ');
        }
    }),
    mounted() {
        this.loadApi();
        this.loadLogs();
        this.loadPages();
    },
    methods: compatBlock({
        reportScopeError(scope: string, error: unknown, message: string) {
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
        clearScopeError(scope: string) {
            this.scopeErrors = {
                ...this.scopeErrors,
                [scope]: null
            };
        },
        dismissScopeError(scope: string) {
            this.clearScopeError(scope);
        },
        formatSqlCell(value: unknown) {
            if (value === null) {
                return 'null';
            }
            if (value === undefined) {
                return '';
            }
            if (typeof value === 'object') {
                try {
                    return JSON.stringify(value);
                } catch (error) {
                    return String(value);
                }
            }
            return String(value);
        },
        onSqlKeydown(event: KeyboardEvent) {
            if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
                return;
            }
            event.preventDefault();
            if (this.canRunSql && !this.sqlLoading) {
                this.runSql();
            }
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
        },
        async runSql() {
            if (!this.canRunSql) {
                return;
            }

            this.sqlLoading = true;
            this.sqlResult = null;
            this.clearScopeError('sql');

            try {
                const data = await frontendApiClient.executeDebugSql(this.sqlQuery);
                this.sqlResult = data;
                this.diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
            } catch (error) {
                this.reportScopeError('sql', error, 'Не удалось выполнить SQL-запрос');
            } finally {
                this.sqlLoading = false;
            }
        }
    })
});

export { debugAppOptions };
export default debugAppOptions;
