"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRealtime } from "@/app/components/realtime/realtime-provider";

// Com a aba Tarefas vazia não há grupo montado: a primeira Tarefa que chega pelo tempo real recarrega
// a página, que passa a mostrar os grupos (spec da F12, "Cliente (web)").
export function TasksEmptyRefresh() {
  const router = useRouter();
  const { subscribe } = useRealtime();
  useEffect(() => subscribe({ onTask: () => router.refresh() }), [subscribe, router]);
  return null;
}
