import { ref, watch } from 'vue';
import { FrontendApiError } from '@frontend/runtime/api_client.ts';

export function useUserSettingsRun() {
  const loading = ref(false);
  const error = ref('');
  const message = ref('');
  let messageTimer: ReturnType<typeof setTimeout> | null = null;

  watch(message, (value) => {
    if (messageTimer != null) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    if (!value) return;
    messageTimer = setTimeout(() => {
      message.value = '';
      messageTimer = null;
    }, 5000);
  });

  async function run(action: () => Promise<void>): Promise<void> {
    loading.value = true;
    error.value = '';
    message.value = '';
    try {
      await action();
    } catch (err) {
      if (err instanceof FrontendApiError) {
        error.value = err.message;
      } else {
        error.value = err instanceof Error ? err.message : String(err);
      }
    } finally {
      loading.value = false;
    }
  }

  return { loading, error, message, run };
}
