// O nome canônico de um fuso IANA ("asia/tokyo" vira "Asia/Tokyo"), ou null quando o Node não o
// reconhece ou quando ele é um deslocamento ("+05:30"), que a spec não aceita como fuso.
export function canonicalTimeZone(value: string): string | null {
  if (value === '' || /^[+-]/.test(value)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: value,
    }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}
