import { onBeforeUnmount, shallowRef, type Ref } from 'vue';
import type { DateTimePopoverStyle } from './types.ts';

type FloatingAlign = 'start' | 'end';
type ElementGetter = () => Array<HTMLElement | null | undefined>;

function useFloatingPopover(getInsideElements: ElementGetter, onOutside: () => void) {
  const style = shallowRef<DateTimePopoverStyle>({ visibility: 'hidden' });
  let floatingUpdate: (() => void) | null = null;
  let outsideClick: ((event: MouseEvent) => void) | null = null;

  function setHidden(): void {
    style.value = { visibility: 'hidden' };
  }

  function update(anchor: HTMLElement | null | undefined, popover: HTMLElement | null | undefined, align: FloatingAlign): void {
    if (!anchor || !popover) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const margin = 8;

    let left = align === 'end'
      ? anchorRect.right - popoverRect.width
      : anchorRect.left;
    let top = anchorRect.bottom + margin;

    const maxLeft = Math.max(margin, window.innerWidth - popoverRect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - popoverRect.height - margin);

    left = Math.min(Math.max(margin, left), maxLeft);
    if (top > maxTop) {
      top = Math.max(margin, anchorRect.top - popoverRect.height - margin);
    }

    style.value = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`
    };
  }

  function bind(updatePosition: () => void): void {
    unbind();

    floatingUpdate = () => updatePosition();
    outsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const inside = getInsideElements().some((element) =>
        Boolean(element && element.contains(target))
      );
      if (!inside) {
        onOutside();
      }
    };

    window.addEventListener('resize', floatingUpdate);
    window.addEventListener('scroll', floatingUpdate, true);
    document.addEventListener('click', outsideClick);
  }

  function unbind(): void {
    if (floatingUpdate) {
      window.removeEventListener('resize', floatingUpdate);
      window.removeEventListener('scroll', floatingUpdate, true);
      floatingUpdate = null;
    }

    if (outsideClick) {
      document.removeEventListener('click', outsideClick);
      outsideClick = null;
    }
  }

  function elementFromExpose<T extends { getRoot?: () => HTMLElement | null; root?: HTMLElement | null }>(
    exposedRef: Ref<T | null>
  ): HTMLElement | null {
    if (typeof exposedRef.value?.getRoot === 'function') {
      return exposedRef.value.getRoot();
    }
    return exposedRef.value?.root ?? null;
  }

  onBeforeUnmount(unbind);

  return {
    bind,
    elementFromExpose,
    setHidden,
    style,
    unbind,
    update
  };
}

export default useFloatingPopover;
