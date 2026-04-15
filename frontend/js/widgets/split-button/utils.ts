import type {
  SplitButtonActionDescriptor,
  SplitButtonActionItem
} from './types.ts';
import { normalizeActionItem } from '../../runtime/action_runtime.ts';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

const MAX_VISIBLE_ACTION_ROWS = 10;

function parsePixelValue(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : safeMin;
  const upperBound = safeMax < safeMin ? safeMin : safeMax;
  return Math.min(Math.max(value, safeMin), upperBound);
}

function toTrimmedString(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function buildActionDescriptors(items: readonly unknown[]): SplitButtonActionDescriptor[] {
  const seen = new Map<string, number>();
  return items
    .map((item) => normalizeActionItem(item))
    .filter((item): item is SplitButtonActionItem => Boolean(item))
    .map((item) => {
      const baseKey = [item.type, item.target, item.label || ''].join('\u0000');
      const occurrence = seen.get(baseKey) || 0;
      seen.set(baseKey, occurrence + 1);
      return {
        key: `${baseKey}\u0000${occurrence}`,
        item
      };
    });
}

function getViewportPadding(): number {
  if (typeof window === 'undefined') {
    return 8;
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  return parsePixelValue(rootStyles.getPropertyValue('--space-sm')) || 8;
}

function getFocusableItems(): HTMLElement[] {
  if (typeof document === 'undefined') {
    return [];
  }

  return Array.from(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      if (element.hasAttribute('disabled')) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      return element.offsetParent !== null || document.activeElement === element;
    }
  );
}

export {
  FOCUSABLE_SELECTOR,
  MAX_VISIBLE_ACTION_ROWS,
  buildActionDescriptors,
  clamp,
  getFocusableItems,
  getViewportPadding,
  parsePixelValue,
  toTrimmedString
};
