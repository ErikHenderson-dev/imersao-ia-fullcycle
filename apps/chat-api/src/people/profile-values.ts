import type { StatusEmoji } from 'chat-events';
import { codePointLength } from '../common/validation/code-points';
import { InvalidProfileError } from './invalid-profile.error';

// Nome, cargo e telefone do Perfil (spec da F05, "Pessoas"; spec da F09, "Pessoas"; LLD, "Valores de
// regra", "Tamanho do nome", "Tamanho do cargo" e "Formato do telefone"). As regras são as mesmas
// dos CHECK de `people`.

export const NAME_MAX_LENGTH = 80;
export const TITLE_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 30;
export const STATUS_TEXT_MAX_LENGTH = 100;

// As chaves dos sete emojis do Status, na ordem do diálogo (LLD, "Valores de regra", "Emojis do
// Status"). A web troca a chave pelo emoji e pelo nome acessível.
export const STATUS_EMOJIS = [
  'speech',
  'headphones',
  'calendar',
  'meal',
  'home',
  'vacation',
  'sick',
] as const satisfies readonly StatusEmoji[];

function isStatusEmoji(value: string): value is StatusEmoji {
  return (STATUS_EMOJIS as readonly string[]).includes(value);
}

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
  if (name === '') throw new InvalidProfileError('Informe seu nome completo.');
  assertSingleLine(name, NAME_MAX_LENGTH, 'O nome');
  return name;
}

// A recusa da migração do CHECK do nome, com quem está fora da regra: ela falha em vez de cortar o
// nome em silêncio.
export function namesOutsideRuleMessage(
  people: { id: string; email: string }[],
): string {
  return `Nomes fora da regra (1 a 80 caracteres, numa linha só): ${people
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

// O Status pronto para gravar a partir do que já estava e do que mudou (spec da F09, "Pessoas"): um
// campo ausente fica como estava, o texto sem emoji ganha o `speech`, e os dois nulos limpam.
export function parseStatus(
  current: { emoji: string | null; text: string | null },
  changes: { emoji?: string | null; text?: string | null },
): { emoji: StatusEmoji | null; text: string | null } {
  const emoji = changes.emoji === undefined ? current.emoji : changes.emoji;
  if (emoji !== null && !isStatusEmoji(emoji)) {
    throw new InvalidProfileError('Escolha um dos emojis do Status.');
  }
  const text =
    changes.text === undefined ? current.text : blankToNull(changes.text ?? '');
  if (text !== null) {
    assertSingleLine(text, STATUS_TEXT_MAX_LENGTH, 'A mensagem de status');
  }
  return { emoji: emoji ?? (text === null ? null : 'speech'), text };
}
