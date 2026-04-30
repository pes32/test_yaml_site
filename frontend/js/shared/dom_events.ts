function blurEventTarget(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLElement) {
    target.blur();
  }
}

export { blurEventTarget };
