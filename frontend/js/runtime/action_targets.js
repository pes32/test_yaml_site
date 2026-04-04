import { asTrimmedString } from './action_shared.js';

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

function shouldUrlOpenInNewTab(target) {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget) {
        return false;
    }

    if (typeof window === 'undefined' || !window.location) {
        return /^https?:\/\//i.test(rawTarget) || rawTarget.startsWith('//');
    }

    try {
        const resolvedUrl = rawTarget.startsWith('//')
            ? new URL(`${window.location.protocol}${rawTarget}`)
            : new URL(rawTarget, window.location.href);

        return /^https?:$/i.test(resolvedUrl.protocol) && resolvedUrl.origin !== window.location.origin;
    } catch {
        return false;
    }
}

export {
    getActionFallbackLabel,
    getProbeableSourceDescriptor,
    normalizeInternalPagePath,
    normalizeOutputAttrs,
    normalizeSourceHref,
    shouldUrlOpenInNewTab
};
