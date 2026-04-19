import { computed, onMounted, reactive, ref, type ComputedRef, type Ref } from 'vue';
import frontendApiClient from './runtime/api_client.ts';
import type {
    DebugApiRoute,
    DebugSqlResponse as DebugSqlResult,
    DebugSqlRow,
    PageSummary
} from './runtime/api_contract.ts';
import {
    FRONTEND_ERROR_SCOPES,
    normalizeFrontendError,
    presentFrontendError,
    type FrontendDiagnostic,
    type FrontendRuntimeError
} from './runtime/error_model.ts';

type DebugErrorScope = 'api' | 'logs' | 'pages' | 'sql';

type DebugScopeErrors = Record<DebugErrorScope, FrontendRuntimeError | null>;

type VisibleDebugError = {
    item: FrontendRuntimeError;
    scope: DebugErrorScope;
};

type DebugAppPublicSurface = {
    clearScopeError(scope: DebugErrorScope): void;
    dismissScopeError(scope: DebugErrorScope): void;
    loadApi(): Promise<void>;
    loadLogs(): Promise<void>;
    loadPages(): Promise<void>;
    runSql(): Promise<void>;
};

type DebugAppBindings = DebugAppPublicSurface & {
    activeTab: Ref<number>;
    apiError: ComputedRef<FrontendRuntimeError | null>;
    apiLoading: Ref<boolean>;
    apiText: ComputedRef<string>;
    canRunSql: ComputedRef<boolean>;
    diagnostics: Ref<FrontendDiagnostic[]>;
    formatSqlCell(value: unknown): string;
    logError: ComputedRef<FrontendRuntimeError | null>;
    logLines: Ref<string[]>;
    logText: ComputedRef<string>;
    logsLoading: Ref<boolean>;
    onSqlKeydown(event: KeyboardEvent): void;
    pages: Ref<PageSummary[]>;
    pagesError: ComputedRef<FrontendRuntimeError | null>;
    pagesLoading: Ref<boolean>;
    publicSurface: DebugAppPublicSurface;
    sqlColumns: ComputedRef<string[]>;
    sqlError: ComputedRef<FrontendRuntimeError | null>;
    sqlLoading: Ref<boolean>;
    sqlQuery: Ref<string>;
    sqlResult: Ref<DebugSqlResult | null>;
    sqlRows: ComputedRef<DebugSqlRow[]>;
    sqlSummary: ComputedRef<string>;
    visibleErrors: ComputedRef<VisibleDebugError[]>;
};

const DEBUG_ERROR_SCOPES: DebugErrorScope[] = ['api', 'logs', 'pages', 'sql'];

