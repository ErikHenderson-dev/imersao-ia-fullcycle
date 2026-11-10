"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  BROWSER_NOTIFICATIONS_KEY,
  type BrowserNotificationsState,
  browserNotificationsState,
  currentPermission,
  readOptIn,
  writeOptIn,
} from "@/app/utils/browser-notifications";

// A opção é lida do navegador; quem a muda (este hook, outra aba pelo evento storage) avisa os
// assinantes.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === BROWSER_NOTIFICATIONS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  // A permissão também muda fora do chat (o cadeado da barra de endereço, as configurações do site).
  let status: PermissionStatus | null = null;
  // A consulta pode voltar depois de a assinatura acabar: aí ela não liga mais nada.
  let isActive = true;
  void navigator.permissions
    ?.query({ name: "notifications" })
    .then((result) => {
      if (!isActive) return;
      status = result;
      result.addEventListener("change", onChange);
    })
    .catch(() => {});
  return () => {
    isActive = false;
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
    status?.removeEventListener("change", onChange);
  };
}

function snapshot(): BrowserNotificationsState {
  return browserNotificationsState(currentPermission(), readOptIn());
}

// Pede a permissão: o Safari antigo só responde pelo callback, e uma recusa do navegador vale como
// "não decidida".
function requestPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    try {
      const pending = Notification.requestPermission(resolve);
      if (pending) pending.then(resolve, () => resolve("default"));
    } catch {
      resolve("default");
    }
  });
}

function notifyAll() {
  listeners.forEach((listener) => listener());
}

// O estado da opção da notificação do navegador e as ações do menu da conta (spec da F08, "Opção do
// navegador"). Ativar pede a permissão, e só aí; no servidor, vale como sem suporte.
export function useBrowserNotifications(): {
  state: BrowserNotificationsState;
  enable: () => Promise<void>;
  disable: () => void;
} {
  const state = useSyncExternalStore(subscribe, snapshot, () => "unsupported" as const);

  const enable = useCallback(async () => {
    let permission = currentPermission();
    if (permission === "default") permission = await requestPermission();
    writeOptIn(permission === "granted");
    notifyAll();
  }, []);

  const disable = useCallback(() => {
    writeOptIn(false);
    notifyAll();
  }, []);

  return { state, enable, disable };
}
