import { Pool, type PoolClient } from "pg";

// O estado de conexão dos Agentes, direto no Banco dos agentes do ambiente de desenvolvimento
// (spec da F10, "Registro de Agentes"): existir a linha é estar conectado. Ele é global, então os
// testes que o leem ou o mudam seguram uma trava (agentsLock) e não correm um contra o outro.
const pool = new Pool({ connectionString: process.env.AGENTS_DATABASE_URL, max: 4 });

// Uma Pessoa qualquer como quem conectou: o registro não confere a Pessoa.
const E2E_CONNECTED_BY = "00000000-0000-7000-8000-000000000e2e";

export async function setConnected(slug: string, connected: boolean): Promise<void> {
  if (connected) {
    await pool.query(
      "INSERT INTO connected_agents (slug, connected_by) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING",
      [slug, E2E_CONNECTED_BY],
    );
  } else {
    await pool.query("DELETE FROM connected_agents WHERE slug = $1", [slug]);
  }
}

export async function isConnected(slug: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM connected_agents WHERE slug = $1", [slug]);
  return (result.rowCount ?? 0) > 0;
}

// A chave da trava dos testes que dependem do estado de conexão.
const LOCK_KEY = 4210;

// Segura a trava numa conexão própria até `release`.
export async function lockAgents(): Promise<() => Promise<void>> {
  const client: PoolClient = await pool.connect();
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
  return async () => {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    } finally {
      client.release();
    }
  };
}
