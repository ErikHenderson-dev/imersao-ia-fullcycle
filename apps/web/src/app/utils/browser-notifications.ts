// A opção da notificação do navegador (spec da F08, "Opção do navegador"): fica no navegador, e não
// na Pessoa, e só vale com a permissão dada.
export const BROWSER_NOTIFICATIONS_KEY = "fc:browser-notifications";

export type NotificationPermissionState = NotificationPermission | "unsupported";

// O estado do item do menu: sem a API de notificação, ele não aparece.
export type BrowserNotificationsState = "unsupported" | "off" | "on" | "blocked";

export function browserNotificationsState(
  permission: NotificationPermissionState,
  isOptedIn: boolean,
): BrowserNotificationsState {
  if (permission === "unsupported") return "unsupported";
  if (permission === "denied") return "blocked";
  return permission === "granted" && isOptedIn ? "on" : "off";
}

// A permissão atual do navegador, ou "sem suporte".
export function currentPermission(): NotificationPermissionState {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported";
}

// A escolha guardada. O armazenamento pode falhar (aba privada, bloqueio): vale como desligada.
export function readOptIn(): boolean {
  try {
    return localStorage.getItem(BROWSER_NOTIFICATIONS_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeOptIn(isOn: boolean): void {
  try {
    if (isOn) localStorage.setItem(BROWSER_NOTIFICATIONS_KEY, "on");
    else localStorage.removeItem(BROWSER_NOTIFICATIONS_KEY);
  } catch {
    // Sem armazenamento, a escolha vale só até recarregar.
  }
}
