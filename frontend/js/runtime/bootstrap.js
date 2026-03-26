const DEFAULT_PAGE_BOOTSTRAP_ID = 'page-data';

function parseJsonScript(scriptId) {
    if (typeof document === 'undefined') {
        return null;
    }

    const element = document.getElementById(scriptId);
    if (!element) {
        return null;
    }

    const raw = typeof element.textContent === 'string' ? element.textContent.trim() : '';
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Не удалось разобрать bootstrap JSON (${scriptId})`, { cause: error });
    }
}

function readPageBootstrap(scriptId = DEFAULT_PAGE_BOOTSTRAP_ID) {
    return parseJsonScript(scriptId);
}

export {
    DEFAULT_PAGE_BOOTSTRAP_ID,
    parseJsonScript,
    readPageBootstrap
};

export default readPageBootstrap;
