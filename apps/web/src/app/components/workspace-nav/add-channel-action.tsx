"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddPeopleStep } from "@/app/components/conversation/add-people-step";
import { Dialog, DialogTrigger } from "@/app/components/ui/dialog";
import type { Conversation } from "@/app/services/chat-api";
import { CreateChannelDialog } from "./create-channel-dialog";
import { SidebarAction } from "./sidebar-action";

// SidebarAction "Adicionar canal", no fim da seção "Canais" (Casca / Sidebar / Com dados): abre o
// diálogo "Criar canal". O conteúdo monta a cada abertura, com o formulário vazio. Criado um Canal
// privado, o mesmo diálogo passa ao passo "Adicionar pessoas"; fechá-lo por qualquer caminho abre o
// Canal (spec da F04, "Depois de criar").
export function AddChannelAction() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [privateChannel, setPrivateChannel] = useState<Conversation | null>(null);

  function openChannel(conversation: Conversation) {
    setIsOpen(false);
    setPrivateChannel(null);
    // O Server Action revalida o layout: a barra lateral chega com o Canal novo nesta navegação.
    router.push(`/conversas/${conversation.id}`);
  }

  function handleOpenChange(open: boolean) {
    if (!open && privateChannel) return openChannel(privateChannel);
    setIsOpen(open);
  }

  return (
    <li>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <SidebarAction variant="add_channel" />
        </DialogTrigger>
        {isOpen &&
          (privateChannel ? (
            <AddPeopleStep
              conversation={privateChannel}
              onDone={() => openChannel(privateChannel)}
              secondary={{ label: "Pular", onClick: () => openChannel(privateChannel) }}
              // Fechar abre o Canal: o foco vai para a caixa de mensagem dele, e não volta à barra
              // lateral.
              onCloseAutoFocus={(event) => event.preventDefault()}
            />
          ) : (
            <CreateChannelDialog
              onCreated={(conversation) => {
                if (conversation.kind === "private_channel") setPrivateChannel(conversation);
                else openChannel(conversation);
              }}
            />
          ))}
      </Dialog>
    </li>
  );
}
