import { codePointLength } from '../common/validation/code-points';
import { InvalidProfileError } from './invalid-profile.error';

// Nome, cargo e telefone do Perfil (spec da F05, "Pessoas"; spec da F09, "Pessoas"; LLD, "Valores de
// regra", "Tamanho do nome", "Tamanho do cargo" e "Formato do telefone"). As regras são as mesmas
// dos CHECK de `people`.

export const NAME_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;

export const PHONE_PATTERN = new RegExp(`^[0-9 +()-]{1,${PHONE_MAX_LENGTH}}$`);

// Vazio, depois de aparado, vira nulo: o campo some do Perfil.
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// Recusa o texto com quebra de linha ou acima do limite; `noun` entra na mensagem.
function assertSingleLine(value: string, max: number, noun: string): void {
  if (/[\r\n]/.test(value)) {
    throw new InvalidProfileError(`${noun} precisa ficar numa linha só.`);
  }
  if (codePointLength(value) > max) {
    throw new InvalidProfileError(
      `${noun} pode ter no máximo ${max} caracteres.`,
    );
  }
}

// O nome pronto para gravar, ou a recusa com o motivo. Obrigatório, numa linha só, como o cargo.
export function parseName(value: string): string {
  const name = value.trim();
  if (name === '') throw new InvalidProfileError('Informe o nome completo.');
  assertSingleLine(name, NAME_MAX_LENGTH, 'O nome');
  return name;
}

// Pessoas com o nome fora da regra, que a migração do CHECK recusa com elas no erro, em vez de
// cortar o nome em silêncio.
export function namesOutsideRule(
  people: { id: string; email: string; name: string }[],
): string | null {
  const outside = people.filter((person) => {
    try {
      return parseName(person.name) !== person.name;
    } catch {
      return true;
    }
  });
  if (outside.length === 0) return null;
  return `Nomes fora da regra (1 a ${NAME_MAX_LENGTH} caracteres, numa linha, sem espaços nas pontas): ${outside
    .map((person) => `${person.id} <${person.email}>`)
    .join(', ')}`;
}

// O cargo pronto para gravar, ou a recusa com o motivo.
export function parseTitle(value: string): string | null {
  const title = blankToNull(value);
  if (title !== null) assertSingleLine(title, TITLE_MAX_LENGTH, 'O cargo');
  return title;
}

// O telefone pronto para gravar, ou a recusa com o motivo.
export function parsePhone(value: string): string | null {
  const phone = blankToNull(value);
  if (phone === null || PHONE_PATTERN.test(phone)) return phone;
  throw new InvalidProfileError(
    `O telefone aceita só dígitos, espaço, +, -, ( e ), até ${PHONE_MAX_LENGTH} caracteres.`,
  );
}
