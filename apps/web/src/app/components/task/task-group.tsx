"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { Button } from "@/app/components/ui/button";
import type { Task, TaskPage, TaskRole } from "@/app/services/chat-api";
import { fetchTaskPage, postTaskStatus, type TaskPageKey } from "@/app/services/task-pages";
import { mergeTask, replaceTask, toggledTask } from "@/app/utils/tasks";
import { TaskItem } from "./task-item";

const LABELS: Record<TaskRole, string> = { assigned: "Recebidas", delegated: "Delegadas" };

type TaskGroupProps = {
  personId: string;
  role: TaskRole;
  initialPage: TaskPage;
  timeZone: string;
  highlightedId: string | null;
  // A Tarefa do link que não está na primeira página, lida pelo servidor: entra no topo do grupo.
  initialPinned: Task | null;
};

// Um grupo da aba Tarefas (spec da F12, "Cliente (web)"): a primeira página vem do RSC, e rolar até
// o fim carrega as seguintes. Os eventos de Tarefa mudam as páginas sem buscar nada, e o `sync` com
// reset busca de novo.
export function TaskGroup({ personId, role, initialPage, timeZone, highlightedId, initialPinned }: TaskGroupProps) {
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<
    TaskPage,
    Error,
    (index: number, previous: TaskPage | null) => TaskPageKey | null
  >(
    (index, previous) => {
      if (index === 0) return ["tasks", personId, role, null];
      if (!previous?.nextCursor) return null;
      return ["tasks", personId, role, previous.nextCursor];
    },
    fetchTaskPage,
    {
      fallbackData: [initialPage],
      revalidateFirstPage: false,
      revalidateOnMount: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  // A primeira página que o servidor acabou de ler entra no cache, que o `mutate` lê: o
  // `fallbackData` não está nele.
  useEffect(() => {
    void setSize(1);
    void mutate([initialPage], { revalidate: false });
  }, [initialPage, mutate, setSize]);
  const [pinned, setPinned] = useState<Task | null>(initialPinned);
  // O clique troca a Tarefa no lugar (`replaceTask`); os eventos a põem pela ordem (`mergeTask`).
  const replace = useCallback(
    (task: Task) => {
      void mutate((current) => replaceTask(current ?? [], task), { revalidate: false });
      setPinned((current) => (current?.id === task.id ? task : current));
    },
    [mutate],
  );
  // A Tarefa nova ou mudada entra nas páginas e, se for a do link, nela também.
  const apply = useCallback(
    (task: Task) => {
      void mutate((current) => mergeTask(current ?? [], task, role, personId), { revalidate: false });
      setPinned((current) => (current?.id === task.id ? task : current));
    },
    [mutate, role, personId],
  );
  const { subscribe } = useRealtime();
  useEffect(
    () =>
      subscribe({
        onTask: apply,
        onSync: (event) => {
          if (event.reset) void mutate();
        },
        replayLastReset: true,
      }),
    [subscribe, apply, mutate],
  );

  const pages = data ?? [];
  const loaded = pages.flatMap((page) => page.tasks);
  const tasks = pinned && !loaded.some((task) => task.id === pinned.id) ? [pinned, ...loaded] : loaded;

  // Concluir ou reabrir, com a atualização otimista desfeita no erro.
  const [updatingIds, setUpdatingIds] = useState<ReadonlySet<string>>(new Set());
  const changeStatus = (task: Task) => {
    const { action, next } = toggledTask(task);
    setUpdatingIds((current) => new Set(current).add(task.id));
    replace(next);
    postTaskStatus(task.id, action)
      .then(replace)
      .catch(() => {
        replace(task);
        toast.error("Não foi possível mudar a Tarefa. Tente de novo.");
      })
      .finally(() =>
        setUpdatingIds((current) => {
          const rest = new Set(current);
          rest.delete(task.id);
          return rest;
        }),
      );
  };

  const hasMore = pages.at(-1)?.nextCursor != null;
  const isLoadingMore = isValidating && size > pages.length;
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasMore || error) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void setSize((current) => current + 1);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, error, setSize, pages.length]);

  const headingId = `tarefas-${role}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <h2 id={headingId} className="px-5 pt-4 pb-2 text-small font-bold text-fg-muted">
        {LABELS[role]}
      </h2>
      {tasks.length === 0 && !hasMore ? (
        <p className="px-5 pb-3 text-small text-fg-muted">Nenhuma Tarefa aqui.</p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              role={role}
              timeZone={timeZone}
              highlighted={task.id === highlightedId}
              updating={updatingIds.has(task.id)}
              onChangeStatus={changeStatus}
            />
          ))}
        </ul>
      )}
      {error && !isLoadingMore && (
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-4 text-center">
          <p className="text-body text-fg-muted">Não foi possível carregar mais Tarefas.</p>
          <Button variant="secondary" size="sm" onClick={() => void mutate()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {hasMore && !error && <div ref={sentinel} className="h-px" />}
    </section>
  );
}
