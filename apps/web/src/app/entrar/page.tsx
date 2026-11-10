import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/components/auth/login-form";
import { AppLoading } from "@/app/components/session/app-loading";
import { getCurrentPerson } from "@/app/services/chat-api";
import { readLoginFeedback } from "@/app/services/login-feedback";
import { readSessionToken } from "@/app/services/session-cookie";
import {
  expiredSessionPath,
  isVerificationFailed,
  safeReturnPath,
} from "@/app/utils/return-path";
import { APP_TITLE } from "@/app/utils/unread";

export const metadata: Metadata = { title: `Entrar · ${APP_TITLE}` };

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface-subtle p-4">
      <Suspense fallback={<AppLoading className="h-auto bg-transparent" />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// "Entrar" aberta com cookie verifica a Sessão: com 200 vai para a Home; com 401 a rota do BFF
// apaga o cookie e volta para cá; com falha de rede ou 5xx, mostra o formulário. Vinda de uma
// verificação que acabou de falhar, mostra o formulário sem verificar de novo.
async function LoginGate({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  const params = await searchParams;
  const returnPath = safeReturnPath(params.para);
  const token = await readSessionToken();
  if (token && !isVerificationFailed(params)) {
    const result = await getCurrentPerson(token);
    if (result.kind === "ok") redirect("/");
    if (result.kind === "unauthenticated") redirect(expiredSessionPath(returnPath));
  }
  return (
    <LoginForm
      returnPath={returnPath}
      initialState={await readLoginFeedback()}
    />
  );
}
