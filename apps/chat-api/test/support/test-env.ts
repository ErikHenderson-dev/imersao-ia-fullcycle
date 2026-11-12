const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL é obrigatória para os testes e2e');
}
process.env.DATABASE_URL = testDatabaseUrl;

const testRedisUrl = process.env.TEST_REDIS_URL;
if (!testRedisUrl) {
  throw new Error('TEST_REDIS_URL é obrigatória para os testes e2e');
}
process.env.REDIS_URL = testRedisUrl;

// A carência da presença reduzida (LLD, "Carência da presença"): os testes do tempo real esperam
// a Pessoa ficar ausente sem os 30 s da produção.
process.env.PRESENCE_GRACE_MS = '300';

// A credencial de bot dos testes, a mesma que `botRoutes` envia (test/support/bot-routes.ts).
process.env.CHAT_BOT_TOKEN = 'credencial-de-bot-dos-testes';

// A credencial do Worker dos testes, a mesma que `botRoutes` envia como Worker.
process.env.CHAT_WORKER_TOKEN = 'credencial-do-worker-dos-testes';

// O S3 do contêiner: o teste baixa a URL assinada de dentro do contêiner, pelo endereço interno.
process.env.S3_PUBLIC_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://s3:8333';
