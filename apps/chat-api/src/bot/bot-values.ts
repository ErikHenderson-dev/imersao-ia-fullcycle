// Teto de Mensagens do resumo (LLD, "Valores e configuração"): a leitura do bot traz no máximo as
// mais recentes do Recorte, e o `total` conta o Recorte inteiro.
export const SUMMARY_MESSAGE_LIMIT = 500;

// As Respostas prontas de uma pergunta do bot: no máximo cinco botões, os da pergunta de nome
// repetido (spec da F13, "O Agente `assistente`"; a pergunta pelo Recorte usa quatro), cada um com
// um rótulo curto.
export const QUICK_REPLIES_MAX = 5;
export const QUICK_REPLY_MAX_LENGTH = 64;

// Os `since` de uma chamada às contagens: os quatro Recortes cabem com folga.
export const MESSAGE_COUNTS_MAX_SINCES = 10;
