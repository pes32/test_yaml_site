import { computed, reactive } from 'vue';
import {
    clearNotificationTimer as clearNotificationTimerFlow,
    closeNotification as closeNotificationFlow,
    createEmptyNotificationState,
    resetNotifications as resetNotificationsFlow,
    showNotification as showNotificationFlow
} from './page_notification_store.ts';

function usePageNotifications() {
    const notificationState = reactive(createEmptyNotificationState());
    const snackbar = computed(() => notificationState.snackbar);

    function clearSnackbarTimer(): void {
        clearNotificationTimerFlow(notificationState);
    }

    function closeNotification(): void {
        closeNotificationFlow(notificationState);
    }

    function showNotification(message: string, type = 'info'): void {
        showNotificationFlow(notificationState, message, type);
    }

    function resetNotifications(): void {
        resetNotificationsFlow(notificationState);
    }

    return {
        clearSnackbarTimer,
        closeNotification,
        notificationState,
        resetNotifications,
        showNotification,
        snackbar
    };
}

export {
    usePageNotifications
};
