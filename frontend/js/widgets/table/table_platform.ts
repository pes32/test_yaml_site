function isApplePlatform(): boolean {
    return (
        typeof navigator !== 'undefined' &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '')
    );
}

export { isApplePlatform };
