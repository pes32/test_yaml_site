import frontendApiClient from './api_client.js';

const ACTION_ITEM_TYPES = Object.freeze(['url', 'source', 'command']);
const ACTION_FIELD_ORDER = Object.freeze(['url', 'source', 'command']);
const BUTTON_ACTION_FIELD_PRIORITY = Object.freeze(['source', 'url', 'command']);

const pageTitleCache = {
    value: null,
    promise: null
};

const sourceLabelCache = new Map();
const sourceLabelPromises = new Map();

function asTrimmedString(value) {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (value == null) {
        return '';
    }

    return String(value).trim();
}

function isActionType(value) {
    return ACTION_ITEM_TYPES.includes(value);
}

function unescapeActionToken(value) {
    return String(value || '').replace(/\\\|/g, '|');
}

function parseDslLine(line) {
    const rawLine = String(line || '');
    let separatorIndex = -1;
    let escaped = false;

    for (let index = 0; index < rawLine.length; index += 1) {
        const char = rawLine[index];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\') {
            escaped = true;
            continue;
        }

        if (char === '|') {
            if (separatorIndex === -1) {
                separatorIndex = index;
                continue;
            }

            return {
                malformed: true,
                target: '',
                label: undefined
            };
        }
    }

    const targetRaw = separatorIndex === -1
        ? rawLine
        : rawLine.slice(0, separatorIndex);
    const labelRaw = separatorIndex === -1
        ? ''
        : rawLine.slice(separatorIndex + 1);

    const target = unescapeActionToken(targetRaw).trim();
    const label = unescapeActionToken(labelRaw).trim();

    if (!target) {
        return {
            malformed: true,
            target: '',
            label: undefined
        };
    }

    return {
        malformed: false,
        target,
        label: label || undefined
    };
}

function parseActionFieldLines(type, rawValue) {
    if (!isActionType(type)) {
        return {
            items: [],
            malformedLineNumbers: []
        };
    }

    const sourceValue = rawValue == null ? '' : String(rawValue);
    if (!sourceValue.trim()) {
        return {
            items: [],
            malformedLineNumbers: []
        };
    }

    const items = [];
    const malformedLineNumbers = [];

    sourceValue.split(/\r?\n/).forEach((rawLine, index) => {
        const trimmedLine = String(rawLine || '').trim();
        if (!trimmedLine) {
            return;
        }

        const parsed = parseDslLine(trimmedLine);
        if (parsed.malformed || !parsed.target) {
            malformedLineNumbers.push(index + 1);
            return;
        }

        items.push({
            type,
            target: parsed.target,
            ...(parsed.label ? { label: parsed.label } : {})
        });
    });

    return {
        items,
        malformedLineNumbers
    };
}

function inspectSplitButtonAttrs(attrs) {
    const normalizedAttrs = attrs && typeof attrs === 'object' ? attrs : {};
    const items = [];
    const malformedByField = {};

    ACTION_FIELD_ORDER.forEach((fieldName) => {
        const parsed = parseActionFieldLines(fieldName, normalizedAttrs[fieldName]);
        if (parsed.items.length) {
            items.push(...parsed.items);
        }
        if (parsed.malformedLineNumbers.length) {
            malformedByField[fieldName] = parsed.malformedLineNumbers.slice();
        }
    });

    return {
        items,
        malformedByField
    };
}

function parseSplitButtonAttrs(attrs) {
    return inspectSplitButtonAttrs(attrs).items;
}

function parseButtonAction(attrs) {
    const normalizedAttrs = attrs && typeof attrs === 'object' ? attrs : {};

    for (const fieldName of BUTTON_ACTION_FIELD_PRIORITY) {
        const parsed = parseActionFieldLines(fieldName, normalizedAttrs[fieldName]);
        if (parsed.items.length) {
            return parsed.items[0];
        }
    }

    return null;
}

function getActionFallbackLabel(action) {
    if (!action || typeof action !== 'object') {
        return '';
    }

    const explicitLabel = asTrimmedString(action.label);
    if (explicitLabel) {
        return explicitLabel;
    }

    return asTrimmedString(action.target);
}

function normalizeInternalPagePath(target) {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget || typeof window === 'undefined' || !window.location) {
        return null;
    }

    if (rawTarget.startsWith('//') || rawTarget.startsWith('#')) {
        return null;
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawTarget)) {
        if (!/^https?:\/\//i.test(rawTarget)) {
            return null;
        }

        try {
            const resolvedUrl = new URL(rawTarget, window.location.origin);
            if (resolvedUrl.origin !== window.location.origin) {
                return null;
            }
            return resolvedUrl.pathname || '/';
        } catch {
            return null;
        }
    }

    if (!rawTarget.startsWith('/')) {
        return null;
    }

    try {
        return new URL(rawTarget, window.location.origin).pathname || '/';
    } catch {
        return null;
    }
}

