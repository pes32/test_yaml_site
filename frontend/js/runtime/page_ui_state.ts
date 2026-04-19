import { computed, reactive } from 'vue';

type PageUiState = {
    activeMenuIndex: number;
    activeTabIndex: number;
    collapsedSections: Record<string, boolean>;
    hashListenerBound: boolean;
    tabsFocused: boolean;
    viewScrollTopById: Record<string, number>;
};

function usePageUiState() {
    const uiState: PageUiState = reactive({
        activeMenuIndex: 0,
        activeTabIndex: 0,
        collapsedSections: {},
        hashListenerBound: false,
        tabsFocused: false,
        viewScrollTopById: {}
    });

    const activeMenuIndex = computed({
        get: () => Number(uiState.activeMenuIndex) || 0,
        set: (value: number) => {
            uiState.activeMenuIndex = Number(value) || 0;
        }
    });
    const activeTabIndex = computed({
        get: () => Number(uiState.activeTabIndex) || 0,
        set: (value: number) => {
            uiState.activeTabIndex = Number(value) || 0;
        }
    });
    const collapsedSections = computed({
        get: () => uiState.collapsedSections,
        set: (value: Record<string, boolean>) => {
            uiState.collapsedSections = value && typeof value === 'object' ? value : {};
        }
    });
    const viewScrollTopById = computed({
        get: () => uiState.viewScrollTopById,
        set: (value: Record<string, number>) => {
            uiState.viewScrollTopById = value && typeof value === 'object' ? value : {};
        }
    });
    const tabsFocused = computed({
        get: () => Boolean(uiState.tabsFocused),
        set: (value: boolean) => {
            uiState.tabsFocused = Boolean(value);
        }
    });

    return {
        activeMenuIndex,
        activeTabIndex,
        collapsedSections,
        tabsFocused,
        uiState,
        viewScrollTopById
    };
}

export type {
    PageUiState
};

export {
    usePageUiState
};
