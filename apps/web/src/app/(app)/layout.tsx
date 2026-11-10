import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BfcacheReload } from "@/app/components/bfcache-reload";
import { ProfilePanel } from "@/app/components/profile/profile-panel";
import { ProfilePanelProvider } from "@/app/components/profile/profile-panel-provider";
import { ConnectionBanner } from "@/app/components/realtime/connection-banner";
import { RealtimeProvider } from "@/app/components/realtime/realtime-provider";
import { AppLoading } from "@/app/components/session/app-loading";
import { SessionError } from "@/app/components/session/session-error";
import { TimeZoneSync } from "@/app/components/session/time-zone-sync";
import { NavigationDrawer } from "@/app/components/workspace-nav/navigation-drawer";
import { Rail } from "@/app/components/workspace-nav/rail";
import { Sidebar } from "@/app/components/workspace-nav/sidebar";
import { env } from "@/app/config/env";
import { getCurrentPerson } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import {
  expiredSessionPath,
  REQUESTED_PATH_HEADER,
} from "@/app/utils/return-path";

// Layout das telas logadas: verifica a Sessão na API do chat a cada renderização
// (LLD, "Cliente", "Sessão no cliente").
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AppLoading />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const token = await readSessionToken();
  const result = token ? await getCurrentPerson(token) : null;
  if (result?.kind === "failure") {
    // Rede, 5xx ou tempo esgotado: não manda para "Entrar" nem apaga o cookie.
    return (
      <>
        <BfcacheReload />
        <SessionError />
      </>
    );
  }
  if (result?.kind !== "ok") {
    // Um Server Component não apaga cookie: a rota do BFF apaga e leva a "Entrar".
    const requestedPath = (await headers()).get(REQUESTED_PATH_HEADER);
    redirect(expiredSessionPath(requestedPath));
  }

  return (
    <RealtimeProvider url={env.CHAT_API_PUBLIC_URL}>
      <ProfilePanelProvider>
        <div className="flex h-screen flex-col">
          <ConnectionBanner />
          <div className="relative flex min-h-0 flex-1">
            <BfcacheReload />
            <TimeZoneSync personId={result.person.id} personTimeZone={result.person.timeZone} />
            <NavigationDrawer
              navigation={
                <>
                  <Rail person={result.person} />
                  <Sidebar personId={result.person.id} />
                </>
              }
            >
              <main className="flex min-w-0 flex-1 flex-col bg-surface">{children}</main>
              <ProfilePanel sessionPersonId={result.person.id} />
            </NavigationDrawer>
          </div>
        </div>
      </ProfilePanelProvider>
    </RealtimeProvider>
  );
}
