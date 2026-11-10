"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { saveTimeZone } from "@/app/actions/save-time-zone";
import { readClientCookie, writeClientCookie } from "@/app/utils/client-cookies";
import { DEFAULT_TIME_ZONE } from "@/app/utils/format-time";
import { TIME_ZONE_COOKIE } from "@/app/utils/time-zone";

type TimeZoneSyncProps = {
  // O fuso gravado na Pessoa da Sessão, ou null se ela nunca abriu o chat.
  personTimeZone: string | null;
};

// Grava o fuso do navegador no cookie que o servidor usa para as horas e os dias, e renderiza a
// rota de novo, já no fuso certo. Compara com o próprio cookie, e não com o fuso que o servidor
// aceitou: um fuso que o servidor não reconhece fica gravado e não renderiza de novo a cada carga.
// Também grava o fuso na Pessoa, quando ele difere do dela, para a hora local do Perfil (spec da
// F05, "Fuso"): uma vez por carga da página, sem mostrar uma recusa.
export function TimeZoneSync({ personTimeZone }: TimeZoneSyncProps) {
  const router = useRouter();
  const savedToPerson = useRef(false);

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTimeZone || savedToPerson.current || browserTimeZone === personTimeZone) return;
    savedToPerson.current = true;
    void saveTimeZone(browserTimeZone).catch(() => undefined);
  }, [personTimeZone]);

  useEffect(() => {
    const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const saved = readClientCookie(TIME_ZONE_COOKIE);
    if (!browserTimeZone || saved === browserTimeZone) return;
    writeClientCookie(TIME_ZONE_COOKIE, browserTimeZone);
    // Sem cookie, o servidor já usou o fuso padrão: se é o do navegador, não há o que renderizar.
    const renderedIn = saved ?? DEFAULT_TIME_ZONE;
    if (renderedIn !== browserTimeZone && readClientCookie(TIME_ZONE_COOKIE) === browserTimeZone) {
      router.refresh();
    }
  }, [router]);
  return null;
}
