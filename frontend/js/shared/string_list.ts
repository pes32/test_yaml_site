function uniqueNames(items: unknown): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    (Array.isArray(items) ? items : []).forEach((item) => {
        const value = String(item || '').trim();
        if (!value || seen.has(value)) {
            return;
        }
        seen.add(value);
        result.push(value);
    });

    return result;
}

export { uniqueNames };
