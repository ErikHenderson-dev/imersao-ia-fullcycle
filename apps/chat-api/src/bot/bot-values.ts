// Teto de Mensagens do resumo (LLD, "Valores e configuração"): a leitura do bot traz no máximo as
// mais recentes do Recorte, e o `total` conta o Recorte inteiro.
export const SUMMARY_MESSAGE_LIMIT = 500;

// As Respostas prontas de uma pergunta do bot: no máximo quatro botões, os da pergunta pelo Recorte
// (spec da F11, "O Agente `assistente`"), cada um com um rótulo curto.
export const QUICK_REPLIES_MAX = 4;
export const QUICK_REPLY_MAX_LENGTH = 64;

// Os `since` de uma chamada às contagens: os quatro Recortes cabem com folga.
export const MESSAGE_COUNTS_MAX_SINCES = 10;
