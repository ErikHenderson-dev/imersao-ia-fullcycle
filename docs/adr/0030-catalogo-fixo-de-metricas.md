---
status: aceita
---

# 0030 · Consulta a Dados de negócio por um catálogo fixo de métricas, com o SQL montado pelo código

O Agente não escreve SQL. Ele chama uma ferramenta com parâmetros (métrica do catálogo, período,
um segundo período para comparar e um filtro por cliente, vendedor ou produto pelo nome), e o
código do Serviço de agentes monta o SQL, calcula a variação e escreve a linha do que foi
considerado. Assim o conteúdo da Conversa só escolhe valores dentro do catálogo, o que fecha o
isolamento entre a Conversa e a consulta deixado em aberto no HLD; os dados de contato ficam fora
por construção; e a linha do que foi considerado descreve o que a consulta fez de fato, e não o que
o modelo diz que fez. A conferência de somente leitura da [ADR 0013](0013-somente-leitura-banco-e-codigo.md)
continua rodando sobre o SQL montado, e o lastro da [ADR 0014](0014-lastro-antes-de-gravar.md)
continua conferindo o texto do modelo.

Descartada: o modelo escrever SQL livre sobre o schema, conferido por um parser de somente leitura,
que responde a mais perguntas mas deixa o isolamento só no somente leitura, alcança qualquer coluna
(inclusive contato) e deixa a descrição da consulta a cargo do modelo.

Custo aceito: cada métrica nova, e cada forma de resposta nova (lista, série), vira código e
avaliação; uma pergunta fora do catálogo recebe a recusa curta.
