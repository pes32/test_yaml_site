import type { TableRuntimeMethodSubset, TableRuntimeMethods } from './table_contract.ts';

import { ClipboardRuntimeMethods } from './table_clipboard_runtime.ts';
import { CellRuntimeMethods } from './table_cell_runtime.ts';
import { DataRuntimeMethods } from './table_data_runtime.ts';
import { EditingRuntimeMethods } from './table_editing_runtime.ts';
import { FormattingRuntimeMethods } from './table_formatting_runtime.ts';
import { HistoryRuntimeMethods } from './table_history_runtime.ts';
import { InteractionRuntimeMethods } from './table_interactions.ts';
import { MenuRuntimeMethods } from './table_menu_runtime.ts';
import { RowRuntimeMethods } from './table_row_runtime.ts';
import { SelectionMethods } from './table_selection.ts';
import { ViewRuntimeMethods } from './table_view_runtime.ts';
import { WidthRuntimeMethods } from './table_width_runtime.ts';
import { mountTableRuntime, unmountTableRuntime } from './table_runtime_lifecycle.ts';
import { tableRuntimeComputed } from './table_runtime_computed.ts';
import { tableRuntimeWatch } from './table_runtime_watch.ts';

const tableRuntimeMethods = {
    ...SelectionMethods,
    ...ViewRuntimeMethods,
    ...DataRuntimeMethods,
    ...CellRuntimeMethods,
    ...RowRuntimeMethods,
    ...EditingRuntimeMethods,
    ...FormattingRuntimeMethods,
    ...WidthRuntimeMethods,
    ...HistoryRuntimeMethods,
    ...InteractionRuntimeMethods,
    ...MenuRuntimeMethods,
    ...ClipboardRuntimeMethods
} satisfies TableRuntimeMethodSubset & TableRuntimeMethods;

function createTableRuntime() {
    return {
        computed: tableRuntimeComputed,
        methods: tableRuntimeMethods,
        mount: mountTableRuntime,
        unmount: unmountTableRuntime,
        watch: tableRuntimeWatch
    };
}

export { createTableRuntime, tableRuntimeMethods };
