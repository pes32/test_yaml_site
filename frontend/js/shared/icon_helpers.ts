function isFontIcon(icon: unknown): boolean {
    return Boolean(icon) && String(icon).trim().startsWith('fas');
}

function getIconSrc(icon: unknown): string | null {
    const iconName = String(icon || '').trim();
    if (!iconName || isFontIcon(iconName)) {
        return null;
    }

    return `/templates/icons/${iconName}`;
}

function onIconError(event: Event): void {
    const img = event.target;
    if (!(img instanceof HTMLElement)) {
        return;
    }

    img.style.display = 'none';
    if (img.parentElement) {
        img.parentElement.style.display = 'none';
    }
}

export {
    getIconSrc,
    isFontIcon,
    onIconError
};
