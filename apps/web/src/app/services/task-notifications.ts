// Abre uma Notificação de Tarefa pela rota do BFF, no cliente: ela fica lida, e os números chegam
// pelo activity.unread (spec da F12, "Cliente (web)"). A falha não impede abrir a Tarefa.
export async function markTaskNotificationOpened(notificationId: string): Promise<void> {
  await fetch(`/api/activity/task-notifications/${encodeURIComponent(notificationId)}/read`, {
    method: "PUT",
  }).catch(() => {});
}
