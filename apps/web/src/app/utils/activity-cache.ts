// As chaves do cache do SWR da Atividade, por Pessoa: quem entra depois de outra na mesma aba não
// herda os números nem as páginas dela.
export function activityUnreadKey(personId: string): [string, string] {
  return ["activity-unread", personId];
}
