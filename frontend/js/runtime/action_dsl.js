import { asTrimmedString } from './action_shared.js';

const ACTION_ITEM_TYPES = Object.freeze(['url', 'source', 'command']);
const ACTION_FIELD_ORDER = Object.freeze(['url', 'source', 'command']);
const BUTTON_ACTION_FIELD_PRIORITY = Object.freeze(['source', 'url', 'command']);

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
        const trimmedLine = asTrimmedString(rawLine);
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

export {
    ACTION_FIELD_ORDER,
    ACTION_ITEM_TYPES,
    BUTTON_ACTION_FIELD_PRIORITY,
    inspectSplitButtonAttrs,
    parseActionFieldLines,
    parseButtonAction,
    parseDslLine,
    parseSplitButtonAttrs
};
