// Encaminhador de portas do contêiner e2e (LLD, "Ambiente de desenvolvimento"): liga
// localhost:3000 à web, localhost:3001 à API do chat e localhost:8333 ao S3, para o navegador do
// teste abrir os três por localhost, como o da máquina, e o cookie de sessão valer também no
// WebSocket. É o processo principal do contêiner e o mantém de pé.
import net from "node:net";

const ROUTES = [
  { port: 3000, host: "web", targetPort: 3000 },
  { port: 3001, host: "chat-api", targetPort: 3000 },
  // A URL assinada do PDF do Relatório (F14), com o mesmo endereço do navegador da máquina.
  { port: 8333, host: "s3", targetPort: 8333 },
];

for (const route of ROUTES) {
  net
    .createServer((client) => {
      const upstream = net.connect(route.targetPort, route.host);
      client.pipe(upstream).pipe(client);
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on("error", close);
      upstream.on("error", close);
    })
    .on("error", (error) => {
      console.error(`localhost:${route.port}: ${error.message}`);
      process.exit(1);
    })
    // Sem host: ouve em IPv4 e IPv6, porque "localhost" pode resolver para os dois.
    .listen(route.port, () => {
      console.log(`localhost:${route.port} -> ${route.host}:${route.targetPort}`);
    });
}
