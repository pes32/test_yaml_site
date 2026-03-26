function normalizeDiagnostics(items) {
    return (Array.isArray(items) ? items : []).map((item) => ({
        level: typeof item && item && typeof item.level === 'string'
            ? item.level
            : 'info',
        code: typeof item && item && typeof item.code === 'string'
            ? item.code
            : 'diagnostic',
        message: typeof item && item && typeof item.message === 'string'
            ? item.message
            : '',
        page: typeof item && item && typeof item.page === 'string'
            ? item.page
            : '',
        file: typeof item && item && typeof item.file === 'string'
            ? item.file
            : '',
        nodePath: typeof item && item && typeof item.node_path === 'string'
            ? item.node_path
            : ''
    }));
}

function countDiagnosticsByLevel(items) {
    const counts = {
        info: 0,
        warning: 0,
        error: 0
    };

    normalizeDiagnostics(items).forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(counts, item.level)) {
            counts[item.level] += 1;
        }
    });

    return counts;
}

function hasVisibleDiagnostics(items) {
    return normalizeDiagnostics(items).length > 0;
}

function formatDiagnosticLocation(item) {
    const parts = [];
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

function logDiagnosticsToConsole(scope, items) {
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

export {
    countDiagnosticsByLevel,
    formatDiagnosticLocation,
    hasVisibleDiagnostics,
    logDiagnosticsToConsole,
    normalizeDiagnostics
};
