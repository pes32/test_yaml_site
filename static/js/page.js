// Страница с виджетами LowCode System

const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            pageConfig: null,
            allAttrs: {},
            tabs: [],
            widgets: {},
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
            this.widgets = this.allAttrs;
        },
        
        getWidgetConfig(widgetName) {
            return this.widgets[widgetName] || {
                widget: 'str',
                description: widgetName
            };
        },
        
        getColumnClass(columnIndex) {
            if (columnIndex.includes('100px')) {
                return 'col-auto';
            } else {
                const colNum = columnIndex.replace('column_', '');
                return `col-md-${12 / parseInt(colNum)}`;
            }
        },
        
        safeId(text) {
            return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
                    body: JSON.stringify({ command: commandData.command, params: commandData.params })
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const result = await response.json();
                if (result.success) {
                    this.showNotification('Команда выполнена успешно', 'success');
                    this.updateInputAttrs(commandData);
                } else {
                    this.showNotification('Ошибка выполнения команды', 'danger');
                }
            } catch (error) {
                console.error('Ошибка выполнения команды:', error);
                this.showNotification('Ошибка выполнения команды', 'danger');
            }
        },
        
        updateInputAttrs(commandData) {
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
