export interface TableRuntimeApi {
  resolveDependencies(tableAttrConfig: Record<string, unknown>): string[];
  getListOptions(attrsByName: Record<string, unknown>, sourceName: string): unknown[];
}
