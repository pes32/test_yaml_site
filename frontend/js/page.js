// Страница с виджетами LowCode System

const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            pageConfig: null,
            allAttrs: {},
            tabs: [],
            widgets: {},
            // Список уже загруженных имён атрибутов, чтобы не запрашивать дважды
            loadedAttrNames: [],
            activeTabIndex: 0,
            loading: true,
            error: null
        };
    },
    
    mounted() {
        try {
            if (window.pageData) {
                this.pageConfig = window.pageData.pageConfig;
                this.allAttrs = window.pageData.allAttrs;
                this.parseConfiguration();
                this.$nextTick(() => {
                    this.setActiveTabFromHash();
                    // Подгружаем атрибуты для активной вкладки
                    this.fetchTabAttrs(this.activeTabIndex);
                    window.addEventListener('hashchange', this.onHashChange);
                });
            } else {
                this.loadPageConfig();
            }
        } catch (error) {
            console.error('Ошибка загрузки конфигурации страницы:', error);
            this.error = 'Ошибка загрузки конфигурации страницы';
        } finally {
            this.loading = false;
        }
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
                this.allAttrs = data.allAttrs;
                this.parseConfiguration();
                this.$nextTick(() => {
                    this.setActiveTabFromHash();
                    this.fetchTabAttrs(this.activeTabIndex);
                    window.addEventListener('hashchange', this.onHashChange);
                });
            } catch (error) {
                console.error('Ошибка загрузки конфигурации страницы:', error);
                throw error;
            }
        },
        
        parseConfiguration() {
            this.parseGuiConfig();
            // Атрибуты будут подгружаться лениво
        },
        
        parseGuiConfig() {
            const gui = this.pageConfig.gui || this.pageConfig;
            this.tabs = [];
            if (gui.tabs && Array.isArray(gui.tabs)) {
                this.tabs = gui.tabs.map(tab => ({
                    name: tab.name,
                    content: this.parseTabContent(tab.content)
                }));
            } else {
                console.warn('No tabs found in GUI config');
            }
        },
        
        setActiveTabFromHash() {
            try {
                const hash = window.location.hash || '';
                const match = hash.match(/^#content-(\d+)$/);
                if (match) {
                    const idx = parseInt(match[1], 10);
                    if (!Number.isNaN(idx) && idx >= 0 && idx < this.tabs.length) {
                        this.activeTabIndex = idx;
                        return;
                    }
                }
                this.activeTabIndex = 0;
            } catch (e) {
                this.activeTabIndex = 0;
            }
        },

        onHashChange() {
            this.setActiveTabFromHash();
        },

        onTabClick(index, event) {
            // Синхронизируем активную вкладку и hash, чтобы не мигали панели
            this.activeTabIndex = index;
            const newHash = `#content-${index}`;
            if (window.location.hash !== newHash) {
                // Меняем hash без скролла
                history.replaceState(null, '', newHash);
            }
            // При переключении вкладки загружаем её атрибуты (если ещё не делали)
            this.fetchTabAttrs(index);
        },

        parseTabContent(content) {
            if (!content || !Array.isArray(content)) {
                console.warn('Invalid content:', content);
                return [];
            }
            // Каждый item -> секция { name?, rows, collapsible=true|false, showHeader }
            const sections = [];
            content.forEach(item => {
                // Пропускаем пустые объекты без строк
                const rows = this.parseContentRows(item.rows);
                if (!rows.length && !item.name) {
                    return;
                }

                const section = {
                    name: item.name || '',
                    rows,
                    // по умолчанию блок сворачиваемый; можно отключить collapsible: false
                    collapsible: item.collapsible !== false,
                    // Показывать заголовок? Можно скрыть через header: false или если name пустой
                    showHeader: item.header !== false && !!item.name
                };
                sections.push(section);
            });
            return sections;
        },
        
        parseContentRows(rows) {
            if (!rows || !Array.isArray(rows)) {
                console.warn('Invalid rows:', rows);
                return [];
            }
            // Возвращаем как есть (массив строк/массивов/объектов)
            return rows;
        },
        
        parseAttrsConfig() {
            // Обновляем основной словарь виджетов
            this.widgets = this.allAttrs;
        },

        /* ====================== Ленивая загрузка атрибутов ====================== */
        /**
         * Собирает список имён виджетов, встречающихся во вкладке
         */
        collectWidgetNames(tab) {
            const names = new Set();

            const processRow = (row) => {
                if (!row) return;
                if (typeof row === 'string') return;
                if (row.widgets && Array.isArray(row.widgets)) {
                    row.widgets.forEach(w => names.add(w));
                } else if (row.columns && typeof row.columns === 'object') {
                    Object.values(row.columns).forEach(col => {
                        if (col.widgets && Array.isArray(col.widgets)) {
                            col.widgets.forEach(w => names.add(w));
                        }
                    });
                }
            };

            if (tab && Array.isArray(tab.content)) {
                tab.content.forEach(section => {
                    if (section.rows && Array.isArray(section.rows)) {
                        section.rows.forEach(processRow);
                    }
                });
            }

            return Array.from(names);
        },

        /**
         * Загружает атрибуты для указанной вкладки, если они ещё не были загружены
         */
        async fetchTabAttrs(tabIndex) {
            if (!this.tabs || !this.tabs[tabIndex]) return;

            // Определяем, какие атрибуты нужны для этой вкладки
            const required = this.collectWidgetNames(this.tabs[tabIndex]);
            const toLoad = required.filter(name => !this.loadedAttrNames.includes(name));

            if (toLoad.length === 0) return; // всё уже загружено

            try {
                const query = encodeURIComponent(toLoad.join(','));
                const resp = await fetch(`/api/attrs?names=${query}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();

                // Обновляем хранилища
                Object.assign(this.allAttrs, data);
                Object.assign(this.widgets, data);
                this.loadedAttrNames.push(...toLoad);

                // Обновляем глобальный объект, чтобы видели модальные окна и т.д.
                if (window.pageData) {
                    if (!window.pageData.allAttrs) window.pageData.allAttrs = {};
                    Object.assign(window.pageData.allAttrs, data);
                }

                // Убеждаемся, что реактивность отработала
                this.parseAttrsConfig();

                // Проверяем таблицы на дополнительные зависимости (list источники)
                await this.loadTableListSources(Object.keys(data));
            } catch (e) {
                console.error('Не удалось загрузить атрибуты для вкладки', e);
                this.showNotification('Ошибка загрузки данных', 'danger');
            }
        },

        /**
         * Из переданных имён атрибутов (только что загруженных) ищет table-виджеты
         * и, если в их table_attrs встречаются источники списков (:attr_name),
         * подгружает их, если они ещё не были загружены.
         */
        async loadTableListSources(attrNames) {
            if (!attrNames || attrNames.length === 0) return;

            const extra = new Set();

            const builtinTokens = new Set(['ip', 'ip_mask', 'datetime', 'int', 'float']);

            attrNames.forEach(name => {
                const cfg = this.allAttrs[name];
                if (!cfg || cfg.widget !== 'table' || !cfg.table_attrs) return;

                const text = String(cfg.table_attrs);
                // Ищем все :token после символа ':'
                const re = /:([A-Za-z_][A-Za-z0-9_]*)/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                    const token = m[1];
                    if (builtinTokens.has(token)) continue;
                    if (!this.loadedAttrNames.includes(token)) {
                        extra.add(token);
                    }
                }
            });

            const extraNames = Array.from(extra);
            if (extraNames.length === 0) return;

            try {
                const query = encodeURIComponent(extraNames.join(','));
                const resp = await fetch(`/api/attrs?names=${query}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();

                Object.assign(this.allAttrs, data);
                Object.assign(this.widgets, data);
                this.loadedAttrNames.push(...extraNames);

                if (window.pageData) {
                    if (!window.pageData.allAttrs) window.pageData.allAttrs = {};
                    Object.assign(window.pageData.allAttrs, data);
                }

                this.parseAttrsConfig();
            } catch (e) {
                console.error('Не удалось загрузить list-источники таблиц', e);
            }
        },
        
        getWidgetConfig(widgetName) {
            return this.widgets[widgetName] || {
                widget: 'str',
                description: widgetName
            };
        },
        
        // Методы ниже были неиспользуемыми и удалены: getColumnClass, safeId.
        
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
                    body: JSON.stringify({ command: commandData.command, params: commandData.params })
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                if (result.success) {
                    this.showNotification('Команда выполнена успешно', 'success');
                    // Если потребуется обновить связанные атрибуты, можно реализовать здесь
                } else {
                    this.showNotification('Ошибка выполнения команды', 'danger');
                }
            } catch (error) {
                console.error('Ошибка выполнения команды:', error);
                this.showNotification('Ошибка выполнения команды', 'danger');
            }
        },
        
        showNotification(message, type = 'info') {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            const container = document.querySelector('.container-fluid');
            container.insertBefore(alertDiv, container.firstChild);
            setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 5000);
        }
    }
});

app.component('widget-renderer', WidgetRenderer);
app.component('modal-manager', ModalManager);
app.component('modal-buttons', ModalButtons);
app.mount('#app');
