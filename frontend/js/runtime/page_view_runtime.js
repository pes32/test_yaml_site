import { collectActiveWidgetNames } from './page_selectors.js';
import widgetFactory from '../widgets/factory.ts';

function normalizeActiveState(vm) {
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

function setActiveViewFromHash(vm) {
    const hash = typeof window !== 'undefined'
        ? (window.location.hash || '')
        : '';
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

function updateHash(vm) {
    if (!vm.activeMenu || typeof window === 'undefined' || typeof history === 'undefined') {
        return;
    }

    let nextHash = `#menu-${vm.activeMenuIndex}`;
    if (vm.activeTabs.length) {
        nextHash += `-tab-${vm.activeTabIndex}`;
    }

    if (window.location.hash !== nextHash) {
        history.replaceState(null, '', nextHash);
    }
}

function registerHashListener(vm) {
    if (vm.uiState.hashListenerBound || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('hashchange', vm.onHashChange);
    vm.uiState.hashListenerBound = true;
}

function unregisterHashListener(vm) {
    if (!vm.uiState.hashListenerBound || typeof window === 'undefined') {
        return;
    }

    window.removeEventListener('hashchange', vm.onHashChange);
    vm.uiState.hashListenerBound = false;
}

function getActiveViewId(vm) {
    if (!vm.activeMenu) {
        return '';
    }

    const tabPart = vm.activeTabs.length ? `tab-${vm.activeTabIndex}` : 'content';
    return `menu-${vm.activeMenuIndex}-${tabPart}`;
}

function rememberActiveViewScroll(vm) {
    const viewId = getActiveViewId(vm);
    const scrollRoot = typeof vm.getPageScrollRoot === 'function'
        ? vm.getPageScrollRoot()
        : null;
    if (!viewId || !scrollRoot) {
        return;
    }

    vm.viewScrollTopById = {
        ...vm.viewScrollTopById,
        [viewId]: scrollRoot.scrollTop || 0
    };
}

function restoreActiveViewScroll(vm, viewId = getActiveViewId(vm)) {
    vm.$nextTick(() => {
        if (!viewId || viewId !== getActiveViewId(vm)) {
            return;
        }

        const scrollRoot = typeof vm.getPageScrollRoot === 'function'
            ? vm.getPageScrollRoot()
            : null;
        if (!scrollRoot) {
            return;
        }

        const top = Object.prototype.hasOwnProperty.call(vm.viewScrollTopById, viewId)
            ? vm.viewScrollTopById[viewId]
            : 0;

        if (typeof scrollRoot.scrollTo === 'function') {
            scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
        } else {
            scrollRoot.scrollTop = top;
        }

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo(0, 0);
        }
    });
}

async function prefetchWidgetsByNames(vm, names) {
    const widgetTypes = (Array.isArray(names) ? names : [])
        .map((name) => vm.getWidgetConfig(name))
        .map((config) => config && typeof config.widget === 'string' ? config.widget : '')
        .filter(Boolean);

    if (!widgetTypes.length) {
        return;
    }

    await widgetFactory.prefetchWidgetTypes(widgetTypes);
}

async function prefetchActiveViewWidgets(vm) {
    const widgetNames = collectActiveWidgetNames(vm.activeMenu, vm.activeTabIndex);
    await prefetchWidgetsByNames(vm, widgetNames);
}

async function finishInitialViewActivation(vm) {
    setActiveViewFromHash(vm);
    void prefetchActiveViewWidgets(vm);
    await vm.waitForViewUpdate();
    restoreActiveViewScroll(vm);
    await vm.fetchActiveViewAttrs();
    registerHashListener(vm);
}

async function refreshActiveViewAfterNavigation(vm) {
    void prefetchActiveViewWidgets(vm);
    await vm.waitForViewUpdate();
    restoreActiveViewScroll(vm);
    await vm.fetchActiveViewAttrs();
}

async function handleHashChange(vm) {
    vm.commitActiveDraftWidget();
    rememberActiveViewScroll(vm);
    setActiveViewFromHash(vm);
    void prefetchActiveViewWidgets(vm);
    await vm.waitForViewUpdate();
    restoreActiveViewScroll(vm);
    await vm.fetchActiveViewAttrs();
}

function handleMenuClick(vm, index) {
    if (index < 0 || index >= vm.menus.length) {
        return;
    }

    vm.commitActiveDraftWidget();
    rememberActiveViewScroll(vm);
    vm.activeMenuIndex = index;
    vm.activeTabIndex = 0;
    normalizeActiveState(vm);
    updateHash(vm);
    void refreshActiveViewAfterNavigation(vm);
}

function handleTabClick(vm, index) {
    if (!vm.activeTabs.length || index < 0 || index >= vm.activeTabs.length) {
        return;
    }

    vm.commitActiveDraftWidget();
    rememberActiveViewScroll(vm);
    vm.activeTabIndex = index;
    normalizeActiveState(vm);
    updateHash(vm);
    void refreshActiveViewAfterNavigation(vm);
}

function getSectionCollapseId(vm, sectionIndex) {
    const tabPart = vm.activeTabs.length ? vm.activeTabIndex : 'content';
    return `page-section-${vm.activeMenuIndex}-${tabPart}-${sectionIndex}`;
}

function isSectionCollapsed(vm, sectionIndex) {
    return Boolean(vm.collapsedSections[getSectionCollapseId(vm, sectionIndex)]);
}

function toggleSectionCollapse(vm, sectionIndex) {
    const sectionId = getSectionCollapseId(vm, sectionIndex);
    vm.collapsedSections = {
        ...vm.collapsedSections,
        [sectionId]: !vm.collapsedSections[sectionId]
    };
}

const PageViewRuntime = {
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

export {
    PageViewRuntime,
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

export default PageViewRuntime;
