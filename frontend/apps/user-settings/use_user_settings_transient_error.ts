import { ref } from 'vue';

export function useUserSettingsTransientError() {
  const transientError = ref('');
  let transientErrorTimer: ReturnType<typeof setTimeout> | null = null;

  function showTransientError(text: string): void {
    transientError.value = text.trim() || 'Ошибка';
    if (transientErrorTimer != null) {
      clearTimeout(transientErrorTimer);
      transientErrorTimer = null;
    }
    transientErrorTimer = setTimeout(() => {
      transientError.value = '';
      transientErrorTimer = null;
    }, 5000);
  }

  function clearTransientError(): void {
    transientError.value = '';
    if (transientErrorTimer != null) {
      clearTimeout(transientErrorTimer);
      transientErrorTimer = null;
    }
  }

  return { transientError, showTransientError, clearTransientError };
}
