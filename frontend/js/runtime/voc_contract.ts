import { normalizeScalarStringValue } from './widget_contract.ts';

export type VocRow = {
  id: string;
  rowIndex: number;
  cells: string[];
  value: string;
  searchText: string;
};

export type ParsedVocDraft = {
  normalizedText: string;
  trailingSeparator: boolean;
  completedTokens: string[];
  activeToken: string;
  allTokens: string[];
};

export type SingleVocDraftCommit = {
  emit: boolean;
  emittedValue: string;
  kind: string;
  nextInputValue: string;
  nextValue: string;
  valueType: string;
};

export type ResolvedVocManualTokens = {
  invalidToken: string;
  resolvedValues: string[];
};

export function normalizeVocColumns(columns: unknown): string[] {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

export function canParseVocStringSource(source: unknown): boolean {
  const text = String(source ?? '');
  return text.includes('\n') || text.includes(';');
}

function normalizeVocSourceRow(item: unknown): string[] {
  if (Array.isArray(item)) {
    return item.map((cell) => normalizeScalarStringValue(cell).trim());
  }
  return [normalizeScalarStringValue(item).trim()];
}

function normalizeVocSourceRows(source: unknown): string[][] {
  if (Array.isArray(source)) {
    return source.map((item) => normalizeVocSourceRow(item));
  }

  if (typeof source === 'string' && canParseVocStringSource(source)) {
    return String(source)
      .split('\n')
      .map((line) => String(line || '').trim())
      .filter(Boolean)
      .map((line) => line.split(';').map((cell) => String(cell || '').trim()));
  }

  return [];
}

export function normalizeVocRows(columns: unknown, source: unknown): VocRow[] {
  const normalizedColumns = normalizeVocColumns(columns);
  const columnCount = normalizedColumns.length;
  if (!columnCount) {
    return [];
  }

  return normalizeVocSourceRows(source)
    .map((cells, index) => {
      const normalizedCells = Array.isArray(cells)
        ? cells.map((cell) => String(cell ?? '').trim())
        : [];
      if (normalizedCells.length !== columnCount) {
        return null;
      }

      return {
        id: `voc-row-${index}`,
        rowIndex: index,
        cells: normalizedCells,
        value: normalizedCells[0] || '',
        searchText: normalizedCells.join('\n').toLocaleLowerCase()
      };
    })
    .filter((row): row is VocRow => Boolean(row));
}

export function normalizeVocQuery(query: unknown): string {
  return String(query ?? '').trim().toLocaleLowerCase();
}

export function filterVocRows(rows: unknown, query: unknown): VocRow[] {
  const normalizedQuery = normalizeVocQuery(query);
  const list = Array.isArray(rows) ? rows as VocRow[] : [];
  if (!normalizedQuery) {
    return list;
  }

  return list.filter((row) =>
    String(row && row.searchText ? row.searchText : '').includes(normalizedQuery)
  );
}

export function formatVocRowLabel(row: VocRow | null | undefined): string {
  const cells = row && Array.isArray(row.cells) ? row.cells : [];
  return cells.filter(Boolean).join(' | ');
}

export function findFirstVocRowByValue(rows: unknown, value: unknown): VocRow | null {
  const normalizedValue = String(value ?? '');
  if (!normalizedValue) {
    return null;
  }
  return (Array.isArray(rows) ? rows as VocRow[] : []).find((row) => row && row.value === normalizedValue) || null;
}

export function describeVocValueType(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

export function resolveSingleVocDraftCommit(
  rows: unknown,
  inputValue: unknown,
  committedValue: unknown,
  options: { draftDirty?: boolean } = {}
): SingleVocDraftCommit {
  const nextCommittedValue = committedValue == null ? '' : String(committedValue);
  const draftDirty = options.draftDirty === true;

  if (!draftDirty) {
    return {
      kind: 'sync-committed',
      nextValue: nextCommittedValue,
      nextInputValue: nextCommittedValue,
      emit: false,
      emittedValue: nextCommittedValue,
      valueType: describeVocValueType(nextCommittedValue)
    };
  }

  const nextDraftValue = String(inputValue ?? '').trim();
  if (!nextDraftValue) {
    return {
      kind: 'clear',
      nextValue: '',
      nextInputValue: '',
      emit: nextCommittedValue !== '',
      emittedValue: '',
      valueType: 'string'
    };
  }

  const matchedRow = findFirstVocRowByValue(rows, nextDraftValue);
  if (!matchedRow) {
    return {
      kind: 'revert-invalid',
      nextValue: nextCommittedValue,
      nextInputValue: nextCommittedValue,
      emit: false,
      emittedValue: nextCommittedValue,
      valueType: describeVocValueType(nextCommittedValue)
    };
  }

  const resolvedValue = String(matchedRow.value ?? '');
  return {
    kind: resolvedValue === nextCommittedValue ? 'noop-committed' : 'commit',
    nextValue: resolvedValue,
    nextInputValue: resolvedValue,
    emit: resolvedValue !== nextCommittedValue,
    emittedValue: resolvedValue,
    valueType: describeVocValueType(resolvedValue)
  };
}

export function restoreVocRowIdsByValues(rows: unknown, values: unknown): Set<string> {
  const list = Array.isArray(rows) ? rows as VocRow[] : [];
  const targetValues = Array.isArray(values)
    ? values.map((item) => String(item ?? ''))
    : [];
  const counts = new Map<string, number>();
  targetValues.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const selectedIds = new Set<string>();
  if (!counts.size) {
    return selectedIds;
  }

  list.forEach((row) => {
    const value = row && typeof row.value === 'string' ? row.value : '';
    const remaining = counts.get(value) || 0;
    if (!row || !value || remaining < 1) {
      return;
    }
    selectedIds.add(row.id);
    counts.set(value, remaining - 1);
  });

  return selectedIds;
}

export function serializeVocValues(values: unknown): string {
  return (Array.isArray(values) ? values : [])
    .map((item) => String(item ?? '').trim())
    .filter((item) => item !== '')
    .join(', ');
}

export function normalizeVocDraftSeparators(text: unknown): string {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\n]+/g, ',');
}

