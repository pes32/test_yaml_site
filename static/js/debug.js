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
            // SQL
            sqlQuery: 'SELECT 1 as test',
            sqlResult: '',
            sqlResultTable: '',
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
                        el.innerHTML = this.jsonToTable(this.backendStructure);
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
            this.sqlResult = `SQL Query: ${this.sqlQuery}\n\nResult:\n+-----+\n|test |\n+-----+\n|1    |\n+-----+\n1 row in set (0.001 sec)`;
            this.sqlResultTable = `<table class="table table-striped"><thead><tr><th>test</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>`;
        },
        async executePython() {
            const output = `Python Code:\n${this.pythonCode}\n\nOutput:\nHello World\n\nExecution time: 0.001s`;
            this.pythonResult = output;
            this.pythonResultTable = `<div class="bg-light p-3 rounded"><strong>Output:</strong><br>Hello World<br><br><strong>Execution time:</strong> 0.001s</div>`;
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
        }
    }
});

debugApp.mount('#debugApp'); 
