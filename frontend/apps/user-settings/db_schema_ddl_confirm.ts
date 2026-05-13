import type { ConfirmModalSurface } from '@frontend/widgets/common/confirm_modal_contract.ts';
import { frontendApiClient } from '@frontend/runtime/api_client.ts';

/** Уже выполненный preview — чтобы не дергать API дважды после проверки в форме. */
export type DbSchemaDdlPreviewData = { statements: string[]; sql: string };

type RunDbSchemaDdlWithConfirmOptions = {
  confirmModal: ConfirmModalSurface | null | undefined;
  /** Тело для preview и execute; поле `operation` обязательно. */
  payload: Record<string, unknown>;
  /** Если передан — повторный preview не выполняется. */
  preview?: DbSchemaDdlPreviewData | null;
  title?: string;
  onAfterExecute?: () => void | Promise<void>;
};

/**
 * Превью DDL → опционально модальное подтверждение → execute одним и тем же payload.
 */
export async function runDbSchemaDdlWithConfirm(options: RunDbSchemaDdlWithConfirmOptions): Promise<void> {
  const { confirmModal, payload, preview: previewArg, title = 'Подтверждение DDL', onAfterExecute } = options;
  const preview =
    previewArg != null ? previewArg : await frontendApiClient.previewDbSchemaDdl(payload);
  const stmts = preview.statements || [];
  const sqlText = preview.sql || stmts.join(';\n');

  const exec = async (): Promise<void> => {
    await frontendApiClient.executeDbSchemaDdl(payload);
    await onAfterExecute?.();
  };

  if (!confirmModal || typeof confirmModal.open !== 'function') {
    await exec();
    return;
  }

  confirmModal.open({
    title,
    text: sqlText,
    accept: 'Выполнить',
    cancel: 'Отмена',
    onAccept: exec,
  });
}
