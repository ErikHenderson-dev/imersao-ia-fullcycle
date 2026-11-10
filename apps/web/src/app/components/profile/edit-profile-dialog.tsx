"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { updateProfile } from "@/app/actions/update-profile";
import { usePeopleStore } from "@/app/components/people/people-provider";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter } from "@/app/components/ui/dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Spinner } from "@/app/components/ui/spinner";
import type { Profile } from "@/app/services/chat-api";
import type { StatusEmoji } from "chat-events";
import { cn } from "@/app/utils/cn";
import type { ProfileField, ProfileFieldError } from "@/app/utils/profile-fields";
import { STATUS_EMOJIS } from "@/app/utils/status-emojis";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { fetchProfile, profileKey } from "./profile-panel";

type EditProfileActions = {
  // Abre o diálogo; ao fechar, o foco volta a `returnFocusTo`.
  openEditProfile: (returnFocusTo: HTMLElement | null) => void;
};

const EditProfileContext = createContext<EditProfileActions | null>(null);

// O diálogo "Editar perfil" fica no layout das telas logadas, e não dentro do menu do avatar ou do
// painel que o abrem: fechar o menu não o desmonta (spec da F09, "Cliente", "Editar perfil").
export function EditProfileProvider({
  sessionPersonId,
  children,
}: {
  sessionPersonId: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openEditProfile = useCallback((returnFocusTo: HTMLElement | null) => {
    returnFocus.current = returnFocusTo;
    setIsOpen(true);
  }, []);

  const actions = useMemo(() => ({ openEditProfile }), [openEditProfile]);
  return (
    <EditProfileContext value={actions}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {isOpen && (
          <EditProfileDialog
            sessionPersonId={sessionPersonId}
            onSaved={() => setIsOpen(false)}
            onCloseAutoFocus={(event) => {
              const target = returnFocus.current;
              returnFocus.current = null;
              if (!target?.isConnected) return;
              event.preventDefault();
              target.focus();
            }}
          />
        )}
      </Dialog>
    </EditProfileContext>
  );
}

export function useEditProfile(): EditProfileActions {
  const value = useContext(EditProfileContext);
  if (!value) throw new Error("useEditProfile fora do EditProfileProvider");
  return value;
}

type EditProfileDialogProps = {
  sessionPersonId: string;
  onSaved: () => void;
  onCloseAutoFocus: (event: Event) => void;
};

// Conteúdo do diálogo ("Diálogos / Editar perfil": Padrão, Erro de campo, Erro geral e Salvando).
// Lê o Perfil pela chave do painel, e grava nela o Perfil devolvido.
function EditProfileDialog({ sessionPersonId, onSaved, onCloseAutoFocus }: EditProfileDialogProps) {
  const key = profileKey(sessionPersonId);
  const { data: profile, error, mutate } = useSWR(key, fetchProfile, {
    revalidateOnFocus: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  return (
    <DialogContent
      title="Editar perfil"
      description="Estas informações aparecem para todo o workspace."
      dismissible={!isSaving}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {profile ? (
        <EditProfileForm
          profile={profile}
          isSaving={isSaving}
          onSavingChange={setIsSaving}
          onSaved={onSaved}
        />
      ) : error ? (
        <DialogBody>
          <EmptyState
            title="Não foi possível carregar o perfil"
            description="Verifique sua conexão e tente de novo."
            action={
              <Button type="button" onClick={() => void mutate()}>
                Tentar de novo
              </Button>
            }
          />
        </DialogBody>
      ) : (
        <DialogBody>
          <div role="status" aria-label="Carregando o perfil" className="flex justify-center py-6">
            <Spinner />
          </div>
        </DialogBody>
      )}
    </DialogContent>
  );
}

const FIELDS: {
  field: "name" | "title" | "phone";
  label: string;
  optional: boolean;
  autoComplete: string;
  type: string;
}[] = [
  { field: "name", label: "Nome completo", optional: false, autoComplete: "name", type: "text" },
  { field: "title", label: "Cargo", optional: true, autoComplete: "organization-title", type: "text" },
  { field: "phone", label: "Telefone", optional: true, autoComplete: "tel", type: "tel" },
];

type TextField = "name" | "title" | "phone" | "statusText";

type EditProfileFormProps = {
  profile: Profile;
  isSaving: boolean;
  onSavingChange: (isSaving: boolean) => void;
  onSaved: () => void;
};

function EditProfileForm({ profile, isSaving, onSavingChange, onSaved }: EditProfileFormProps) {
  const { mutate } = useSWRConfig();
  const people = usePeopleStore();
  const [values, setValues] = useState<Record<TextField, string>>({
    name: profile.name,
    title: profile.title ?? "",
    phone: profile.phone ?? "",
    statusText: profile.status?.text ?? "",
  });
  const [statusEmoji, setStatusEmoji] = useState<StatusEmoji | null>(
    profile.status?.emoji ?? null,
  );
  const [errors, setErrors] = useState<ProfileFieldError[]>([]);
  const [hasFailed, setHasFailed] = useState(false);
  const inputs = useRef<Partial<Record<ProfileField, HTMLInputElement | null>>>({});
  const id = useId();

  // O Perfil pode chegar depois de o diálogo abrir, quando o Radix já procurou o primeiro campo:
  // o foco vai para "Nome completo" quando o formulário aparece.
  useEffect(() => {
    inputs.current.name?.focus();
  }, []);

  function errorOf(field: ProfileField): string | undefined {
    return errors.find((error) => error.field === field)?.message;
  }

  function change(field: TextField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Corrigir o campo tira o erro dele; o erro geral sai na próxima tentativa.
    setErrors((current) => current.filter((error) => error.field !== field));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    onSavingChange(true);
    setHasFailed(false);
    // O Server Action rejeita quando a rede cai no caminho: é a mesma falha da API fora do ar.
    const result = await updateProfile({ ...values, statusEmoji }).catch(
      () => ({ kind: "failure" }) as const,
    );
    onSavingChange(false);
    switch (result.kind) {
      case "ok":
        // O painel aberto e a camada de Pessoas (Rail, menu, Mensagens) mostram o novo na hora, sem
        // esperar o person.updated.
        void mutate(profileKey(result.profile.id), result.profile, { revalidate: false });
        people.apply({
          id: result.profile.id,
          name: result.profile.name,
          username: result.profile.username,
          title: result.profile.title,
          status: result.profile.status,
        });
        onSaved();
        return;
      case "invalid":
        setErrors(result.errors);
        inputs.current[result.errors[0].field]?.focus();
        return;
      case "unauthenticated":
        return redirectToExpiredSession();
      default:
        setHasFailed(true);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogBody>
        {FIELDS.map(({ field, label, optional, autoComplete, type }) => {
          const error = errorOf(field);
          const inputId = `${id}-${field}`;
          const errorId = `${inputId}-error`;
          return (
            <Field
              key={field}
              label={label}
              optional={optional}
              htmlFor={inputId}
              error={error}
              errorId={errorId}
            >
              <Input
                ref={(element) => {
                  inputs.current[field] = element;
                }}
                id={inputId}
                type={type}
                value={values[field]}
                // Somente leitura no envio: o que vai para a API é o que está na tela.
                readOnly={isSaving}
                autoComplete={autoComplete}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                onChange={(event) => change(field, event.target.value)}
              />
            </Field>
          );
        })}
        <StatusEmojiPicker
          value={statusEmoji}
          disabled={isSaving}
          onChange={(emoji) => {
            setStatusEmoji(emoji);
            setErrors((current) => current.filter((error) => error.field !== "statusEmoji"));
          }}
        />
        <Field
          label="Mensagem de status"
          optional
          htmlFor={`${id}-statusText`}
          error={errorOf("statusText")}
          errorId={`${id}-statusText-error`}
        >
          <Input
            ref={(element) => {
              inputs.current.statusText = element;
            }}
            id={`${id}-statusText`}
            value={values.statusText}
            readOnly={isSaving}
            autoComplete="off"
            placeholder="Ex.: Focado, respondo em breve"
            aria-invalid={errorOf("statusText") ? true : undefined}
            aria-describedby={errorOf("statusText") ? `${id}-statusText-error` : undefined}
            onChange={(event) => change("statusText", event.target.value)}
          />
        </Field>
        {hasFailed && (
          <p role="alert" className="text-small text-danger-fg">
            Não foi possível salvar o perfil. Tente de novo.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={isSaving}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" loading={isSaving}>
          {isSaving ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Os sete emojis do Status ("Diálogos / Editar perfil", Status): um grupo de rádio com as setas
// entre eles, e Enter, espaço ou o clique no marcado o desmarcam (spec da F09, "Editar perfil").
function StatusEmojiPicker({
  value,
  disabled,
  onChange,
}: {
  value: StatusEmoji | null;
  disabled: boolean;
  onChange: (emoji: StatusEmoji | null) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const labelId = useId();
  const focusIndex = Math.max(
    0,
    STATUS_EMOJIS.findIndex((item) => item.key === value),
  );

  function move(from: number, step: number) {
    const next = (from + step + STATUS_EMOJIS.length) % STATUS_EMOJIS.length;
    onChange(STATUS_EMOJIS[next].key);
    buttons.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-body font-bold text-fg">
        Status <span className="font-normal text-fg-muted">(opcional)</span>
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1">
        {STATUS_EMOJIS.map((item, index) => {
          const isChecked = item.key === value;
          return (
            <button
              key={item.key}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={isChecked}
              aria-label={item.label}
              title={item.label}
              disabled={disabled}
              tabIndex={index === focusIndex ? 0 : -1}
              onClick={() => onChange(isChecked ? null : item.key)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  move(index, 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  move(index, -1);
                }
              }}
              className={cn(
                "flex size-9 items-center justify-center rounded-item border text-title",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/30",
                isChecked
                  ? "border-focus bg-surface-inset"
                  : "border-border-strong hover:bg-surface-subtle",
              )}
            >
              <span aria-hidden>{item.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
