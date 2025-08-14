// Главная страница со списком доступных страниц

const { createApp } = Vue;

createApp({
    data() {
        return {
            pages: [],
            loading: true,
            error: null
        };
    },
    
    async mounted() {
        try {
            const response = await fetch('/api/pages');
            if (!response.ok) {
                throw new Error('Ошибка загрузки страниц');
            }
            this.pages = await response.json();
        } catch (err) {
            this.error = err.message;
        } finally {
            this.loading = false;
        }
    }
}).mount('#app');
