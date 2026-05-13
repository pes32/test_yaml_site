import type { TableFormatRule } from './table_contract.ts';

/** Rows spanned above this go to `wideRules` (checked per cell, list stays small). */
export const REMOTE_RULE_ROW_BUCKET_MAX_SPAN = 4096;

export type RemoteFormatRuleBuckets = {
    bySourceIndex: Map<number, TableFormatRule[]>;
    wideRules: TableFormatRule[];
};

export function buildRemoteFormatRuleBuckets(
    rowRangeRules: readonly TableFormatRule[] | undefined,
    cellRangeRules: readonly TableFormatRule[] | undefined
): RemoteFormatRuleBuckets {
    const bySourceIndex = new Map<number, TableFormatRule[]>();
    const wideRules: TableFormatRule[] = [];

    const append = (rule: TableFormatRule, r0: number, r1: number) => {
        const span = r1 - r0 + 1;
        if (!Number.isFinite(span) || span < 1) return;
        if (span > REMOTE_RULE_ROW_BUCKET_MAX_SPAN) {
            wideRules.push(rule);
            return;
        }
        for (let r = r0; r <= r1; r += 1) {
            const list = bySourceIndex.get(r);
            if (list) list.push(rule);
            else bySourceIndex.set(r, [rule]);
        }
    };

    for (const rule of rowRangeRules || []) {
        if (rule.target.kind !== 'row-range') continue;
        append(rule, rule.target.r0, rule.target.r1);
    }
    for (const rule of cellRangeRules || []) {
        if (rule.target.kind !== 'cell-range') continue;
        append(rule, rule.target.r0, rule.target.r1);
    }
    return { bySourceIndex, wideRules };
}

export function applyRemoteRangeRulesForCell(
    buckets: RemoteFormatRuleBuckets,
    sourceIndex: number,
    colIndex: number,
    applyRule: (rule: TableFormatRule) => void
): void {
    const rowRules = buckets.bySourceIndex.get(sourceIndex);
    if (rowRules) {
        for (const rule of rowRules) {
            if (rule.target.kind === 'row-range') {
                applyRule(rule);
            } else if (rule.target.kind === 'cell-range') {
                const t = rule.target;
                if (colIndex >= t.c0 && colIndex <= t.c1) applyRule(rule);
            }
        }
    }
    for (const rule of buckets.wideRules) {
        if (rule.target.kind === 'row-range') {
            const t = rule.target;
            if (sourceIndex >= t.r0 && sourceIndex <= t.r1) applyRule(rule);
        } else if (rule.target.kind === 'cell-range') {
            const t = rule.target;
            if (
                sourceIndex >= t.r0 &&
                sourceIndex <= t.r1 &&
                colIndex >= t.c0 &&
                colIndex <= t.c1
            ) {
                applyRule(rule);
            }
        }
    }
}

const bucketCache = new Map<string, RemoteFormatRuleBuckets>();

export function remoteFormatRuleIndexSignature(remote: {
    cellRangeRules?: readonly TableFormatRule[];
    rowRangeRules?: readonly TableFormatRule[];
}): string {
    const rows = remote.rowRangeRules || [];
    const cells = remote.cellRangeRules || [];
    return `${rows.length}:${cells.length}:${rows.map((r) => r.id).join(',')}|${cells.map((r) => r.id).join(',')}`;
}

export function getCachedRemoteFormatRuleBuckets(remote: {
    cellRangeRules?: readonly TableFormatRule[];
    rowRangeRules?: readonly TableFormatRule[];
}): RemoteFormatRuleBuckets {
    const signature = remoteFormatRuleIndexSignature(remote);
    let buckets = bucketCache.get(signature);
    if (!buckets) {
        buckets = buildRemoteFormatRuleBuckets(remote.rowRangeRules, remote.cellRangeRules);
        if (bucketCache.size > 64) {
            bucketCache.clear();
        }
        bucketCache.set(signature, buckets);
    }
    return buckets;
}
