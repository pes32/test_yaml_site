import {
    countDiagnosticsByLevel,
    formatDiagnosticLocation,
    normalizeDiagnostics
} from '../runtime/diagnostics.js';

const DiagnosticsPanel = {
    props: {
        diagnostics: {
            type: Array,
            default: () => []
        },
        snapshotVersion: {
            type: String,
            default: ''
        }
    },
    computed: {
        items() {
            return normalizeDiagnostics(this.diagnostics);
        },
        counts() {
            return countDiagnosticsByLevel(this.items);
        },
        hasCritical() {
            return this.counts.error > 0 || this.counts.warning > 0;
        },
        summaryText() {
            const parts = [];
            if (this.counts.error) parts.push(`errors: ${this.counts.error}`);
            if (this.counts.warning) parts.push(`warnings: ${this.counts.warning}`);
            if (this.counts.info) parts.push(`info: ${this.counts.info}`);
            return parts.join(' | ') || 'diagnostics';
        }
    },
    methods: {
        locationText(item) {
            return formatDiagnosticLocation(item);
        }
    },
    template: `
        <details v-if="items.length"
                 class="feedback-panel diagnostics-panel"
                 :open="hasCritical">
            <summary class="feedback-panel__summary">
                <span class="feedback-panel__title">Диагностика</span>
                <span class="feedback-panel__meta" v-text="summaryText"></span>
                <span v-if="snapshotVersion" class="feedback-panel__meta" v-text="'snapshot ' + snapshotVersion"></span>
            </summary>
            <div class="feedback-panel__body">
                <div v-for="(item, index) in items"
                     :key="item.code + ':' + index"
                     class="feedback-panel__item"
                     :class="'feedback-panel__item--' + item.level">
                    <div class="feedback-panel__item-head">
                        <strong v-text="item.code"></strong>
                        <span class="feedback-panel__level" v-text="item.level"></span>
                    </div>
                    <div class="feedback-panel__message" v-text="item.message"></div>
                    <div v-if="locationText(item)" class="feedback-panel__location" v-text="locationText(item)"></div>
                </div>
            </div>
        </details>
    `
};

const ErrorPanel = {
    props: {
        error: {
            type: Object,
            default: null
        }
    },
    emits: ['dismiss'],
    computed: {
        detailsText() {
            if (!this.error || !this.error.details) {
                return '';
            }

            if (typeof this.error.details === 'string') {
                return this.error.details;
            }

            try {
                return JSON.stringify(this.error.details, null, 2);
            } catch {
                return '';
            }
        }
    },
    template: `
        <div v-if="error" class="feedback-panel error-panel">
            <div class="feedback-panel__summary">
                <span class="feedback-panel__title">Ошибка</span>
                <span class="feedback-panel__meta" v-text="error.scope + ' | ' + error.kind"></span>
                <button type="button"
                        class="ui-close-button feedback-panel__dismiss"
                        @click="$emit('dismiss')"
                        aria-label="Скрыть ошибку"></button>
            </div>
            <div class="feedback-panel__body">
                <div class="feedback-panel__message" v-text="error.message"></div>
                <div class="feedback-panel__location" v-text="'recoverable: ' + (error.recoverable ? 'yes' : 'no')"></div>
                <pre v-if="detailsText" class="feedback-panel__details" v-text="detailsText"></pre>
            </div>
        </div>
    `
};

export { DiagnosticsPanel, ErrorPanel };
