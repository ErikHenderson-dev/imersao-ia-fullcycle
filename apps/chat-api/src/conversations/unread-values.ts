// Teto da contagem de não lidas (LLD, "Valores de regra"): as contagens de Não lidas e de Menções
// param nele, e a web mostra `99+` acima de 99.
export const UNREAD_COUNT_LIMIT = 100;

// A Última leitura nula vale como antes da primeira Mensagem: o menor uuid. Uma faixa simples
// (`id > x`), em vez de um OR com a nula, deixa os índices lerem só o que vem depois dela.
export const NOTHING_READ = '00000000-0000-0000-0000-000000000000';
