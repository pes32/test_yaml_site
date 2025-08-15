// Дебаг-панель для LowCode System

const { createApp } = Vue;

const debugApp = createApp({
    data() {
        return {
            // API tab
            backendStructure: null,
            modules: [],
            modulesCount: 0,
            modulesFilter: '',
            pages: [],
            // Logs
            logs: [],
            logFilePath: '',
            // REST
            restMethod: 'GET',
            restUrl: '/api/config',
            restBody: '',
            restResponse: '',
            restResponseTable: '',
            restRequests: [],
            // SQL
            sqlQuery: 'SELECT * FROM projects',
            sqlResult: '',
            sqlResultTable: '',
            dbConnectionStatus: '',
            // Python
            pythonCode: "print('Hello World')",
            pythonResult: '',
            pythonResultTable: '',
            // API log (mock)
            apiLogs: []
        };
    },
    async mounted() {
        await this.loadBackendStructure();
        await this.loadModules();
        await this.loadPages();
        await this.loadLogs();
        await this.loadRestRequests();
        this.loadApiStructure();
        setInterval(() => { this.loadLogs(); }, 10000);
    },
    computed: {
        filteredModules() {
            const q = (this.modulesFilter || '').toLowerCase();
            if (!q) return this.modules;
            return this.modules.filter(m => m.toLowerCase().includes(q));
        }
    },
    methods: {
        async loadBackendStructure() {
            try {
                const res = await fetch('/api/debug/structure');
                if (res.ok) {
                    this.backendStructure = await res.json();
                    const el = document.getElementById('apiStructure');
                    if (el) {
                        const tree = this.buildAsciiTree(this.backendStructure);
                        el.innerHTML = `<pre style="font-family: monospace; font-size: 0.85rem;">${tree}</pre>`;
                    }
                }
            } catch (e) { /* noop */ }
        },
        async loadModules() {
            try {
                const res = await fetch('/api/debug/modules');
                if (res.ok) {
                    const data = await res.json();
                    this.modules = data.modules || [];
                    this.modulesCount = data.count || this.modules.length;
                }
            } catch (e) { /* noop */ }
        },
        async loadPages() {
            try {
                const res = await fetch('/api/pages');
                if (res.ok) {
                    this.pages = await res.json();
                }
            } catch (e) { /* noop */ }
        },
        async loadLogs() {
            try {
                const response = await fetch('/api/debug/logs');
                if (response.ok) {
                    const data = await response.json();
                    // Поддержка формата { logs, path } и старого массива
                    if (Array.isArray(data)) {
                        this.logs = data;
                    } else {
                        this.logs = data.logs || [];
                        this.logFilePath = data.path || '';
                    }
                }
            } catch (error) { /* noop */ }
        },

        // alias для шаблона
        refreshLogs() { this.loadLogs(); },

        async loadRestRequests() {
            try {
                const res = await fetch('/api/debug/routes?include_debug=1');
                if (res.ok) {
                    this.restRequests = await res.json();
                }
            } catch (e) { /* noop */ }
        },
        loadApiStructure() {
            const apiStructure = document.getElementById('apiStructure');
            if (apiStructure && !apiStructure.textContent) {
                apiStructure.textContent = 'Нет данных';
            }
        },
        async sendRestRequest() {
            try {
                const options = { method: this.restMethod, headers: { 'Content-Type': 'application/json' } };
                if (this.restBody && ['POST', 'PUT', 'PATCH'].includes(this.restMethod)) {
                    options.body = this.restBody;
                }
                const response = await fetch(this.restUrl, options);
                const data = await response.text();
                try {
                    const jsonData = JSON.parse(data);
                    this.restResponse = JSON.stringify(jsonData, null, 2);
                    this.restResponseTable = this.jsonToTable(jsonData);
                } catch (e) {
                    this.restResponse = data;
                    this.restResponseTable = `<pre>${data}</pre>`;
                }
            } catch (error) {
                this.restResponse = `Ошибка: ${error.message}`;
                this.restResponseTable = `<div class="text-danger">Ошибка: ${error.message}</div>`;
            }
        },
        async executeSql() {
            if (!this.sqlQuery.trim()) {
                this.sqlResult = 'Ошибка: Введите SQL запрос';
                this.sqlResultTable = '<div class="text-danger">Ошибка: Введите SQL запрос</div>';
                return;
            }

            try {
                // Показываем индикатор загрузки
                this.sqlResult = 'Выполнение запроса...';
                this.sqlResultTable = '<div class="text-info">Выполнение запроса...</div>';

                const response = await fetch('/api/debug/sql/execute', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: this.sqlQuery
                    })
                });

                const result = await response.json();

                if (result.success) {
                    if (result.data && Array.isArray(result.data)) {
                        // SELECT запросы с данными
                        this.sqlResult = `SQL Query: ${result.query}\n\nResult:\nВозвращено записей: ${result.row_count}\n\n${JSON.stringify(result.data, null, 2)}`;
                        this.sqlResultTable = this.formatSqlTable(result.data, result.columns);
                    } else if (result.affected_rows !== undefined) {
                        // INSERT/UPDATE/DELETE запросы
                        this.sqlResult = `SQL Query: ${result.query}\n\n${result.message}`;
                        this.sqlResultTable = `<div class="alert alert-success">${result.message}</div>`;
                    } else {
                        // DDL или другие запросы
                        this.sqlResult = `SQL Query: ${result.query}\n\n${result.message}`;
                        this.sqlResultTable = `<div class="alert alert-success">${result.message}</div>`;
                    }
                } else {
                    this.sqlResult = `SQL Query: ${result.query || this.sqlQuery}\n\nОшибка: ${result.error}`;
                    this.sqlResultTable = `<div class="alert alert-danger"><strong>Ошибка:</strong><br>${result.error}</div>`;
                }
            } catch (error) {
                this.sqlResult = `SQL Query: ${this.sqlQuery}\n\nОшибка сети: ${error.message}`;
                this.sqlResultTable = `<div class="alert alert-danger"><strong>Ошибка сети:</strong><br>${error.message}</div>`;
            }
        },
        async executePython() {
            const output = `Python Code:\n${this.pythonCode}\n\nOutput:\nHello World\n\nExecution time: 0.001s`;
            this.pythonResult = output;
            this.pythonResultTable = `<div class="bg-light p-3 rounded"><strong>Output:</strong><br>Hello World<br><br><strong>Execution time:</strong> 0.001s</div>`;
        },
        selectRest(r) {
            this.restUrl = r.rule;
            // выбираем подходящий метод; если текущий допустим — оставляем
            if (!r.methods.includes(this.restMethod)) {
                this.restMethod = r.methods[0] || 'GET';
            }
        },
        buildAsciiTree(data) {
            const lines = [];

            const walk = (key, value, prefix, isLast) => {
                const connector = isLast ? '└──' : '├──';
                const line = `${prefix}${connector} ${key}`;
                lines.push(line);

                const newPrefix = prefix + (isLast ? '    ' : '│   ');

                if (Array.isArray(value)) {
                    value.forEach((item, idx) => {
                        walk(Array.isArray(item) || typeof item === 'object' ? idx : String(item), item, newPrefix, idx === value.length - 1);
                    });
                } else if (value && typeof value === 'object') {
                    const entries = Object.entries(value);
                    entries.forEach(([k, v], idx) => {
                        walk(k, v, newPrefix, idx === entries.length - 1);
                    });
                } else {
                    // leaf, просто значение
                }
            };

            const entries = Object.entries(data || {});
            entries.forEach(([k, v], idx) => walk(k, v, '', idx === entries.length - 1));

            return lines.join('\n');
        },

        jsonToTable(data) {
            if (typeof data !== 'object' || data === null) return `<div>${data}</div>`;
            if (Array.isArray(data)) {
                if (data.length === 0) return '<div>Пустой массив</div>';
                if (data.length === 1) return this.jsonToTable(data[0]);
                const keys = Object.keys(data[0] || {});
                let table = '<table class="table table-striped"><thead><tr>';
                keys.forEach(k => { table += `<th>${k}</th>`; });
                table += '</tr></thead><tbody>';
                data.forEach(row => {
                    table += '<tr>';
                    keys.forEach(k => { table += `<td>${row[k] ?? ''}</td>`; });
                    table += '</tr>';
                });
                table += '</tbody></table>';
                return table;
            }
            let table = '<table class="table table-striped"><tbody>';
            Object.entries(data).forEach(([k, v]) => {
                table += `<tr><td><strong>${k}</strong></td><td>${(typeof v === 'object') ? `<pre>${JSON.stringify(v, null, 2)}</pre>` : v}</td></tr>`;
            });
            table += '</tbody></table>';
            return table;
        },

        formatSqlTable(data, columns) {
            if (!data || !Array.isArray(data)) {
                return '<div>Нет данных для отображения</div>';
            }

            if (data.length === 0) {
                return '<div class="alert alert-info">Запрос выполнен успешно, но не вернул данных</div>';
            }

            // Используем переданные колонки или извлекаем из первой записи
            const tableColumns = columns && columns.length > 0 ? columns : Object.keys(data[0] || {});
            
            let table = '<table class="table table-striped table-bordered"><thead class="table-dark"><tr>';
            tableColumns.forEach(col => {
                table += `<th>${col}</th>`;
            });
            table += '</tr></thead><tbody>';

            data.forEach(row => {
                table += '<tr>';
                tableColumns.forEach(col => {
                    let value = row[col];
                    if (value === null) {
                        value = '<span class="text-muted">NULL</span>';
                    } else if (typeof value === 'object') {
                        value = `<pre class="mb-0">${JSON.stringify(value, null, 2)}</pre>`;
                    } else {
                        value = String(value);
                    }
                    table += `<td>${value}</td>`;
                });
                table += '</tr>';
            });

            table += '</tbody></table>';
            table += `<div class="text-muted mt-2">Показано записей: ${data.length}</div>`;
            
            return table;
        },

        async testDbConnection() {
            try {
                this.dbConnectionStatus = '<div class="text-info">Тестирование подключения...</div>';
                
                const response = await fetch('/api/debug/sql/test');
                const result = await response.json();
                
                if (result.success) {
                    this.dbConnectionStatus = `
                        <div class="alert alert-success">
                            <strong>✓ Подключение успешно!</strong><br>
                            База данных: ${result.database}<br>
                            Сервер: ${result.host}:${result.port}<br>
                            Версия: ${result.version || 'N/A'}
                        </div>
                    `;
                } else {
                    this.dbConnectionStatus = `
                        <div class="alert alert-danger">
                            <strong>✗ Ошибка подключения</strong><br>
                            ${result.error}
                        </div>
                    `;
                }
            } catch (error) {
                this.dbConnectionStatus = `
                    <div class="alert alert-danger">
                        <strong>✗ Ошибка сети</strong><br>
                        ${error.message}
                    </div>
                `;
            }
        }
    }
});

debugApp.mount('#debugApp'); 
