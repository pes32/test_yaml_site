import {
    closeDropdown as closeDropdownRuntime,
    focusInput as focusRuntimeInput,
    getInputElement as getRuntimeInputElement,
    listItemId as resolveRuntimeListItemId,
    moveDropdownHighlightedIndex,
    openDropdown as openDropdownRuntime,
    setDropdownHighlightedIndex,
    type DropdownRuntimeContext,
    type DropdownRuntimeRefs
} from './dropdown_runtime.ts';

type ChoiceDropdownOptions = {
    $nextTick(callback?: () => void): Promise<unknown>;
    getHighlightedIndex(): number;
    getInlineRows(): unknown[];
    getIsDropdownOpen(): boolean;
    getListId(): string;
    getMenuPosition(): Record<string, string>;
    getRefs(): DropdownRuntimeRefs;
    getShouldShowInlineDropdown(): boolean;
    getWidgetConfig(): DropdownRuntimeContext['widgetConfig'];
    onOutsideInteractionCommit(): void;
    resolveHighlightedIndex(): number;
    setHighlightedIndex(value: number): void;
    setIsDropdownOpen(value: boolean): void;
    setMenuPosition(value: Record<string, string>): void;
};

type ChoiceDropdownOpenOptions = {
    highlightFirst?: boolean;
};

function createChoiceDropdownRuntime(options: ChoiceDropdownOptions) {
    const context: DropdownRuntimeContext = {
        $nextTick: options.$nextTick,
        get $refs() {
            return options.getRefs();
        },
        get highlightedIndex() {
            return options.getHighlightedIndex();
        },
        set highlightedIndex(value) {
            options.setHighlightedIndex(Number(value) || 0);
        },
        get inlineRows() {
            return options.getInlineRows();
        },
        get isDropdownOpen() {
            return options.getIsDropdownOpen();
        },
        set isDropdownOpen(value) {
            options.setIsDropdownOpen(Boolean(value));
        },
        get listId() {
            return options.getListId();
        },
        get menuPosition() {
            return options.getMenuPosition();
        },
        set menuPosition(value) {
            options.setMenuPosition(value);
        },
        onOutsideInteractionCommit: options.onOutsideInteractionCommit,
        resolveHighlightedIndex: options.resolveHighlightedIndex,
        get shouldShowInlineDropdown() {
            return options.getShouldShowInlineDropdown();
        },
        get widgetConfig() {
            return options.getWidgetConfig();
        }
    };

    return {
        context,
        closeDropdown: () => closeDropdownRuntime(context),
        focusInput: () => focusRuntimeInput(context),
        getInputElement: () => getRuntimeInputElement(context),
        listItemId: (index: number) => resolveRuntimeListItemId(context, Number(index)),
        moveHighlightedIndex: (delta: number) =>
            moveDropdownHighlightedIndex(context, options.getInlineRows().length, delta),
        openDropdown: (openOptions: ChoiceDropdownOpenOptions = {}) =>
            openDropdownRuntime(context, openOptions),
        setHighlightedIndex: (index: number, highlightOptions: { scroll?: boolean } = {}) =>
            setDropdownHighlightedIndex(
                context,
                index,
                options.getInlineRows().length,
                highlightOptions
            )
    };
}

export { createChoiceDropdownRuntime };
export type { ChoiceDropdownOpenOptions, ChoiceDropdownOptions };
