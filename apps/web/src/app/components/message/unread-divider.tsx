// Divisor de novas Mensagens (UnreadDivider, 21:7793): uma linha `danger` com "Novas mensagens" à
// direita. Fica no começo do item da primeira Não lida, como o divisor de dia, para a lista de
// Mensagens continuar só com itens de Mensagem (spec da F07, "Abrir na primeira Não lida e o
// divisor").
export function UnreadDivider() {
  return (
    <div data-unread-divider className="relative flex items-center justify-end py-2 pr-5">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-danger" />
      <span className="relative bg-surface pl-2 text-small font-bold text-danger-fg">Novas mensagens</span>
    </div>
  );
}
