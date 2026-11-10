// Filas em memória por chave: os trabalhos de uma chave rodam um depois do outro, na ordem em que
// entraram, e chaves diferentes não se esperam. A entrada some quando a fila da chave esvazia. Vale
// para uma instância da API (LLD, "Concorrência e idempotência").
export class KeyedSerialQueue {
  private readonly tails = new Map<string, Promise<void>>();

  // Põe o trabalho na fila da chave; a falha dele não para os seguintes. Devolve quando ele termina.
  run(key: string, work: () => Promise<void>): Promise<void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const next = previous.then(work, work);
    this.tails.set(key, next);
    void next
      .catch(() => {})
      .finally(() => {
        if (this.tails.get(key) === next) this.tails.delete(key);
      });
    return next;
  }
}
