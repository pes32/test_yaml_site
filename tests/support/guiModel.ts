export type RawPage = {
  gui: Record<string, unknown>;
  guiMenuKeys: string[];
};

export type GuiTabModel = {
  name: string;
  widgets: string[];
};

export type GuiMenuModel = {
  name: string;
  widgets: string[];
  tabs: GuiTabModel[];
};

function namedBlockName(key: string, kind: string): string | null {
  const match = key.match(new RegExp(`^${kind}\\s+"([^"]+)"$`));
  return match ? match[1] : null;
}

function splitWidgetRow(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function collectWidgets(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectWidgets(item));
  }

  if (!node || typeof node !== 'object') {
    return [];
  }

  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => {
    if (key === 'row') {
      return splitWidgetRow(value);
    }
    return collectWidgets(value);
  });
}

export function extractMenuName(menuKey: string): string {
  return namedBlockName(menuKey, 'menu') || menuKey;
}

export function extractMenus(page: RawPage): GuiMenuModel[] {
  return page.guiMenuKeys.map((menuKey) => {
    const menuItems = Array.isArray(page.gui[menuKey]) ? (page.gui[menuKey] as unknown[]) : [];
    const tabs = menuItems.flatMap((item): GuiTabModel[] => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return [];
      }

      return Object.entries(item as Record<string, unknown>).flatMap(([key, value]) => {
        const tabName = namedBlockName(key, 'tab');
        if (!tabName) {
          return [];
        }
        return [{ name: tabName, widgets: collectWidgets(value) }];
      });
    });

    return {
      name: extractMenuName(menuKey),
      widgets: tabs.length ? [] : collectWidgets(menuItems),
      tabs
    };
  });
}

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}
