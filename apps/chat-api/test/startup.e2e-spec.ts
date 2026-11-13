import { spawnSync } from 'node:child_process';

describe('subida da API', () => {
  it.each([
    'DATABASE_URL',
    'WEB_ORIGIN',
    'CHAT_BOT_TOKEN',
    'CHAT_WORKER_TOKEN',
  ])(
    'a API não sobe sem %s e diz o nome da variável',
    (variable) => {
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env[variable];

      const result = spawnSync('pnpm', ['exec', 'ts-node', 'src/main.ts'], {
        env,
        encoding: 'utf8',
        timeout: 60_000,
      });

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(variable);
    },
    70_000,
  );
});
