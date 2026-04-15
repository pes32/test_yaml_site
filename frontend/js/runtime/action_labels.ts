import frontendApiClient from './api_client.ts';
import { asTrimmedString } from './action_shared.ts';
import {
    getActionFallbackLabel,
    getProbeableSourceDescriptor,
    normalizeInternalPagePath
} from './action_targets.ts';
import type {
    ActionItem,
    PageTitlePayload,
    ProbeableSourceDescriptor
} from './action_types.ts';

const pageTitleCache: {
    promise: Promise<Map<string, string>> | null;
    value: Map<string, string> | null;
} = {
    value: null,
    promise: null
};

const sourceLabelCache = new Map<string, string>();
const sourceLabelPromises = new Map<string, Promise<string>>();

function getBasenameFromPath(pathname: unknown): string {
    const normalizedPath = String(pathname || '').replace(/\/+$/, '');
    if (!normalizedPath) {
        return '';
    }

    const segments = normalizedPath.split('/');
    return asTrimmedString(segments[segments.length - 1]);
}

async function getPageTitleIndex(): Promise<Map<string, string>> {
    if (pageTitleCache.value instanceof Map) {
        return pageTitleCache.value;
    }

    if (pageTitleCache.promise) {
        return pageTitleCache.promise;
    }

    pageTitleCache.promise = frontendApiClient.fetchPages()
        .then((payload: PageTitlePayload) => {
            const index = new Map<string, string>();
            (Array.isArray(payload.pages) ? payload.pages : []).forEach((page) => {
                const path = normalizeInternalPagePath(page && page.url);
                if (!path || index.has(path)) {
                    return;
                }

                const title = asTrimmedString(page && (page.title || page.name || page.url));
                if (title) {
                    index.set(path, title);
                }
            });
            pageTitleCache.value = index;
            return index;
        })
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            pageTitleCache.promise = null;
        });

    return pageTitleCache.promise;
}

async function resolveProbeableSourceLabel(
    descriptor: ProbeableSourceDescriptor | null | undefined
): Promise<string> {
    if (!descriptor || !descriptor.cacheKey) {
        return '';
    }

    if (sourceLabelCache.has(descriptor.cacheKey)) {
        return sourceLabelCache.get(descriptor.cacheKey) || '';
    }

    if (sourceLabelPromises.has(descriptor.cacheKey)) {
        return sourceLabelPromises.get(descriptor.cacheKey) || '';
    }

    const promise = fetch(descriptor.href, {
        method: 'HEAD'
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const label = getBasenameFromPath(descriptor.pathname) || descriptor.fallbackLabel;
            sourceLabelCache.set(descriptor.cacheKey, label);
            return label;
        })
        .finally(() => {
            sourceLabelPromises.delete(descriptor.cacheKey);
        });

    sourceLabelPromises.set(descriptor.cacheKey, promise);
    return promise;
}

async function resolveActionLabel(action: ActionItem | null | undefined): Promise<string> {
    const fallbackLabel = getActionFallbackLabel(action);
    if (!action || typeof action !== 'object') {
        return fallbackLabel;
    }

    if (action.type === 'url') {
        const pagePath = normalizeInternalPagePath(action.target);
        if (!pagePath) {
            return fallbackLabel;
        }

        const pageIndex = await getPageTitleIndex();
        return pageIndex.get(pagePath) || fallbackLabel;
    }

    if (action.type === 'source') {
        const explicitLabel = asTrimmedString(action.label);
        if (explicitLabel) {
            return explicitLabel;
        }

        const probeDescriptor = getProbeableSourceDescriptor(action.target);
        if (!probeDescriptor) {
            return fallbackLabel;
        }

        return resolveProbeableSourceLabel(probeDescriptor);
    }

    return fallbackLabel;
}

export {
    getPageTitleIndex,
    resolveActionLabel,
    resolveProbeableSourceLabel
};
