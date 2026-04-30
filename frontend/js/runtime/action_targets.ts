import { asTrimmedString } from '../shared/string_value.ts';
import type { ActionItem, ProbeableSourceDescriptor } from './action_types.ts';

type SameOriginTargetOptions = {
    allowHash?: boolean;
    normalizeRelative?: boolean;
};

type SameOriginTarget = {
    href: string;
    pathname: string;
    rawTarget: string;
};

function getActionFallbackLabel(action: ActionItem | null | undefined): string {
    if (!action || typeof action !== 'object') {
        return '';
    }

    const explicitLabel = asTrimmedString(action.label);
    if (explicitLabel) {
        return explicitLabel;
    }

    return asTrimmedString(action.target);
}

function normalizeInternalPagePath(target: unknown): string | null {
    return resolveSameOriginTarget(target)?.pathname || null;
}

function normalizeSourceHref(target: unknown): string {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget) {
        return '';
    }

    if (/^https?:\/\//i.test(rawTarget) || rawTarget.startsWith('/')) {
        return rawTarget;
    }

    return `/${rawTarget.replace(/^\.\//, '')}`;
}

function getProbeableSourceDescriptor(target: unknown): ProbeableSourceDescriptor | null {
    const resolvedUrl = resolveSameOriginTarget(target, { normalizeRelative: true });
    return resolvedUrl
        ? {
              href: resolvedUrl.href,
              cacheKey: resolvedUrl.href,
              pathname: resolvedUrl.pathname,
              fallbackLabel: resolvedUrl.rawTarget
          }
        : null;
}

function resolveSameOriginTarget(
    target: unknown,
    options: SameOriginTargetOptions = {}
): SameOriginTarget | null {
    const rawTarget = asTrimmedString(target);
    if (!rawTarget || typeof window === 'undefined' || !window.location) {
        return null;
    }

    if (rawTarget.startsWith('//') || (!options.allowHash && rawTarget.startsWith('#'))) {
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
                pathname: resolvedUrl.pathname || '/',
                rawTarget
            };
        } catch {
            return null;
        }
    }

    const normalizedHref = options.normalizeRelative ? normalizeSourceHref(rawTarget) : rawTarget;
    if (!normalizedHref.startsWith('/')) {
        return null;
    }

    try {
        const resolvedUrl = new URL(normalizedHref, window.location.origin);
        return {
            href: resolvedUrl.href,
            pathname: resolvedUrl.pathname || '/',
            rawTarget
        };
    } catch {
        return null;
    }
}

function normalizeOutputAttrs(outputAttrs: unknown): string[] {
    const values = Array.isArray(outputAttrs)
        ? outputAttrs
        : outputAttrs == null
          ? []
          : [outputAttrs];

    return values
        .map((item) => asTrimmedString(item))
        .filter(Boolean);
}

function shouldUrlOpenInNewTab(target: unknown): boolean {
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
