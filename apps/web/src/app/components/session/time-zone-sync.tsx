"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { saveTimeZone } from "@/app/actions/save-time-zone";
import { profileKey } from "@/app/components/profile/profile-panel";
import { readClientCookie, writeClientCookie } from "@/app/utils/client-cookies";
import { DEFAULT_TIME_ZONE } from "@/app/utils/format-time";
import { browserTimeZone, TIME_ZONE_COOKIE } from "@/app/utils/time-zone";

const REJECTED_TIME_ZONE_KEY = "fc_tz_rejected";

function readRejectedTimeZone(): string | null {
  try {
    return sessionStorage.getItem(REJECTED_TIME_ZONE_KEY);
  } catch {
    return null;
  }
}

function writeRejectedTimeZone(timeZone: string): void {
  try {
    sessionStorage.setItem(REJECTED_TIME_ZONE_KEY, timeZone);
  } catch {
    // Sem sessionStorage, a gravação só é tentada de novo na próxima carga.
  }
}

type TimeZoneSyncProps = {
  personId: string;
  // O fuso gravado na Pessoa da Sessão, ou null se ela nunca abriu o chat.
  personTimeZone: string | null;
};

// Grava o fuso do navegador no cookie que o servidor usa para as horas e os dias, e renderiza a
// rota de novo, já no fuso certo. Compara com o próprio cookie, e não com o fuso que o servidor
// aceitou: um fuso que o servidor não reconhece fica gravado e não renderiza de novo a cada carga.
// Também grava o fuso na Pessoa, quando ele difere do dela, para a hora local do Perfil (spec da
// F05, "Fuso"): uma vez por carga da página, sem mostrar uma recusa.
export function TimeZoneSync({ personId, personTimeZone }: TimeZoneSyncProps) {
  const router = useRouter();
  const savedToPerson = useRef(false);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const timeZone = browserTimeZone();
    if (!timeZone || savedToPerson.current || timeZone === personTimeZone) return;
    // Um fuso já recusado nesta aba não é mandado de novo a cada carga.
    if (readRejectedTimeZone() === timeZone) return;
    savedToPerson.current = true;
    void saveTimeZone(timeZone)
      .then((result) => {
        // Só a recusa do fuso é definitiva; uma falha de rede ou da API tenta na próxima carga.
        if (result.kind === "invalid") writeRejectedTimeZone(timeZone);
        // O próprio Perfil, se já foi lido sem o fuso, é lido de novo.
        if (result.kind === "ok") void mutate(profileKey(personId));
      })
      .catch(() => undefined);
  }, [personId, personTimeZone, mutate]);

  useEffect(() => {
    const timeZone = browserTimeZone();
    const saved = readClientCookie(TIME_ZONE_COOKIE);
    if (!timeZone || saved === timeZone) return;
    writeClientCookie(TIME_ZONE_COOKIE, timeZone);
    // Sem cookie, o servidor já usou o fuso padrão: se é o do navegador, não há o que renderizar.
    const renderedIn = saved ?? DEFAULT_TIME_ZONE;
    if (renderedIn !== timeZone && readClientCookie(TIME_ZONE_COOKIE) === timeZone) {
      router.refresh();
    }
  }, [router]);
  return null;
}