function useDebugApp(): DebugAppBindings {
    const activeTab = ref(0);
    const apiRoutes = ref<DebugApiRoute[]>([]);
    const apiLoading = ref(false);
    const logLines = ref<string[]>([]);
    const logsLoading = ref(false);
    const pages = ref<PageSummary[]>([]);
    const pagesLoading = ref(false);
    const sqlQuery = ref('');
    const sqlLoading = ref(false);
    const sqlResult = ref<DebugSqlResult | null>(null);
    const diagnostics = ref<FrontendDiagnostic[]>([]);
    const scopeErrors = reactive<DebugScopeErrors>({
        api: null,
        logs: null,
        pages: null,
        sql: null
    });

    const logText = computed(() => logLines.value.join(''));
    const apiText = computed(() => {
        const lines: string[] = [];
        apiRoutes.value.forEach((route) => {
            route.methods.forEach((method) => {
                lines.push(`${method} ${route.rule} ${route.endpoint}`);
            });
        });
        return lines.join('\n');
    });
    const visibleErrors = computed<VisibleDebugError[]>(() =>
        DEBUG_ERROR_SCOPES
            .map((scope) => ({ scope, item: scopeErrors[scope] }))
            .filter((entry): entry is VisibleDebugError => Boolean(entry.item))
    );
    const apiError = computed(() => scopeErrors.api);
    const logError = computed(() => scopeErrors.logs);
    const pagesError = computed(() => scopeErrors.pages);
    const sqlError = computed(() => scopeErrors.sql);
    const canRunSql = computed(() => Boolean(sqlQuery.value.trim()));
    const sqlColumns = computed(() => sqlResult.value?.columns || []);
    const sqlRows = computed(() => sqlResult.value?.rows || []);
    const sqlSummary = computed(() => {
        if (!sqlResult.value) {
            return '';
        }

        const parts = [`Показано строк: ${sqlResult.value.rowCount || 0}`];
        if (sqlResult.value.truncated) {
            parts.push(`результат ограничен первыми ${sqlResult.value.maxRows} строками`);
        }
        if (sqlResult.value.durationMs > 0) {
            parts.push(`время: ${sqlResult.value.durationMs} мс`);
        }
        return parts.join(' · ');
    });

    function reportScopeError(scope: DebugErrorScope, error: unknown, message: string): FrontendRuntimeError {
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
        scopeErrors[scope] = normalized;
        return normalized;
    }

    function clearScopeError(scope: DebugErrorScope): void {
        scopeErrors[scope] = null;
    }

    function dismissScopeError(scope: DebugErrorScope): void {
        clearScopeError(scope);
    }

    function formatSqlCell(value: unknown): string {
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return '';
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }
        return String(value);
    }

    function onSqlKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
            return;
        }
        event.preventDefault();
        if (canRunSql.value && !sqlLoading.value) {
            void runSql();
        }
    }

    async function loadApi(): Promise<void> {
        apiLoading.value = true;
        clearScopeError('api');
        try {
            const data = await frontendApiClient.fetchDebugStructure();
            apiRoutes.value = data.routes;
        } catch (error) {
            reportScopeError('api', error, 'Не удалось загрузить структуру API');
        } finally {
            apiLoading.value = false;
        }
    }

    async function loadLogs(): Promise<void> {
        logsLoading.value = true;
        clearScopeError('logs');
        try {
            const data = await frontendApiClient.fetchDebugLogs();
            logLines.value = data.lines;
        } catch (error) {
            reportScopeError('logs', error, 'Не удалось загрузить debug-лог');
        } finally {
            logsLoading.value = false;
        }
    }

    async function loadPages(): Promise<void> {
        pagesLoading.value = true;
        clearScopeError('pages');
        try {
            const data = await frontendApiClient.fetchDebugPages();
            pages.value = data.pages;
            diagnostics.value = data.diagnostics;
            if (data.lastError) {
                reportScopeError(
                    'pages',
                    new Error(data.lastError),
                    'Snapshot сообщает об ошибке'
                );
            }
        } catch (error) {
            reportScopeError('pages', error, 'Не удалось загрузить YAML-страницы');
        } finally {
            pagesLoading.value = false;
        }
    }

    async function runSql(): Promise<void> {
        if (!canRunSql.value) {
            return;
        }

        sqlLoading.value = true;
        sqlResult.value = null;
        clearScopeError('sql');

        try {
            const data = await frontendApiClient.executeDebugSql(sqlQuery.value);
            sqlResult.value = {
                columns: data.columns,
                diagnostics: data.diagnostics,
                durationMs: data.durationMs,
                maxRows: data.maxRows,
                query: data.query,
                rowCount: data.rowCount,
                rows: data.rows,
                snapshotVersion: data.snapshotVersion,
                truncated: data.truncated
            };
            diagnostics.value = data.diagnostics;
        } catch (error) {
            reportScopeError('sql', error, 'Не удалось выполнить SQL-запрос');
        } finally {
            sqlLoading.value = false;
        }
    }

    onMounted(() => {
        void loadApi();
        void loadLogs();
        void loadPages();
    });

    const publicSurface: DebugAppPublicSurface = {
        clearScopeError,
        dismissScopeError,
        loadApi,
        loadLogs,
        loadPages,
        runSql
    };

    return {
        ...publicSurface,
        activeTab,
        apiError,
        apiLoading,
        apiText,
        canRunSql,
        diagnostics,
        formatSqlCell,
        logError,
        logLines,
        logText,
        logsLoading,
        onSqlKeydown,
        pages,
        pagesError,
        pagesLoading,
        publicSurface,
        sqlColumns,
        sqlError,
        sqlLoading,
        sqlQuery,
        sqlResult,
        sqlRows,
        sqlSummary,
        visibleErrors
    };
}

export type {
    DebugApiRoute,
    DebugAppBindings,
    DebugAppPublicSurface,
    DebugErrorScope,
    PageSummary,
    DebugSqlResult,
    DebugSqlRow
};

export {
    useDebugApp
};

export default useDebugApp;
