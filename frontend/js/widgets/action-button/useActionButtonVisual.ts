import { computed, type CSSProperties } from 'vue';
import { isFontIcon } from '../../shared/icon_helpers.ts';
import { asTrimmedString } from '../../shared/string_value.ts';
import type { ActionButtonVisualOptions, ActionWidgetProps } from './types.ts';

function resolveWidthValue(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  return typeof value === 'number' ? `${value}px` : String(value);
}

function iconOnlyLooseStyle(sizeValue: unknown): CSSProperties {
  const iconRef = 24;
  const outerRef = 40;
  const borderTotal = 2;
  const padRef = (outerRef - borderTotal - iconRef) / 2;
  const iconSize = Number(sizeValue) || iconRef;
  const pad = Math.max(0, Math.round((padRef * iconSize) / iconRef));
  const widthValue = iconSize + borderTotal + 2 * pad;

  return {
    width: `${widthValue}px`,
    minWidth: `${widthValue}px`,
    padding: `${pad}px`
  };
}

function iconOnlySquareStyle(sizeValue: unknown, widthRaw: unknown): CSSProperties {
  const iconRef = 24;
  const outerRef = 40;
  const borderTotal = 2;
  const padRef = (outerRef - borderTotal - iconRef) / 2;
  const iconSize = Number(sizeValue) || iconRef;
  const hasExplicitWidth = widthRaw != null && widthRaw !== '';
  let widthValue: number;
  let pad: number;

  if (hasExplicitWidth) {
    const nextWidth = Number(widthRaw);
    widthValue = Number.isFinite(nextWidth) && nextWidth > 0 ? nextWidth : outerRef;
    pad = Math.max(0, Math.floor((widthValue - borderTotal - iconSize) / 2));
  } else {
    pad = Math.max(0, Math.round((padRef * iconSize) / iconRef));
    widthValue = iconSize + borderTotal + 2 * pad;
  }

  return {
    width: `${widthValue}px`,
    minWidth: `${widthValue}px`,
    height: `${widthValue}px`,
    minHeight: `${widthValue}px`,
    padding: `${pad}px`
  };
}

function useActionButtonVisual(
  props: Readonly<ActionWidgetProps>,
  options: ActionButtonVisualOptions
) {
  const iconName = computed(() => asTrimmedString(props.widgetConfig.icon));
  const buttonLabel = computed(() => asTrimmedString(props.widgetConfig.label));
  const buttonHint = computed(() => asTrimmedString(props.widgetConfig.hint));
  const supportingText = computed(() => asTrimmedString(props.widgetConfig.sup_text));
  const isIconOnly = computed(() => Boolean(iconName.value && !buttonLabel.value));
  const hasBackground = computed(() => Boolean(props.widgetConfig.fon));
  const widthValue = computed(() => resolveWidthValue(props.widgetConfig.width));

  const buttonClasses = computed(() => ({
    'icon-only': isIconOnly.value,
    'icon-only--ghost': isIconOnly.value && !hasBackground.value
  }));

  const buttonTitle = computed(() => {
    if (isIconOnly.value && buttonHint.value) return buttonHint.value;
    if (buttonLabel.value) return buttonLabel.value;
    return options.fallbackTitle;
  });

  const iconStyle = computed<CSSProperties>(() => {
    if (!iconName.value || isFontIcon(iconName.value)) {
      return {};
    }

    const size = Number(props.widgetConfig.size) || 24;
    return {
      width: `${size}px`,
      height: `${size}px`
    };
  });

  const standaloneButtonStyle = computed<CSSProperties>(() => {
    const width = props.widgetConfig.width || props.widgetConfig.size;

    if (isIconOnly.value) {
      return iconOnlySquareStyle(props.widgetConfig.size, props.widgetConfig.width);
    }

    if (width != null && width !== '') {
      return {
        width: resolveWidthValue(width),
        justifyContent: 'flex-start',
        textAlign: 'left'
      };
    }

    return {};
  });

  const splitControlStyle = computed<CSSProperties>(() =>
    widthValue.value ? { width: widthValue.value } : {}
  );

  const splitPrimaryStyle = computed<CSSProperties>(() => {
    if (widthValue.value) {
      return {
        justifyContent: buttonLabel.value ? 'flex-start' : 'center',
        textAlign: 'left'
      };
    }

    if (isIconOnly.value) {
      return iconOnlyLooseStyle(props.widgetConfig.size);
    }

    return {
      justifyContent: buttonLabel.value ? 'flex-start' : 'center',
      textAlign: 'left'
    };
  });

  return {
    buttonClasses,
    buttonHint,
    buttonLabel,
    buttonTitle,
    hasBackground,
    iconName,
    iconStyle,
    isIconOnly,
    splitControlStyle,
    splitPrimaryStyle,
    standaloneButtonStyle,
    supportingText,
    widthValue
  };
}

export default useActionButtonVisual;
