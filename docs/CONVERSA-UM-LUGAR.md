# Conversa em um lugar só — proposta de contrato para o motor

Status: **proposta do cliente**, ainda fora do contrato do motor
(`../engine/docs/API-CONTRATO.md`). O frontend já trata as mensagens abaixo;
motor sem elas não muda nada na tela.

## Por quê

A conversa é uma só e aparece em todos os aparelhos (`conversa.subscribe`).
Com o chat aberto para escrita no Mac e no celular ao mesmo tempo, dá
ambiguidade: dois turnos cruzados, cada um vendo uma ordem. Pedido do
operador: quando o celular conecta, o desktop fica **somente leitura**, com um
botão grande "Retomar conversa" e um switch ao lado para desconectar o remoto.

## Regra

- A conversa tem **um dono de escrita por vez**: a conexão WS que assumiu por
  último.
- O celular pareado assume ao abrir a conversa (manda `conversa.assumir` logo
  depois do `conversa.subscribe`). O Mac passa a só ler.
- "Retomar conversa" no Mac manda `conversa.assumir`; o celular passa a só ler
  e ganha o mesmo botão (sem o switch).
- Ninguém assumiu ainda (só o Mac aberto): o Mac escreve.

## Mensagens WS

Cliente → motor:

```json
{"type":"conversa.assumir","id":"assumir-1"}
```

Motor → cada conexão assinada, sempre que o dono ou a lista de aparelhos
mudar, e logo depois do snapshot do `conversa.subscribe`:

```json
{"type":"conversa.controle","id":"conv-1","payload":{"aqui":"leitura","remotos":[{"id":"a1","nome":"iPhone"}]}}
```

- `aqui`: `"escrita"` se esta conexão é a dona, senão `"leitura"`.
- `remotos`: aparelhos pareados com conexão aberta (para o Mac mostrar o
  switch). `id` é o mesmo de `GET /api/v1/aparelhos` (proposta em
  `docs/PAREAMENTO.md`); `nome` é livre (ex.: derivado do User-Agent).

`chat.send` vindo de conexão em leitura: `error` com `code: "not_owner"`, sem
abrir turno.

## Switch "desconectar o remoto"

Desligar o switch no Mac pede confirmação e chama
`DELETE /api/v1/aparelhos/<id>` para cada remoto (proposta em
`docs/PAREAMENTO.md`); depois o Mac assume a conversa. O celular desconectado
recebe `401` na próxima chamada e volta para a tela de bloqueio. Para religar,
lê o QR de novo.

## Um desktop, um celular

Com um celular conectado (`remotos` não vazio), o Mac esconde o QR do bloco
Remote e mostra "<nome> conectado" com um botão "Desconectar" (o mesmo fluxo
do switch). O QR volta quando o celular é desconectado. Para o motor garantir
isso mesmo sem a tela, o cliente pede que o pareamento novo revogue os
tokens anteriores (o último celular pareado fica; item 1 da proposta em
`docs/PAREAMENTO.md`).

## Como ver a tela sem o motor novo

Com ou sem o motor, `localStorage['resolux-simular-remoto'] = '1'` e
recarregar: o controle passa a vir de um celular simulado (a conversa segue do
motor real, se ele estiver no ar).
