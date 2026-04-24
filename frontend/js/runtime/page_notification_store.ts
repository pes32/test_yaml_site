type NotificationType = 'success' | 'info' | 'warning' | 'danger' | string;

type PageNotificationRecord = {
  duration: number;
  id: number;
  message: string;
  type: NotificationType;
};

type PageNotificationState = {
  snackbar: PageNotificationRecord | null;
  snackbarHideTimerId: number;
  snackbarSeq: number;
};

function createEmptyNotificationState(): PageNotificationState {
  return {
    snackbar: null,
    snackbarHideTimerId: 0,
    snackbarSeq: 0
  };
}

function clearNotificationTimer(state: PageNotificationState): PageNotificationState {
  if (!state.snackbarHideTimerId) {
    return state;
  }

  clearTimeout(state.snackbarHideTimerId);
  state.snackbarHideTimerId = 0;
  return state;
}

function closeNotification(state: PageNotificationState): PageNotificationState {
  clearNotificationTimer(state);
  state.snackbar = null;
  return state;
}

function showNotification(
  state: PageNotificationState,
  message: unknown,
  type: NotificationType = 'info'
): PageNotificationRecord {
  const notificationId = state.snackbarSeq + 1;
  state.snackbarSeq = notificationId;
  clearNotificationTimer(state);

  state.snackbar = {
    id: notificationId,
    type,
    message: String(message || ''),
    duration: 5000
  };

  state.snackbarHideTimerId = window.setTimeout(() => {
    if (state.snackbar && state.snackbar.id === notificationId) {
      state.snackbar = null;
    }

    state.snackbarHideTimerId = 0;
  }, state.snackbar.duration);

  return state.snackbar;
}

function resetNotifications(state: PageNotificationState): PageNotificationState {
  clearNotificationTimer(state);
  state.snackbar = null;
  return state;
}

export type { NotificationType, PageNotificationRecord, PageNotificationState };

export {
  clearNotificationTimer,
  closeNotification,
  createEmptyNotificationState,
  resetNotifications,
  showNotification
};
