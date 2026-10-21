# Estado do Arena no monitor — proposta de contrato para o motor

Status: **proposta do cliente**, ainda fora do contrato do motor
(`../engine/docs/API-CONTRATO.md`). O frontend já lê o bloco abaixo, se vier;
sem ele, usa a pista que o contrato atual oferece.

## Por quê

A interface é a do próprio motor, que monitora o sistema inteiro. Quando a
aba Composição não tem grade, ela precisa dizer **com certeza** o que está
acontecendo: Arena fechado, Arena aberto com o Webserver desligado, Webserver
ligado mas sem responder, ou porta errada no motor.

Hoje o contrato não permite isso:

- `processes` exclui o Arena de propósito (é a lista de processos que dá para
  encerrar), então o frontend não sabe se o Arena está rodando.
- `ports` mostra o Webserver só quando ele está ligado (porta TCP do processo
  do Arena). Sem porta, "fechado" e "Webserver desligado" ficam iguais.
- `monitor.error` com `arena_unavailable` diz que o REST falhou, mas não por
  quê.

O motor já tem as peças: o socket local do REST
(`~/Library/Application Support/Resolume Arena/rest-api.sock`, ver
`ResolumeApp.isResponsive()`), a detecção do processo
(`SystemProcessInfo.isArenaProcess`), a porta (`ARENA_REST_PORT`) e a sonda de
composição (`ArenaRESTPortObserver.compositionProbe`).

## Bloco novo no SSE `/monitor` (contrato v1, campo adicional)

```json
"arena": {
  "executando": true,
  "pid": 4242,
  "versao": "7.28.1",
  "webserver": { "ativo": true, "porta": 8080, "respondendo": true }
}
```

- `executando`: processo do Arena vivo (ou socket REST local atendendo).
- `pid`, `versao`: opcionais; a versão sai do bundle.
- `webserver.ativo`: o Arena escuta na porta TCP (o toggle de Preferences ›
  Webserver está ligado).
- `webserver.porta`: a porta em que o Arena escuta; se for diferente de
  `ARENA_REST_PORT`, o frontend avisa que o motor está olhando a porta errada.
- `webserver.respondendo`: a última sonda de composição deu certo.

Com o Arena fechado: `{"executando": false}` e sem `webserver`.

## O que o frontend faz com isso

| Estado | Aba Composição sem grade |
|---|---|
| `executando: false` | "Resolume Arena fechado" |
| `executando: true`, `webserver.ativo: false` | "Webserver do Arena desligado" (com o caminho em Preferences) |
| `webserver.ativo`, `respondendo: false` | "Webserver do Arena sem resposta" |
| `webserver.ativo`, sem grade ainda | "Arena aberto, sem composição" (confira a porta do motor) |

Sem o bloco (motor atual): porta TCP do Arena em `ports` → Webserver ligado
naquela porta; sem porta → "Arena sem Webserver", dizendo que o motor ainda
não informa se ele está fechado ou só com o Webserver desligado.
