import { asRecord } from '../shared/object_record.ts';

type DiagnosticLevel = 'info' | 'warning' | 'error' | string;

type FrontendDiagnosticItem = {
    code: string;
    file: string;
    level: DiagnosticLevel;
    message: string;
    nodePath: string;
    page: string;
};

type DiagnosticCounts = {
    error: number;
    info: number;
    warning: number;
};

function normalizeDiagnostics(items: unknown): FrontendDiagnosticItem[] {
    return (Array.isArray(items) ? items : []).map((item) => {
        const record = asRecord(item);
        return {
            level: typeof record.level === 'string' ? record.level : 'info',
            code: typeof record.code === 'string' ? record.code : 'diagnostic',
            message: typeof record.message === 'string' ? record.message : '',
            page: typeof record.page === 'string' ? record.page : '',
            file: typeof record.file === 'string' ? record.file : '',
            nodePath: typeof record.node_path === 'string' ? record.node_path : ''
        };
    });
}

function countDiagnosticsByLevel(items: unknown): DiagnosticCounts {
    const counts: DiagnosticCounts = {
        info: 0,
        warning: 0,
        error: 0
    };

    normalizeDiagnostics(items).forEach((item) => {
        if (item.level === 'info' || item.level === 'warning' || item.level === 'error') {
            counts[item.level] += 1;
        }
    });

    return counts;
}

function hasVisibleDiagnostics(items: unknown): boolean {
    return normalizeDiagnostics(items).length > 0;
}

function formatDiagnosticLocation(item: Partial<FrontendDiagnosticItem>): string {
    const parts: string[] = [];
    if (item.page) {
        parts.push(`page: ${item.page}`);
    }
    if (item.file) {
        parts.push(item.file);
    }
    if (item.nodePath) {
        parts.push(item.nodePath);
    }
    return parts.join(' | ');
}

function logDiagnosticsToConsole(scope: unknown, items: unknown): void {
    const diagnostics = normalizeDiagnostics(items);
    if (!diagnostics.length || typeof console === 'undefined') {
        return;
    }

    const counts = countDiagnosticsByLevel(diagnostics);
    const scopeName = String(scope || 'runtime');
    const summary = `${scopeName}: diagnostics info=${counts.info} warning=${counts.warning} error=${counts.error}`;

    if (typeof console.groupCollapsed === 'function') {
        console.groupCollapsed(summary);
        diagnostics.forEach((item) => {
            const location = formatDiagnosticLocation(item);
            const line = `${item.level.toUpperCase()} ${item.code}: ${item.message}`;
            if (location) {
                console.log(`${line} (${location})`);
            } else {
                console.log(line);
            }
        });
        console.groupEnd();
        return;
    }

    console.log(summary, diagnostics);
}

export type {
    DiagnosticCounts,
    DiagnosticLevel,
    FrontendDiagnosticItem
};

export {
    countDiagnosticsByLevel,
    formatDiagnosticLocation,
    hasVisibleDiagnostics,
    logDiagnosticsToConsole,
    normalizeDiagnostics
};
