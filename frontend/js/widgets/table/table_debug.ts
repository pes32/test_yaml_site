function tableLog(...args: unknown[]) {
    if (!tableDebugState.enabled) {
        return;
    }
    console.log('[TableWidget]', ...args);
}

const tableDebugState = {
    enabled: false
};

function setTableDebugEnabled(enabled: boolean) {
    tableDebugState.enabled = !!enabled;
}

export { setTableDebugEnabled, tableDebugState, tableLog };
