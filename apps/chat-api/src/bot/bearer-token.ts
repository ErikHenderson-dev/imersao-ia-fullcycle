import { createHash, timingSafeEqual } from 'node:crypto';

// O SHA-256 de uma credencial: comparar os resumos deixa os comprimentos iguais sem revelar o da
// credencial esperada.
export function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// Se o cabeçalho `Authorization: Bearer <credencial>` traz uma das credenciais esperadas, cada uma
// conferida em tempo constante (LLD, "Segurança").
export function matchesBearer(
  authorization: string | undefined,
  expected: Buffer[],
): boolean {
  const [scheme, token] = (authorization ?? '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return false;
  const received = digest(token);
  // Confere todas, sem parar na primeira, para o tempo não dizer qual credencial bateu.
  return expected.reduce(
    (matched, candidate) => timingSafeEqual(received, candidate) || matched,
    false,
  );
}
