import { codePointLength } from '../common/validation/code-points';
import { InvalidProfileError } from './invalid-profile.error';

// Cargo e telefone do Perfil (spec da F05, "Pessoas"; LLD, "Valores e configuração", "Tamanho do
// cargo" e "Formato do telefone"). As regras são as mesmas dos CHECK de `people`.

export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;

export const PHONE_PATTERN = /^[0-9 +()-]{1,30}$/;

// Vazio, depois de aparado, vira nulo: o campo some do Perfil.
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

// O cargo pronto para gravar, ou a recusa com o motivo.
export function parseTitle(value: string): string | null {
  const title = blankToNull(value);
  if (title === null) return null;
  if (/[\r\n]/.test(title)) {
    throw new InvalidProfileError('O cargo precisa ficar numa linha só.');
  }
  if (codePointLength(title) > TITLE_MAX_LENGTH) {
    throw new InvalidProfileError(
      `O cargo pode ter no máximo ${TITLE_MAX_LENGTH} caracteres.`,
    );
  }
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
