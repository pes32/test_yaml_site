import { expect, type APIRequestContext } from '@playwright/test';

export type ApiPayload<T> = {
  ok: boolean;
  data: T;
  diagnostics?: unknown[];
  error?: { code: string; message: string };
};

export type PageConfigPayload = {
  page: {
    name: string;
    url: string;
    title: string;
    gui: Record<string, unknown>;
    guiMenuKeys: string[];
    modalGuiIds: string[];
  };
  attrs: Record<string, Record<string, unknown>>;
};

export async function getApiData<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path);
  expect(response.ok(), `${path} status`).toBeTruthy();
  const payload = (await response.json()) as ApiPayload<T>;
  expect(payload.ok, `${path} ok`).toBe(true);
  return payload.data;
}

export async function getDemoPageConfig(request: APIRequestContext): Promise<PageConfigPayload> {
  return getApiData<PageConfigPayload>(request, '/api/page/2_widget_demo');
}
