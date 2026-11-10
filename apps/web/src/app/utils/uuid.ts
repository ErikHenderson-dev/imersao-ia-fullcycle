const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Se o texto tem a forma de um uuid, como os ids da API: um parâmetro de URL que não tem nem chega
// à API.
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
