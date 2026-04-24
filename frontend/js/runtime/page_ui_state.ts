import { computed, reactive } from 'vue';

type PageUiState = {
    activeMenuIndex: number;
    activeTabIndex: number;
    collapsedSections: Record<string, boolean>;
    hashListenerBound: boolean;
    tabsFocused: boolean;
    viewScrollTopById: Record<string, number>;
};

function numericStateRef(
    state: PageUiState,
    key: 'activeMenuIndex' | 'activeTabIndex'
) {
    return computed({
        get: () => Number(state[key]) || 0,
        set: (value: number) => {
            state[key] = Number(value) || 0;
        }
    });
}

function booleanStateRef(
    state: PageUiState,
    key: 'tabsFocused'
) {
    return computed({
        get: () => Boolean(state[key]),
        set: (value: boolean) => {
            state[key] = Boolean(value);
        }
    });
}

function recordStateRef<TValue extends Record<string, boolean> | Record<string, number>>(
    state: PageUiState,
    key: 'collapsedSections' | 'viewScrollTopById'
) {
    return computed({
        get: () => (state[key] && typeof state[key] === 'object' ? state[key] : {}) as TValue,
        set: (value: TValue) => {
            state[key] = (value && typeof value === 'object' ? value : {}) as
                PageUiState['collapsedSections'] & PageUiState['viewScrollTopById'];
        }
    });
}

function usePageUiState() {
    const uiState: PageUiState = reactive({
        activeMenuIndex: 0,
        activeTabIndex: 0,
        collapsedSections: {},
        hashListenerBound: false,
        tabsFocused: false,
        viewScrollTopById: {}
    });

    const activeMenuIndex = numericStateRef(uiState, 'activeMenuIndex');
    const activeTabIndex = numericStateRef(uiState, 'activeTabIndex');
    const collapsedSections = recordStateRef<Record<string, boolean>>(
        uiState,
        'collapsedSections'
    );
    const viewScrollTopById = recordStateRef<Record<string, number>>(
        uiState,
        'viewScrollTopById'
    );
    const tabsFocused = booleanStateRef(uiState, 'tabsFocused');

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
