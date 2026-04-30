import type { TableCommand, TableCoreCellPatch } from './table_contract.ts';
import type { RuntimeStateSyncOptions } from './table_runtime_state.ts';

type RuntimeCommandSyncOptions = RuntimeStateSyncOptions;

type RuntimePatchOptions = RuntimeCommandSyncOptions & {
    skipEmit?: boolean;
    skipGroupingViewRefresh?: boolean;
};

type RuntimeCommandDispatcher = {
    $nextTick(callback?: () => void): Promise<unknown>;
    dispatchTableCommand(
        command: TableCommand,
        payload?: Record<string, unknown>,
        phase?: string,
        options?: RuntimeCommandSyncOptions
    ): unknown;
    groupingActive: boolean;
    isFullyLoaded: boolean;
    onInput(): void;
    refreshGroupingViewFromData(): void;
    _scheduleStickyTheadUpdate(): void;
};

function patchCommandSyncOptions(options: RuntimePatchOptions): RuntimeCommandSyncOptions {
    return {
        skipContextMenu: true,
        skipEditing: options.skipEditing !== false,
        skipGrouping: options.skipGrouping === true,
        skipHistory: options.skipHistory === true,
        skipSelection: options.skipSelection === true,
        skipSort: true
    };
}

function dispatchRuntimeCellPatches(
    runtime: RuntimeCommandDispatcher,
    patches: readonly TableCoreCellPatch[] | null | undefined,
    phase = 'patch cells',
    options: RuntimePatchOptions = {}
): boolean {
    const normalizedPatches = Array.isArray(patches)
        ? patches.filter((patch) => patch?.cell)
        : [];
    if (!normalizedPatches.length) return false;
    runtime.dispatchTableCommand(
        { patches: normalizedPatches, type: 'PATCH_CELLS' },
        {},
        phase,
        patchCommandSyncOptions(options)
    );
    if (
        options.skipGroupingViewRefresh !== true &&
        runtime.groupingActive &&
        runtime.isFullyLoaded
    ) {
        runtime.refreshGroupingViewFromData();
    }
    if (options.skipEmit !== true) runtime.onInput();
    runtime.$nextTick(() => runtime._scheduleStickyTheadUpdate());
    return true;
}

export { dispatchRuntimeCellPatches, patchCommandSyncOptions };
export type { RuntimeCommandDispatcher, RuntimeCommandSyncOptions, RuntimePatchOptions };
