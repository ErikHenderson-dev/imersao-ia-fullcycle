import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl || !testUrl) {
    throw new Error(
      'TEST_DATABASE_URL e TEST_DATABASE_ADMIN_URL são obrigatórias',
    );
  }
  const dbName = new URL(testUrl).pathname.slice(1);

  // O banco começa vazio a cada execução: os testes criam os próprios dados e não os apagam, e um
  // banco que acumula as Pessoas de todas as execuções deixa lento cada Canal público, que inclui
  // todas elas.
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${dbName}" OWNER chat`);
    await admin.query(`REVOKE CONNECT ON DATABASE "${dbName}" FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE "${dbName}" TO chat`);
  } finally {
    await admin.end();
  }

  execFileSync('pnpm', ['migration:run'], {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'inherit',
  });
}
