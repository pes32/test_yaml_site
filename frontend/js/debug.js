const { createApp } = Vue;

createApp({
    data() {
        return {
            activeTab: 0,
            apiRoutes: [],
            apiLoading: false,
            apiError: null,
            logLines: [],
            logsLoading: false,
            logError: null,
            pages: [],
            pagesLoading: false,
            pagesError: null,
        };
    },
    computed: {
        logText() {
            return this.logLines.join('');
        },
        apiText() {
            const lines = [];
            for (const r of this.apiRoutes) {
                for (const m of r.methods) {
                    lines.push(`${m} ${r.rule} ${r.endpoint}`);
                }
            }
            return lines.join('\n');
        },
    },
    mounted() {
        this.loadApi();
        this.loadLogs();
        this.loadPages();
    },
    methods: {
        async loadApi() {
            this.apiLoading = true;
            this.apiError = null;
            try {
                const res = await fetch('/api/debug/structure');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
                this.apiRoutes = data.routes || [];
            } catch (e) {
                this.apiError = e.message;
            } finally {
                this.apiLoading = false;
            }
        },
        async loadLogs() {
            this.logsLoading = true;
            this.logError = null;
            try {
                const res = await fetch('/api/debug/logs');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
                this.logLines = data.lines || [];
            } catch (e) {
                this.logError = e.message;
            } finally {
                this.logsLoading = false;
            }
        },
        async loadPages() {
            this.pagesLoading = true;
            this.pagesError = null;
            try {
                const res = await fetch('/api/debug/pages');
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
                this.pages = data.pages || [];
            } catch (e) {
                this.pagesError = e.message;
            } finally {
                this.pagesLoading = false;
            }
        },
    },
}).mount('#debugApp');
