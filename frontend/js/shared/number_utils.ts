export function clampNumber(value: number, minValue: number, maxValue: number): number {
    const safeMin = Number.isFinite(minValue) ? minValue : 0;
    const safeMax = Number.isFinite(maxValue) ? maxValue : safeMin;
    const upperBound = safeMax < safeMin ? safeMin : safeMax;
    return Math.min(Math.max(value, safeMin), upperBound);
}

export function parsePixelValue(value: unknown): number {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

export default {
    clampNumber,
    parsePixelValue
};
