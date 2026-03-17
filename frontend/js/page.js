// Страница с виджетами LowCode System

const { createApp } = Vue;

const app = createApp({
    provide() {
        return {
            getConfirmModal: () => this.$refs.confirmModal
        };
    },
    data() {
        return {
            pageConfig: null,
            allAttrs: {},
            menus: [],
            widgets: {},
            loadedAttrNames: [],
            activeMenuIndex: 0,
            activeTabIndex: 0,
            loading: true,
            error: null,
            rootContentOnly: false,
            collapsedSections: {},
            collapsingSectionId: null
        };
    },

    computed: {
        activeMenu() {
            return this.menus[this.activeMenuIndex] || null;
        },

        activeTabs() {
            if (!this.activeMenu || !Array.isArray(this.activeMenu.tabs)) {
                return [];
            }

            return this.activeMenu.tabs;
        },

        activeSections() {
            return window.GuiParser
                ? window.GuiParser.getActiveSections(this.activeMenu, this.activeTabIndex, this.activeTabs)
                : [];
        }
    },

    async mounted() {
        try {
            if (window.pageData) {
                this.pageConfig = window.pageData.pageConfig;
                this.allAttrs = window.pageData.allAttrs || {};
                this.loadedAttrNames = Object.keys(this.allAttrs);
                this.parseConfiguration();
                this.$nextTick(() => {
                    this.setActiveViewFromHash();
                    this.fetchActiveViewAttrs();
                    window.addEventListener('hashchange', this.onHashChange);
                });
            } else {
                await this.loadPageConfig();
            }
        } catch (error) {
            console.error('Ошибка загрузки конфигурации страницы:', error);
            this.error = 'Ошибка загрузки конфигурации страницы';
        } finally {
            this.loading = false;
        }
    },

    beforeUnmount() {
        window.removeEventListener('hashchange', this.onHashChange);
    },

    methods: {
        async loadPageConfig() {
            try {
                const pathParts = window.location.pathname.split('/');
                const pageName = pathParts[pathParts.length - 1];
                const response = await fetch(`/api/page/${pageName}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                this.pageConfig = data.page;
                this.allAttrs = data.allAttrs || {};
                this.loadedAttrNames = Object.keys(this.allAttrs);

                if (!window.pageData) {
                    window.pageData = {};
                }

                window.pageData.pageConfig = this.pageConfig;
                window.pageData.allAttrs = this.allAttrs;

                this.parseConfiguration();
                this.$nextTick(() => {
                    this.setActiveViewFromHash();
                    this.fetchActiveViewAttrs();
                    window.addEventListener('hashchange', this.onHashChange);
                });
            } catch (error) {
                console.error('Ошибка загрузки конфигурации страницы:', error);
                throw error;
            }
        },

        parseConfiguration() {
            this.parseGuiConfig();
            this.parseAttrsConfig();
        },

        parseGuiConfig() {
            const parsed = window.GuiParser
                ? window.GuiParser.parsePageGui(this.pageConfig)
                : { menus: [], modals: {} };

            this.menus = parsed.menus || [];
            this.rootContentOnly = Boolean(parsed.rootContentOnly);

            if (window.pageData) {
                window.pageData.parsedGui = parsed;
            }

            this.normalizeActiveState();

            if (!this.menus.length) {
                console.warn('No menus found in GUI config');
            }
        },

        normalizeActiveState() {
            if (!this.menus.length) {
                this.activeMenuIndex = 0;
                this.activeTabIndex = 0;
                return;
            }

            if (this.activeMenuIndex < 0 || this.activeMenuIndex >= this.menus.length) {
                this.activeMenuIndex = 0;
            }

            const menu = this.activeMenu;
            const tabs = menu && Array.isArray(menu.tabs) ? menu.tabs : [];

            if (!tabs.length) {
                this.activeTabIndex = 0;
                return;
            }

            if (this.activeTabIndex < 0 || this.activeTabIndex >= tabs.length) {
                this.activeTabIndex = 0;
            }
        },

        setActiveViewFromHash() {
            const hash = window.location.hash || '';
            const match = hash.match(/^#menu-(\d+)(?:-tab-(\d+))?$/);

            if (!match) {
                this.activeMenuIndex = 0;
                this.activeTabIndex = 0;
                this.normalizeActiveState();
                return;
            }

            const menuIndex = parseInt(match[1], 10);
            const tabIndex = match[2] !== undefined ? parseInt(match[2], 10) : 0;

            this.activeMenuIndex = Number.isNaN(menuIndex) ? 0 : menuIndex;
            this.activeTabIndex = Number.isNaN(tabIndex) ? 0 : tabIndex;
            this.normalizeActiveState();
        },

        updateHash() {
            if (!this.activeMenu) {
                return;
            }

            let newHash = `#menu-${this.activeMenuIndex}`;
            if (this.activeTabs.length) {
                newHash += `-tab-${this.activeTabIndex}`;
            }

            if (window.location.hash !== newHash) {
                history.replaceState(null, '', newHash);
            }
        },

        onHashChange() {
            this.setActiveViewFromHash();
            this.fetchActiveViewAttrs();
        },

        onMenuClick(index) {
            if (index < 0 || index >= this.menus.length) {
                return;
            }

            this.activeMenuIndex = index;
            this.activeTabIndex = 0;
            this.normalizeActiveState();
            this.updateHash();
            this.fetchActiveViewAttrs();
        },

        onTabClick(index) {
            if (!this.activeTabs.length || index < 0 || index >= this.activeTabs.length) {
                return;
            }

            this.activeTabIndex = index;
            this.normalizeActiveState();
            this.updateHash();
            this.fetchActiveViewAttrs();
        },

        parseAttrsConfig() {
            this.widgets = this.allAttrs || {};
        },

        getCurrentPageName() {
            if (this.pageConfig && this.pageConfig.name) {
                return this.pageConfig.name;
            }

            if (window.pageData && window.pageData.pageConfig && window.pageData.pageConfig.name) {
                return window.pageData.pageConfig.name;
            }

            return '';
        },

        collectActiveWidgetNames() {
            if (!window.GuiParser || !this.activeMenu) {
                return [];
            }

            return window.GuiParser.collectWidgetNamesFromMenu(this.activeMenu, this.activeTabIndex);
        },

        async fetchActiveViewAttrs() {
            if (!this.activeMenu) {
                return;
            }

            const required = this.collectActiveWidgetNames();
            const toLoad = required.filter((name) => !this.loadedAttrNames.includes(name));

            if (toLoad.length === 0) {
                return;
            }

            try {
                const query = encodeURIComponent(toLoad.join(','));
                const pageName = encodeURIComponent(this.getCurrentPageName());
                const resp = await fetch(`/api/attrs?page=${pageName}&names=${query}`);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }

                const data = await resp.json();

                Object.assign(this.allAttrs, data);
                Object.assign(this.widgets, data);
                this.loadedAttrNames.push(...toLoad);

                if (window.pageData) {
                    if (!window.pageData.allAttrs) {
                        window.pageData.allAttrs = {};
                    }

                    Object.assign(window.pageData.allAttrs, data);
                }

                this.parseAttrsConfig();
                await this.loadTableListSources(Object.keys(data));
            } catch (error) {
                console.error('Не удалось загрузить атрибуты для активного меню', error);
                this.showNotification('Ошибка загрузки данных', 'danger');
            }
        },

        async loadTableListSources(attrNames) {
            if (!attrNames || attrNames.length === 0) {
                return;
            }

            const extra = new Set();
            const builtinTokens = new Set(['ip', 'ip_mask', 'datetime', 'int', 'float']);

            attrNames.forEach((name) => {
                const cfg = this.allAttrs[name];
                if (!cfg || cfg.widget !== 'table' || !cfg.table_attrs) {
                    return;
                }

                const text = String(cfg.table_attrs);
                const re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
                let match;

                while ((match = re.exec(text)) !== null) {
                    const token = match[1];
                    if (builtinTokens.has(token) || this.loadedAttrNames.includes(token)) {
                        continue;
                    }

                    extra.add(token);
                }
            });

            const extraNames = Array.from(extra);
            if (extraNames.length === 0) {
                return;
            }

            try {
                const query = encodeURIComponent(extraNames.join(','));
                const pageName = encodeURIComponent(this.getCurrentPageName());
                const resp = await fetch(`/api/attrs?page=${pageName}&names=${query}`);
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}`);
                }

                const data = await resp.json();

                Object.assign(this.allAttrs, data);
                Object.assign(this.widgets, data);
                this.loadedAttrNames.push(...extraNames);

                if (window.pageData) {
                    if (!window.pageData.allAttrs) {
                        window.pageData.allAttrs = {};
                    }

                    Object.assign(window.pageData.allAttrs, data);
                }

                this.parseAttrsConfig();
            } catch (error) {
                console.error('Не удалось загрузить list-источники таблиц', error);
            }
        },

        getWidgetConfig(widgetName) {
            return this.widgets[widgetName] || {
                widget: 'str',
                label: widgetName
            };
        },

        getSectionCollapseId(sectionIndex) {
            const tabPart = this.activeTabs.length ? this.activeTabIndex : 'content';
            return `page-section-${this.activeMenuIndex}-${tabPart}-${sectionIndex}`;
        },

        isSectionCollapsed(sectionIndex) {
            return Boolean(this.collapsedSections[this.getSectionCollapseId(sectionIndex)]);
        },

        toggleSectionCollapse(sectionIndex) {
            const id = this.getSectionCollapseId(sectionIndex);
            this.collapsingSectionId = id;
            this.collapsedSections = { ...this.collapsedSections, [id]: !this.collapsedSections[id] };
            const ms = window.GuiParser?.COLLAPSE_ANIM_MS ?? 350;
            setTimeout(() => {
                this.collapsingSectionId = null;
            }, ms);
        },

        async executeCommand(commandData) {
            try {
                const widgetConfig = this.getWidgetConfig(commandData.widget);
                if (widgetConfig.url) {
                    window.location.href = widgetConfig.url;
                    return;
                }

                const response = await fetch('/api/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        command: commandData.command,
                        params: commandData.params
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                if (result.success) {
                    this.showNotification('Команда выполнена успешно', 'success');
                } else {
                    this.showNotification('Ошибка выполнения команды', 'danger');
                }
            } catch (error) {
                console.error('Ошибка выполнения команды:', error);
                this.showNotification('Ошибка выполнения команды', 'danger');
            }
        },

        showNotification(message, type) {
            const alertType = type || 'info';
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${alertType} alert-dismissible fade show`;
            alertDiv.innerHTML = `${message}<button type="button" class="btn-close" aria-label="Закрыть"></button>`;
            alertDiv.querySelector('.btn-close').addEventListener('click', () => alertDiv.remove());

            const container = document.querySelector('.page-content-column')
                || document.querySelector('.container-fluid');

            if (container) {
                container.insertBefore(alertDiv, container.firstChild);
            }

            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    }
});

app.config.globalProperties.$isFontIcon = (icon) => window.GuiParser?.isFontIcon(icon) ?? false;
app.config.globalProperties.$getIconSrc = (icon) => window.GuiParser?.getIconSrc(icon) ?? null;
app.config.globalProperties.$onIconError = (e) => window.GuiParser?.onIconError(e);

app.component('widget-renderer', WidgetRenderer);
app.component('item-icon', ItemIcon);
app.component('section-card', SectionCard);
app.component('content-rows', ContentRows);
app.component('modal-manager', ModalManager);
app.component('modal-buttons', ModalButtons);
app.component('confirm-modal', ConfirmModal);
app.mount('#app');
