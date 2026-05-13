import frontendApiClient, { FrontendApiError } from './api_client.ts';
import PageRuntimeStore from './page_store.ts';
import type { AttrConfigMap, PageConfigState, UnknownRecord } from './page_contract.ts';
import { asRecord } from '../shared/object_record.ts';

type WidgetSourceLoaderHost = {
    configState: PageConfigState;
    getCurrentPageName(): string;
    getCurrentSnapshotVersion(): string;
    showNotification(message: string, type?: string): void;
};

type EnsureWidgetSourceOptions = {
    silent?: boolean;
};

const SQL_DESCRIPTOR_PREFIXES = new Set([
    'select',
    'with',
    'call',
    'insert',
    'update',
    'delete',
    'create',
    'alter',
    'drop',
    'truncate',
    'do',
    'begin'
]);

const pendingLoads = new Map<string, Promise<void>>();
const PUBLIC_DB_SOURCE_TOKEN = '__yaml_db_source__';

function isYamlDbSourceDescriptor(value: unknown): boolean {
    const text = String(value ?? '').trim();
    if (!text) {
        return false;
    }
    if (text.toLowerCase().endsWith(' -pg')) {
        return true;
    }
    const firstToken = text.split(/\s+/, 1)[0]?.toLowerCase() || '';
    return SQL_DESCRIPTOR_PREFIXES.has(firstToken);
}

function isDbSourceChoiceWidget(config: unknown): boolean {
    const attr = asRecord(config);
    const widgetType = String(attr.widget || '').trim();
    if (attr.x_db_source_loaded === true) {
        return false;
    }
    return (
        widgetType === 'list' ||
        widgetType === 'voc'
    ) && (
        attr.x_db_source === true ||
        attr.source === PUBLIC_DB_SOURCE_TOKEN ||
        isYamlDbSourceDescriptor(attr.source)
    );
}

function dbSourceWidgetNames(attrsByName: unknown): string[] {
    const attrs = asRecord<AttrConfigMap>(attrsByName);
    return Object.entries(attrs)
        .filter(([_name, config]) => isDbSourceChoiceWidget(config))
        .map(([name]) => name);
}

function sourceLoadKey(host: WidgetSourceLoaderHost, widgetName: string): string {
    return [
        host.getCurrentSnapshotVersion(),
        host.getCurrentPageName(),
        widgetName
    ].join(':');
}

function reportWidgetSourceError(
    host: WidgetSourceLoaderHost,
    widgetName: string,
    error: unknown,
    options: EnsureWidgetSourceOptions
): void {
    const message = error instanceof Error && error.message
        ? error.message
        : 'Не удалось загрузить источник виджета';
    if (options.silent === true) {
        console.warn(`[widget-source] ${widgetName}: ${message}`, error);
        return;
    }
    host.showNotification(message, 'danger');
}

async function ensureWidgetSourceLoaded(
    host: WidgetSourceLoaderHost,
    widgetName: string,
    options: EnsureWidgetSourceOptions = {}
): Promise<void> {
    const name = String(widgetName || '').trim();
    if (!name || !isDbSourceChoiceWidget(asRecord(host.configState.attrsByName)[name])) {
        return;
    }

    const key = sourceLoadKey(host, name);
    const pending = pendingLoads.get(key);
    if (pending) {
        return pending;
    }

    const request = frontendApiClient.fetchWidgetSource({
        page: host.getCurrentPageName(),
        widget: name,
        snapshot_version: host.getCurrentSnapshotVersion() || null
    }).then((response) => {
        if (response.page !== host.getCurrentPageName() || response.widget !== name) {
            return;
        }
        PageRuntimeStore.patchAttrConfig(
            host.configState,
            name,
            {
                ...(response.patch as UnknownRecord),
                x_db_source_loaded: true
            }
        );
    }).catch((error) => {
        if (error instanceof FrontendApiError && error.code === 'snapshot_changed') {
            return;
        }
        reportWidgetSourceError(host, name, error, options);
    }).finally(() => {
        pendingLoads.delete(key);
    });

    pendingLoads.set(key, request);
    return request;
}

function scheduleDbWidgetSourcePreload(host: WidgetSourceLoaderHost): void {
    const run = () => {
        dbSourceWidgetNames(host.configState.attrsByName).forEach((widgetName) => {
            void ensureWidgetSourceLoaded(host, widgetName, { silent: true });
        });
    };

    if (typeof window === 'undefined') {
        return;
    }

    const win = window as Window & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };
    if (typeof win.requestIdleCallback === 'function') {
        win.requestIdleCallback(run, { timeout: 1200 });
        return;
    }
    window.setTimeout(run, 250);
}

export {
    dbSourceWidgetNames,
    ensureWidgetSourceLoaded,
    isYamlDbSourceDescriptor,
    scheduleDbWidgetSourcePreload
};

export type {
    WidgetSourceLoaderHost
};