async function getPageTitleIndex() {
    if (pageTitleCache.value instanceof Map) {
        return pageTitleCache.value;
    }

    if (pageTitleCache.promise) {
        return pageTitleCache.promise;
    }

    pageTitleCache.promise = frontendApiClient.fetchPages()
        .then((payload) => {
            const index = new Map();
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

function normalizeSourceHref(target) {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget) {
        return '';
    }

    if (/^https?:\/\//i.test(rawTarget) || rawTarget.startsWith('/')) {
        return rawTarget;
    }

    return `/${rawTarget.replace(/^\.\//, '')}`;
}

function getProbeableSourceDescriptor(target) {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget || typeof window === 'undefined' || !window.location) {
        return null;
    }

    if (rawTarget.startsWith('//')) {
        return null;
    }

    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawTarget)) {
        if (!/^https?:\/\//i.test(rawTarget)) {
            return null;
        }

        try {
            const resolvedUrl = new URL(rawTarget, window.location.origin);
            if (resolvedUrl.origin !== window.location.origin) {
                return null;
            }

            return {
                href: resolvedUrl.href,
                cacheKey: resolvedUrl.href,
                pathname: resolvedUrl.pathname || '/',
                fallbackLabel: rawTarget
            };
        } catch {
            return null;
        }
    }

    const normalizedHref = normalizeSourceHref(rawTarget);
    if (!normalizedHref.startsWith('/')) {
        return null;
    }

    try {
        const resolvedUrl = new URL(normalizedHref, window.location.origin);
        return {
            href: resolvedUrl.href,
            cacheKey: resolvedUrl.href,
            pathname: resolvedUrl.pathname || '/',
            fallbackLabel: rawTarget
        };
    } catch {
        return null;
    }
}

function getBasenameFromPath(pathname) {
    const normalizedPath = String(pathname || '').replace(/\/+$/, '');
    if (!normalizedPath) {
        return '';
    }

    const segments = normalizedPath.split('/');
    return asTrimmedString(segments[segments.length - 1]);
}

async function resolveProbeableSourceLabel(descriptor) {
    if (!descriptor || !descriptor.cacheKey) {
        return '';
    }

    if (sourceLabelCache.has(descriptor.cacheKey)) {
        return sourceLabelCache.get(descriptor.cacheKey) || '';
    }

    if (sourceLabelPromises.has(descriptor.cacheKey)) {
        return sourceLabelPromises.get(descriptor.cacheKey);
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

async function resolveActionLabel(action) {
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

function normalizeOutputAttrs(outputAttrs) {
    const values = Array.isArray(outputAttrs)
        ? outputAttrs
        : outputAttrs == null
          ? []
          : [outputAttrs];

    return values
        .map((item) => asTrimmedString(item))
        .filter(Boolean);
}

async function runAction(context, action, options = {}) {
    if (!action || typeof action !== 'object') {
        return null;
    }

    if (action.type === 'source') {
        const href = normalizeSourceHref(action.target);
        if (href) {
            window.open(href, '_blank', 'noopener,noreferrer');
        }
        return null;
    }

    if (action.type === 'url') {
        window.open(action.target, '_blank', 'noopener,noreferrer');
        return null;
    }

    const command = asTrimmedString(action.target);
    if (!command) {
        return null;
    }

    if (command === 'CLOSE_MODAL') {
        if (typeof context.closeUiModal === 'function') {
            context.closeUiModal();
        }
        return null;
    }

    if (command.includes(' -ui')) {
        const modalName = command.replace(' -ui', '').trim();
        if (typeof context.openUiModal === 'function') {
            await Promise.resolve(context.openUiModal(modalName)).catch(() => {});
        }
        return null;
    }

    if (typeof context.$emit === 'function') {
        context.$emit('execute', {
            command,
            outputAttrs: normalizeOutputAttrs(options.outputAttrs),
            widget: asTrimmedString(options.widgetName)
        });
    }

    return null;
}

function openConfirmDialog(context, action, options = {}) {
    const getModal = context && typeof context.getConfirmModal === 'function'
        ? context.getConfirmModal
        : null;
    if (!getModal) {
        return null;
    }

    const modal = getModal();
    if (!modal || typeof modal.open !== 'function') {
        return null;
    }

    const dialogConfig = options.dialog && typeof options.dialog === 'object'
        ? options.dialog
        : {};

    modal._acceptHandler = () => {
        Promise.resolve(runAction(context, action, options)).catch(() => {});
    };

    modal.open({
        title: dialogConfig.title || 'Подтверждение',
        text: dialogConfig.text || 'Вы уверены?',
        accept: dialogConfig.accept || 'Подтвердить',
        cancel: dialogConfig.cancel || 'Отмена'
    });

    return null;
}

function executeAction(context, action, options = {}) {
    if (!action || typeof action !== 'object') {
        return Promise.resolve(null);
    }

    if (
        options.dialog
        && (action.type === 'url' || action.type === 'command')
    ) {
        return Promise.resolve(openConfirmDialog(context, action, options));
    }

    return Promise.resolve(runAction(context, action, options));
}

export {
    ACTION_FIELD_ORDER,
    ACTION_ITEM_TYPES,
    BUTTON_ACTION_FIELD_PRIORITY,
    executeAction,
    getActionFallbackLabel,
    inspectSplitButtonAttrs,
    normalizeSourceHref,
    parseActionFieldLines,
    parseButtonAction,
    parseSplitButtonAttrs,
    resolveActionLabel
};
