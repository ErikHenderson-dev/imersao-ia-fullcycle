// Validade do identificador de pedido no Pedido comum (LLD, "Valores e configuração").
export const AGENT_REQUEST_TTL_MS = 2 * 60 * 1000;

// Validade do identificador de pedido no Pedido demorado, contada do Aviso de início (LLD, "Valores e
// configuração"; spec da F14, "Ações de bot do Relatório").
export const LONG_AGENT_REQUEST_TTL_MS = 10 * 60 * 1000;

// Validade da Pergunta pendente (LLD, "Valores e configuração").
export const PENDING_QUESTION_TTL_MS = 60 * 60 * 1000;
