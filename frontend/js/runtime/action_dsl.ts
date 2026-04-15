import { asTrimmedString } from './action_shared.ts';
import type {
    ActionItem,
    ActionItemType,
    ActionMalformedFields,
    ActionWidgetConfig,
    SplitButtonActionInspection
} from './action_types.ts';

const ACTION_ITEM_TYPES = Object.freeze(['url', 'source', 'command'] as const);
const ACTION_FIELD_ORDER = Object.freeze(['url', 'source', 'command'] as const);
const BUTTON_ACTION_FIELD_PRIORITY = Object.freeze(['source', 'url', 'command'] as const);

type DslParseResult = {
    label?: string;
    malformed: boolean;
    target: string;
};

type ParsedActionFieldLines = {
    items: ActionItem[];
    malformedLineNumbers: number[];
};

function isActionType(value: unknown): value is ActionItemType {
    return ACTION_ITEM_TYPES.includes(value as ActionItemType);
}

function unescapeActionToken(value: unknown): string {
    return String(value || '').replace(/\\\|/g, '|');
}

function parseDslLine(line: unknown): DslParseResult {
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

function parseActionFieldLines(type: unknown, rawValue: unknown): ParsedActionFieldLines {
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

    const items: ActionItem[] = [];
    const malformedLineNumbers: number[] = [];

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

function normalizeActionItem(item: unknown): ActionItem | null {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const rawItem = item as Record<string, unknown>;
    if (!isActionType(rawItem.type)) {
        return null;
    }

    const target = asTrimmedString(rawItem.target);
    if (!target) {
        return null;
    }

    const label = asTrimmedString(rawItem.label);
    return {
        type: rawItem.type,
        target,
        ...(label ? { label } : {})
    };
}

function inspectSplitButtonAttrs(attrs: unknown): SplitButtonActionInspection {
    const normalizedAttrs = attrs && typeof attrs === 'object'
        ? attrs as Record<string, unknown>
        : {};
    const items: ActionItem[] = [];
    const malformedByField: ActionMalformedFields = {};

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

const inspectSplitButtonActions = inspectSplitButtonAttrs;

function parseSplitButtonAttrs(attrs: unknown): ActionItem[] {
    return inspectSplitButtonAttrs(attrs).items;
}

function parseButtonAction(attrs: ActionWidgetConfig | unknown): ActionItem | null {
    const normalizedAttrs = attrs && typeof attrs === 'object'
        ? attrs as Record<string, unknown>
        : {};

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
    inspectSplitButtonActions,
    inspectSplitButtonAttrs,
    normalizeActionItem,
    parseActionFieldLines,
    parseButtonAction,
    parseDslLine,
    parseSplitButtonAttrs
};
