---
status: aceita
---

# 0026 · Não lidas e menções calculadas a partir da Última leitura

Substitui a [0021](0021-contadores-gravados.md). Cada participação guarda só a Última leitura, como
o id da última Mensagem lida, e os números de não lidas e de menções saem de uma contagem: as
Mensagens da Conversa posteriores à Última leitura, de outro autor e não apagadas, limitada a 100
(o contador mostra `99+`), e as menções à Pessoa entre elas. O PRD da F07 exige que a exclusão e a
edição que muda menção corrijam os números; com a contagem, a correção sai da própria consulta, sem
descontar de cada Membro que ainda não leu nem somar ou tirar menções Pessoa a Pessoa, e o número
nunca diverge da Última leitura.

Descartadas: contadores gravados, somados na transação da Mensagem e zerados na leitura (a 0021),
que obrigariam a exclusão e a edição a corrigir os contadores de cada Membro afetado e poderiam
divergir da Última leitura.

Custo aceito: cada mudança que afeta os números (Mensagem nova, editada com mudança de menção,
apagada ou lida) refaz a contagem dos Membros afetados, numa consulta agrupada por Pessoa e limitada
a 100 por Conversa, pelo índice de Mensagens por Conversa.
