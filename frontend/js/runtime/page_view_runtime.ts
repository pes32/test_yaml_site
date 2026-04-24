import { collectActiveWidgetNames } from './page_selectors.ts';
import type { PageAttrConfig, PageViewHost } from './page_contract.ts';
import { restoreScrollRootTop } from './scroll_root.ts';
import {
    buildViewId,
    getNumberRecordValue,
    resolveTabbedViewPart,
    setNumberRecordValue,
    toggleBooleanRecordFlag
} from './view_state_helpers.ts';
import widgetFactory from '../widgets/factory.ts';

function normalizeActiveState(vm: PageViewHost) {
    if (!vm.menus.length) {
        vm.activeMenuIndex = 0;
        vm.activeTabIndex = 0;
        return;
    }

    if (vm.activeMenuIndex < 0 || vm.activeMenuIndex >= vm.menus.length) {
        vm.activeMenuIndex = 0;
    }

    const tabs = vm.activeTabs;
    if (!tabs.length) {
        vm.activeTabIndex = 0;
        return;
    }

    if (vm.activeTabIndex < 0 || vm.activeTabIndex >= tabs.length) {
        vm.activeTabIndex = 0;
    }
}

function setActiveViewFromHash(vm: PageViewHost) {
    const hash = typeof window !== 'undefined' ? (window.location.hash || '') : '';
    const match = hash.match(/^#menu-(\d+)(?:-tab-(\d+))?$/);

    if (!match) {
        vm.activeMenuIndex = 0;
        vm.activeTabIndex = 0;
        normalizeActiveState(vm);
        return;
    }

    const menuIndex = parseInt(match[1], 10);
    const tabIndex = match[2] !== undefined ? parseInt(match[2], 10) : 0;

    vm.activeMenuIndex = Number.isNaN(menuIndex) ? 0 : menuIndex;
    vm.activeTabIndex = Number.isNaN(tabIndex) ? 0 : tabIndex;
    normalizeActiveState(vm);
}

function updateHash(vm: PageViewHost) {
    if (!vm.activeMenu || typeof window === 'undefined' || typeof history === 'undefined') {
        return;
    }

    const nextHash = `#${buildViewId(
        'menu',
        vm.activeMenuIndex,
        vm.activeTabs.length ? resolveTabbedViewPart(true, vm.activeTabIndex) : false
    )}`;

    if (window.location.hash !== nextHash) {
        history.replaceState(null, '', nextHash);
    }
}

function registerHashListener(vm: PageViewHost) {
    if (vm.uiState.hashListenerBound || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('hashchange', vm.onHashChange as EventListener);
    vm.uiState.hashListenerBound = true;
}

function unregisterHashListener(vm: PageViewHost) {
    if (!vm.uiState.hashListenerBound || typeof window === 'undefined') {
        return;
    }

    window.removeEventListener('hashchange', vm.onHashChange as EventListener);
    vm.uiState.hashListenerBound = false;
}

function getActiveViewId(vm: PageViewHost): string {
    if (!vm.activeMenu) {
        return '';
    }

    return buildViewId(
        'menu',
        vm.activeMenuIndex,
        resolveTabbedViewPart(vm.activeTabs.length > 0, vm.activeTabIndex)
    );
}

function rememberActiveViewScroll(vm: PageViewHost) {
    const viewId = getActiveViewId(vm);
    const scrollRoot = typeof vm.getPageScrollRoot === 'function'
        ? vm.getPageScrollRoot()
        : null;
    if (!viewId || !scrollRoot) {
        return;
    }

    vm.viewScrollTopById = setNumberRecordValue(
        vm.viewScrollTopById,
        viewId,
        scrollRoot.scrollTop || 0
    );
}

function restoreActiveViewScroll(
    vm: PageViewHost,
    viewId: string = getActiveViewId(vm)
) {
    void vm.$nextTick(() => {
        if (!viewId || viewId !== getActiveViewId(vm)) {
            return;
        }

        const scrollRoot = typeof vm.getPageScrollRoot === 'function'
            ? vm.getPageScrollRoot()
            : null;
        if (!scrollRoot) {
            return;
        }

        const top = getNumberRecordValue(vm.viewScrollTopById, viewId);

        restoreScrollRootTop(scrollRoot, top);

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo(0, 0);
        }
    });
}

async function prefetchWidgetsByNames(vm: PageViewHost, names: string[]) {
    const widgetTypes = (Array.isArray(names) ? names : [])
        .map((name) => vm.getWidgetConfig(name))
        .map((config: PageAttrConfig) => config && typeof config.widget === 'string' ? config.widget : '')
        .filter((type) => type !== 'table')
        .filter(Boolean);

    if (!widgetTypes.length) {
        return;
    }

    await widgetFactory.prefetchWidgetTypes(widgetTypes);
}

async function prefetchActiveViewWidgets(vm: PageViewHost) {
    const widgetNames = collectActiveWidgetNames(vm.activeMenu, vm.activeTabIndex);
    await prefetchWidgetsByNames(vm, widgetNames);
}

async function syncActiveView(vm: PageViewHost) {
    await vm.waitForViewUpdate();
    restoreActiveViewScroll(vm);
    await vm.fetchActiveViewAttrs();
}

async function finishInitialViewActivation(vm: PageViewHost) {
    setActiveViewFromHash(vm);
    void prefetchActiveViewWidgets(vm);
    await syncActiveView(vm);
    registerHashListener(vm);
}

async function refreshActiveViewAfterNavigation(vm: PageViewHost) {
    void prefetchActiveViewWidgets(vm);
    await syncActiveView(vm);
}

async function handleHashChange(vm: PageViewHost) {
    await vm.runBoundaryAction('navigation', async () => {
        rememberActiveViewScroll(vm);
        setActiveViewFromHash(vm);
        void prefetchActiveViewWidgets(vm);
        await syncActiveView(vm);
        return null;
    });
}

async function activateViewFromNavigation(
    vm: PageViewHost,
    selectActiveView: () => void
) {
    rememberActiveViewScroll(vm);
    selectActiveView();
    normalizeActiveState(vm);
    updateHash(vm);
    await refreshActiveViewAfterNavigation(vm);
}

function handleMenuClick(vm: PageViewHost, index: number) {
    if (index < 0 || index >= vm.menus.length) {
        return;
    }

    void vm.runBoundaryAction('navigation', async () => {
        await activateViewFromNavigation(vm, () => {
            vm.activeMenuIndex = index;
            vm.activeTabIndex = 0;
        });
        return null;
    });
}

function handleTabClick(vm: PageViewHost, index: number) {
    if (!vm.activeTabs.length || index < 0 || index >= vm.activeTabs.length) {
        return;
    }

    void vm.runBoundaryAction('navigation', async () => {
        await activateViewFromNavigation(vm, () => {
            vm.activeTabIndex = index;
        });
        return null;
    });
}

function getSectionCollapseId(vm: PageViewHost, sectionIndex: number): string {
    return buildViewId(
        'page-section',
        vm.activeMenuIndex,
        resolveTabbedViewPart(vm.activeTabs.length > 0, vm.activeTabIndex),
        sectionIndex
    );
}

function isSectionCollapsed(vm: PageViewHost, sectionIndex: number): boolean {
    return Boolean(vm.collapsedSections[getSectionCollapseId(vm, sectionIndex)]);
}

function toggleSectionCollapse(vm: PageViewHost, sectionIndex: number) {
    const sectionId = getSectionCollapseId(vm, sectionIndex);
    vm.collapsedSections = toggleBooleanRecordFlag(vm.collapsedSections, sectionId);
}

export {
    finishInitialViewActivation,
    getActiveViewId,
    getSectionCollapseId,
    handleHashChange,
    handleMenuClick,
    handleTabClick,
    isSectionCollapsed,
    normalizeActiveState,
    prefetchActiveViewWidgets,
    prefetchWidgetsByNames,
    refreshActiveViewAfterNavigation,
    registerHashListener,
    rememberActiveViewScroll,
    restoreActiveViewScroll,
    setActiveViewFromHash,
    toggleSectionCollapse,
    unregisterHashListener,
    updateHash
};
