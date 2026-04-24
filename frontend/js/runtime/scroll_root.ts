type ScrollRoot = {
  scrollTop?: number;
  scrollTo?: (options: { top: number; left: number; behavior: 'auto' }) => void;
};

function restoreScrollRootTop(scrollRoot: ScrollRoot, top: number): void {
  if (typeof scrollRoot.scrollTo === 'function') {
    scrollRoot.scrollTo({ top, left: 0, behavior: 'auto' });
  } else {
    scrollRoot.scrollTop = top;
  }
}

export { restoreScrollRootTop };
export type { ScrollRoot };
