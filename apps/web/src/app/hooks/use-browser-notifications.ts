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
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): BrowserNotificationsState {
  return browserNotificationsState(currentPermission(), readOptIn());
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
    if (permission === "default") permission = await Notification.requestPermission();
    writeOptIn(permission === "granted");
    notifyAll();
  }, []);

  const disable = useCallback(() => {
    writeOptIn(false);
    notifyAll();
  }, []);

  return { state, enable, disable };
}
