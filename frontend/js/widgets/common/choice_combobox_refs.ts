import type { DropdownRuntimeRefs } from '../dropdown/dropdown_runtime.ts';

type ChoiceComboboxSurface = {
  dropdownMenu: HTMLElement | null;
  dropdownRoot: HTMLElement | null;
  dropdownToggle: HTMLElement | null;
};

function resolveChoiceComboboxRefs(
  surface: ChoiceComboboxSurface | null | undefined,
  modalRoot: HTMLElement | null = null
): DropdownRuntimeRefs {
  return {
    dropdownMenu: surface?.dropdownMenu || null,
    dropdownRoot: surface?.dropdownRoot || null,
    dropdownToggle: surface?.dropdownToggle || null,
    modalRoot
  };
}

export type {
  ChoiceComboboxSurface
};

export {
  resolveChoiceComboboxRefs
};
