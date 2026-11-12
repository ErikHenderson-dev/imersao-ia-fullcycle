import { z } from 'zod';
import { RENEWAL_INTERVAL_DAYS } from './session-values';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  // Redis dos eventos por Pessoa para a reconexão (LLD, "Integrações externas").
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_COOKIE_NAME: z.string().min(1),
  // Origem da web, a única aceita no handshake do WebSocket (LLD, "Segurança").
  WEB_ORIGIN: z
    .url({ protocol: /^https?$/ })
    .transform((value) => new URL(value).origin),
  // Maior que o intervalo de renovação: senão a Sessão vence antes de poder ser renovada.
  SESSION_TTL_DAYS: z.coerce
    .number()
    .int()
    .min(RENEWAL_INTERVAL_DAYS + 1)
    .default(30),
  // Carência da presença (LLD, "Valores de regra"): tempo sem nenhum socket antes de a Pessoa ficar
  // ausente. Reduzida nos testes.
  PRESENCE_GRACE_MS: z.coerce.number().int().positive().default(30_000),
  // Credencial de bot que as rotas /v1/bot conferem (LLD, "Segurança"); o mesmo valor do Serviço
  // de agentes.
  CHAT_BOT_TOKEN: z.string().trim().min(1),
  // Credencial do Worker de agentes, aceita só nas ações de entrega e de falha do Relatório (LLD,
  // "Segurança"; spec da F14, "Ações de bot do Relatório").
  CHAT_WORKER_TOKEN: z.string().trim().min(1),
  // Armazenamento de objetos do PDF do Relatório (spec da F14, "Armazenamento"): a API só assina a
  // URL de download, com o endereço público, que o navegador alcança.
  S3_PUBLIC_ENDPOINT: z.url({ protocol: /^https?$/ }),
  S3_BUCKET: z.string().trim().min(1),
  S3_ACCESS_KEY_ID: z.string().trim().min(1),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    // O nome e o motivo de cada variável: "faltando" e "inválida" não se confundem.
    const problems = result.error.issues.map(
      (issue) => `${String(issue.path[0])} (${issue.message})`,
    );
    throw new Error(
      `Configuração inválida: ${[...new Set(problems)].join(', ')}`,
    );
  }
  return result.data;
}

export function loadEnv(): Env {
  return parseEnv(process.env);
}
