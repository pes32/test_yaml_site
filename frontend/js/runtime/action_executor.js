import { asTrimmedString } from './action_shared.js';
import {
    normalizeOutputAttrs,
    normalizeSourceHref,
    shouldUrlOpenInNewTab
} from './action_targets.js';

function openUrlInCurrentTab(target) {
    const href = asTrimmedString(target);
    if (!href || typeof window === 'undefined' || !window.location) {
        return;
    }

    if (typeof window.location.assign === 'function') {
        window.location.assign(href);
        return;
    }

    window.location.href = href;
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
        if (shouldUrlOpenInNewTab(action.target)) {
            window.open(action.target, '_blank', 'noopener,noreferrer');
        } else {
            openUrlInCurrentTab(action.target);
        }
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
    executeAction,
    openConfirmDialog,
    runAction
};