export function parseVocDraft(text: unknown): ParsedVocDraft {
  const normalizedText = normalizeVocDraftSeparators(text);
  const trailingSeparator = /,\s*$/.test(normalizedText);
  const parts = normalizedText.split(',');
  const tokens = parts.map((part) => String(part ?? '').trim());
  const completedTokens = trailingSeparator ? tokens : tokens.slice(0, -1);
  const activeToken = trailingSeparator ? '' : (tokens[tokens.length - 1] || '');

  return {
    normalizedText,
    trailingSeparator,
    completedTokens: completedTokens.filter((token) => token !== ''),
    activeToken,
    allTokens: tokens.filter((token) => token !== '')
  };
}

export function replaceVocDraftActiveToken(text: unknown, nextToken: unknown): string {
  const draft = parseVocDraft(text);
  const baseTokens = draft.completedTokens.slice();
  if (nextToken != null && String(nextToken).trim() !== '') {
    baseTokens.push(String(nextToken).trim());
  }
  return baseTokens.length ? `${baseTokens.join(', ')}, ` : '';
}

export function resolveVocManualTokens(rows: unknown, tokens: unknown): ResolvedVocManualTokens {
  const list = Array.isArray(rows) ? rows as VocRow[] : [];
  const resolvedValues: string[] = [];
  let invalidToken = '';

  for (let index = 0; index < (Array.isArray(tokens) ? tokens : []).length; index += 1) {
    const token = String((Array.isArray(tokens) ? tokens[index] : undefined) ?? '').trim();
    if (!token) {
      continue;
    }
    if (!findFirstVocRowByValue(list, token)) {
      invalidToken = token;
      break;
    }
    resolvedValues.push(token);
  }

  return {
    resolvedValues,
    invalidToken
  };
}

export function rowsToSourceOrderValues(rows: unknown, selectedIds: unknown): string[] {
  const ids = selectedIds instanceof Set ? selectedIds : new Set<string>();
  return (Array.isArray(rows) ? rows as VocRow[] : [])
    .filter((row) => row && ids.has(row.id))
    .map((row) => row.value);
}
