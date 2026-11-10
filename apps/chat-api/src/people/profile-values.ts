// Cargo e telefone do Perfil (spec da F05, "Pessoas"; LLD, "Valores e configuração", "Tamanho do
// cargo" e "Formato do telefone"). As expressões são as mesmas dos CHECK de `people`.

export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;

export const PHONE_PATTERN = /^[0-9 +()-]{1,30}$/;
export const PHONE_SQL_PATTERN = '^[0-9 +()-]{1,30}$';

// Vazio, depois de aparado, vira nulo: o campo some do Perfil.
function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeTitle(value: string): string | null {
  return blankToNull(value);
}

export function normalizePhone(value: string): string | null {
  return blankToNull(value);
}

// O motivo da recusa, ou null quando o valor normalizado vale.
export function titleProblem(title: string | null): string | null {
  if (title === null) return null;
  if (/[\r\n]/.test(title)) return 'O cargo precisa ficar numa linha só.';
  if (Array.from(title).length > TITLE_MAX_LENGTH)
    return `O cargo pode ter no máximo ${TITLE_MAX_LENGTH} caracteres.`;
  return null;
}

export function phoneProblem(phone: string | null): string | null {
  if (phone === null || PHONE_PATTERN.test(phone)) return null;
  return `O telefone aceita só dígitos, espaço, +, -, ( e ), até ${PHONE_MAX_LENGTH} caracteres.`;
}
