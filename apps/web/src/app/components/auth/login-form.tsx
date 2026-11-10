"use client";

import { MessageSquare } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { login, submitLogin, type LoginState } from "@/app/actions/login";
import { Button } from "@/app/components/ui/button";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import {
  hasErrors,
  validateLogin,
  type LoginFieldErrors,
} from "@/app/utils/login-validation";
import { VERIFICATION_FAILED_PARAM } from "@/app/utils/return-path";
import { clearTheme } from "@/app/utils/theme";

// Mesmo nome de services/login-feedback.ts, que só roda no servidor.
const LOGIN_FEEDBACK_COOKIE = "fc_login_feedback";

const INVALID_CREDENTIALS =
  "E-mail ou senha incorretos. Confira os dados e tente de novo.";

// Mensagens do formulário: ficam entre a Senha e o botão, com role="alert".
const FORM_MESSAGES: Partial<Record<LoginState["status"], string>> = {
  failure: "Não foi possível entrar agora. Confira sua conexão e tente de novo.",
  too_many_attempts:
    "Muitas tentativas de entrar. Aguarde alguns minutos e tente de novo.",
};

// A rede pode cair na própria chamada do Server Action, antes de ele devolver um estado: o fetch
// rejeita com um TypeError de rede ("Failed to fetch" no Chromium, "NetworkError…" no Firefox,
// "Load failed" no Safari). Isso vira a mesma falha recuperável; qualquer outro erro (um bug, ou
// o redirecionamento do login certo) segue para o Next.
const NETWORK_ERROR = /failed to fetch|networkerror|load failed/i;

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError && NETWORK_ERROR.test(error.message);
}

async function loginOrFailure(
  previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    return await login(previous, formData);
  } catch (error) {
    if (isNetworkError(error)) return { status: "failure" };
    throw error;
  }
}

function focusIsLost(): boolean {
  return !document.activeElement || document.activeElement === document.body;
}

type LoginFormProps = {
  // Caminho pedido antes de "Entrar", já conferido; o Server Action confere de novo.
  returnPath: string;
  // O resultado de um envio nativo (antes da hidratação), vindo da URL.
  initialState: LoginState;
};

export function LoginForm({ returnPath, initialState }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    loginOrFailure,
    initialState,
  );
  // Erros da validação no cliente; os do Server Action chegam pelo state.
  const [clientErrors, setClientErrors] = useState<LoginFieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // Onde estava o foco ao enviar: o botão desabilitado durante o envio o perde.
  const focusedOnSubmitRef = useRef<HTMLElement | null>(null);
  // O foco vai para o primeiro campo inválido depois que os erros aparecem, para o leitor de
  // tela já encontrar a descrição ao chegar no campo.
  const shouldFocusInvalidRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // "Entrar" fica no claro, também quando a página chega por uma navegação do cliente, depois de
  // sair (spec da F09, "Cliente", "Tema").
  useEffect(() => clearTheme(), []);

  // Marca o formulário como hidratado: antes disso, o envio é o do navegador, sem a validação
  // no cliente. Os testes de ponta a ponta esperam a marca antes de interagir.
  useEffect(() => {
    formRef.current?.setAttribute("data-ready", "");
    // A marca de verificação que falhou e o resultado do envio nativo servem só para esta
    // abertura: saem da URL e do cookie, para recarregar a página não repetir a mensagem nem
    // pular a verificação da Sessão.
    document.cookie = `${LOGIN_FEEDBACK_COOKIE}=; Path=/entrar; Max-Age=0`;
    const url = new URL(window.location.href);
    if (url.searchParams.has(VERIFICATION_FAILED_PARAM)) {
      url.searchParams.delete(VERIFICATION_FAILED_PARAM);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  // Credenciais incorretas: a senha é limpa e recebe o foco; o e-mail continua.
  useEffect(() => {
    if (state.status === "invalid_credentials") {
      const input = passwordRef.current;
      if (input) {
        input.value = "";
        input.focus();
      }
    }
    // Mensagem do formulário (falha no envio, tentativas demais): o foco volta para onde estava,
    // só se ele se perdeu (a Pessoa pode ter ido para outro campo enquanto esperava).
    if (
      (state.status === "failure" || state.status === "too_many_attempts") &&
      focusIsLost()
    ) {
      focusedOnSubmitRef.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (!shouldFocusInvalidRef.current) return;
    shouldFocusInvalidRef.current = false;
    if (clientErrors.email) emailRef.current?.focus();
    else if (clientErrors.password) passwordRef.current?.focus();
  }, [clientErrors]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const formData = new FormData(event.currentTarget);
    const errors = validateLogin({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    setClientErrors(errors);
    if (hasErrors(errors)) {
      shouldFocusInvalidRef.current = true;
      return;
    }
    focusedOnSubmitRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    startTransition(() => formAction(formData));
  }

  // O resultado do último envio (erros do Server Action, dados incorretos, mensagem do
  // formulário) vale só até a próxima validação no cliente ou o próximo envio.
  const hasClientErrors = hasErrors(clientErrors);
  const showsLastResult = !hasClientErrors && !isPending;
  const serverErrors =
    showsLastResult && state.status === "invalid_input" ? state.fieldErrors : {};
  const emailError = clientErrors.email ?? serverErrors.email;
  const passwordError =
    clientErrors.password ??
    serverErrors.password ??
    (showsLastResult && state.status === "invalid_credentials"
      ? INVALID_CREDENTIALS
      : undefined);
  const formMessage = showsLastResult ? FORM_MESSAGES[state.status] : undefined;

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-panel bg-surface-raised p-8 shadow-2">
      <div className="flex w-full flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-card bg-sidebar text-sidebar-fg-strong">
          <MessageSquare size={24} aria-hidden />
        </div>
        <div className="flex w-full flex-col gap-1 text-center">
          <h1 className="text-display font-black text-fg">Entrar no Full Cycle</h1>
          <p className="text-body text-fg-muted">
            Use o e-mail da sua conta de trabalho.
          </p>
        </div>
      </div>

      {/* O action nativo é a Server Action submitLogin: sem JavaScript, ou antes da hidratação,
          o navegador faz um POST para ela (e nunca um GET com a senha na URL). Com o JS, o
          onSubmit valida e chama o login pelo useActionState, que trata a falha de rede. */}
      <form
        ref={formRef}
        className="flex w-full flex-col gap-4"
        action={submitLogin}
        onSubmit={handleSubmit}
        noValidate
      >
        <input type="hidden" name="para" value={returnPath} />
        <Field label="E-mail" htmlFor="email" error={emailError} errorId="email-error">
          <Input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="nome@empresa.com"
            autoFocus
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "email-error" : undefined}
          />
        </Field>
        <Field
          label="Senha"
          htmlFor="password"
          error={passwordError}
          errorId="password-error"
        >
          <Input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? "password-error" : undefined}
          />
        </Field>
        {formMessage && (
          <p role="alert" className="text-small text-danger-fg">
            {formMessage}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={isPending}>
          Entrar
        </Button>
      </form>
    </div>
  );
}
