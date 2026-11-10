import { InvalidProfileError } from './invalid-profile.error';

// O @usuário de uma Pessoa (spec da F05, "Pessoas"; LLD, "Valores e configuração", "Formato do
// @usuário"). A mesma derivação serve à conta nova e à migração que preenche as contas que já
// existiam: uma regra escrita duas vezes divergiria.

export const USERNAME_MAX_LENGTH = 30;

// Letras de a a z sem acento, números, `.`, `_` e `-`, de 2 a 30 caracteres, começando e terminando
// com letra ou número. É a mesma expressão do CHECK de `people`.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,28}[a-z0-9]$/;

// O @usuário informado no comando, pronto para gravar, ou a recusa com o motivo.
export function parseUsername(value: string): string {
  const username = value.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new InvalidProfileError(
      'O @usuário aceita letras de a a z sem acento, números, ., _ e -, de 2 a 30 caracteres, começando e terminando com letra ou número.',
    );
  }
  return username;
}

// O que sobra curto demais vira este @usuário, com sufixo quando repete.
const FALLBACK_USERNAME = 'pessoa';

function trimToAlphanumeric(value: string): string {
  return value.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, '');
}

// A parte do e-mail antes do `@`, pela regra do @usuário, sem sufixo.
export function usernameBase(email: string): string {
  const local = email.slice(0, email.lastIndexOf('@'));
  const cleaned = local
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
  const base = trimToAlphanumeric(
    trimToAlphanumeric(cleaned).slice(0, USERNAME_MAX_LENGTH),
  );
  return base.length >= 2 ? base : FALLBACK_USERNAME;
}

// O n-ésimo candidato da base: o primeiro é a própria base; os outros levam o número no fim, com a
// base cortada para caber.
export function withSuffix(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = String(n);
  const cut = trimToAlphanumeric(
    base.slice(0, USERNAME_MAX_LENGTH - suffix.length),
  );
  return `${cut}${suffix}`;
}

// O primeiro candidato da base que `isTaken` não recusa.
export function firstFreeUsername(
  base: string,
  isTaken: (username: string) => boolean,
): string {
  let n = 1;
  while (isTaken(withSuffix(base, n))) n += 1;
  return withSuffix(base, n);
}

// O @usuário de cada e-mail, na ordem de criação das contas: quem veio antes fica com a base.
export function assignUsernames(emails: string[]): string[] {
  const taken = new Set<string>();
  return emails.map((email) => {
    const username = firstFreeUsername(usernameBase(email), (candidate) =>
      taken.has(candidate),
    );
    taken.add(username);
    return username;
  });
}
