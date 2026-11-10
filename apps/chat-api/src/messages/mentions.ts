import { USERNAME_MAX_LENGTH } from '../people/username';

// Um `@usuario` escrito no texto: no começo, ou depois de um caractere que não pode fazer parte de
// um @usuário (o `@` de um e-mail não conta), com o formato do @usuário da F05 (spec da F06,
// "Menções, ao gravar"). As maiúsculas valem como minúsculas.
const MENTION = new RegExp(
  `(?<![\\p{L}\\p{N}._@-])@([a-z0-9](?:[a-z0-9._-]{0,${USERNAME_MAX_LENGTH - 2}}[a-z0-9])?)(?![a-z0-9_-]|\\.[a-z0-9])`,
  'giu',
);

// Os @usuário escritos no texto, em minúsculas e sem repetir, na ordem em que aparecem. Quem eles
// são, e se são Membros da Conversa, é decidido ao gravar.
export function extractMentionUsernames(body: string): string[] {
  const usernames = new Set<string>();
  for (const match of body.matchAll(MENTION)) {
    const username = match[1].toLowerCase();
    if (username.length >= 2) usernames.add(username);
  }
  return [...usernames];
}
