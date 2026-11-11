import isFQDN from "validator/lib/isFQDN";
import { z } from "zod";

const emptyAsUndefined = (value: unknown) => (value === "" ? undefined : value);

export const envSchema = z.object({
  CHAT_API_URL: z.url({ protocol: /^https?$/ }),
  // Endereço público da API do chat, em que o navegador abre o WebSocket. Lido no servidor e
  // passado ao cliente, para a mesma imagem servir a todos os ambientes (spec da F03, "Cliente").
  CHAT_API_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
  // Serviço de agentes pela rede interna e a credencial de serviço do BFF (spec da F10, "BFF").
  AGENTS_SERVICE_URL: z.url({ protocol: /^https?$/ }),
  AGENTS_SERVICE_TOKEN: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().min(1),
  // Só o domínio, com o ponto opcional na frente (".exemplo.com"): sem esquema, porta nem barra.
  SESSION_COOKIE_DOMAIN: z.preprocess(
    emptyAsUndefined,
    z
      .string()
      .refine((value) => isFQDN(value.replace(/^\./, ""), { require_tld: false }), {
        message: "domínio inválido",
      })
      .optional(),
  ),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    // O nome e o motivo de cada variável: "faltando" e "inválida" não se confundem.
    const problems = result.error.issues.map(
      (issue) => `${String(issue.path[0])} (${issue.message})`,
    );
    throw new Error(`Configuração inválida: ${[...new Set(problems)].join(", ")}`);
  }
  return result.data;
}

// Lida e validada uma vez, no primeiro import do módulo (o instrumentation.ts faz isso na subida).
export const env = parseEnv(process.env);
