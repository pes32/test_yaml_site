/** Конфигурация диалога ConfirmModal.vue (текст, подписи кнопок, колбэки). */
export type ConfirmModalConfig = {
  accept?: string;
  cancel?: string;
  text?: string;
  title?: string;
  onAccept?: () => void | Promise<void>;
  onCancel?: () => void;
};

/** Поверхность экземпляра ConfirmModal (ref / props в родительских приложениях). */
export type ConfirmModalSurface = {
  open(config?: ConfirmModalConfig | null): void;
  close(): void;
};
