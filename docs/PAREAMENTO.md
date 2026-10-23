# Pareamento do celular — lado do cliente

Status: **aceito pelo motor**. A fonte da verdade é a seção "Pareamento do
celular" de `../engine/docs/API-CONTRATO.md`; este arquivo diz o que o
frontend envia e espera. Com motor antigo, sem a rota (`404`), o painel mostra
o QR só com o endereço e avisa que ainda não há validação.

## Fluxo

1. O painel no Mac pede um código ao motor e desenha o QR com
   `http://<endereço-de-rede>:<porta>/?p=<codigo>`.
2. O motor gira o código a cada **5 minutos** (no máximo) e também logo depois
   de um pareamento bem-sucedido (uso único).
3. O celular abre a URL, devolve o código ao motor e, se bater, recebe um
   **token do aparelho**. O código sai da barra de endereço na hora.
4. Daí em diante o celular manda o token em toda chamada. Sem token válido,
   fora do Mac, o motor recusa.

## Rotas novas

### `GET /api/v1/pareamento` — só o próprio Mac

Aceita só quem chama do próprio Mac: IP de origem loopback ou um dos IPs das
interfaces locais (o painel pode estar aberto no Mac pelo endereço de rede).
Atrás do proxy do Vite (dev), usar o `X-Forwarded-For`, que o
`vite.config.js` agora repassa; confiar nele **só** quando o peer for loopback.

```json
{"codigo":"tndmY0-eaexPPL1Dxv7U-g","expiraEm":1792303200}
```

- `codigo`: 16 bytes aleatórios (`SecRandomCopyBytes`), base64url sem `=`.
- `expiraEm`: epoch em **segundos** (regra de datas do projeto).
- Opcional: `"base":"http://192.168.0.10:1980"` — endereço de rede que o
  celular alcança. Se vier, o painel usa no QR mesmo aberto por `localhost`.
- Fora do Mac: `403 {"error":{"code":"forbidden","message":"..."}}`.

### `POST /api/v1/pareamento` — qualquer origem aceita

Corpo: `{"codigo":"tndmY0-eaexPPL1Dxv7U-g"}`

- Código igual ao atual e dentro da validade → `200 {"token":"<32 bytes base64url>"}`
  e gira o código na hora.
- Senão → `401 {"error":{"code":"pairing_invalid","message":"..."}}`.
- Mais de 5 tentativas erradas por IP em 60 s → `429 rate_limited`; o celular
  pede para esperar um minuto antes de ler o QR de novo.
- Corpo malformado → `400 corpo_invalido`.
- Comparação em tempo constante.

Os tokens podem ficar só em memória: reiniciar o motor desfaz os pareamentos e
o celular lê o QR de novo.

## O que passa a exigir token

Para quem **não** é o próprio Mac, todas as rotas do daemon exceto
`GET /api/v1/health`, `POST /api/v1/pareamento` e o bundle estático do front
(`/`, `/assets/**`, `/icons/**`, `manifest.webmanifest`), que o celular precisa
para abrir a tela de pareamento.

Como o cliente manda o token:

| Onde | Como |
|---|---|
| `fetch` (`/api/v1/**`, `POST /monitor/processes/*/terminate`) | header `Authorization: Bearer <token>` |
| WebSocket `/api/v1/ws` | query `?token=<token>` no handshake (navegador não põe header em WS) |
| SSE `/monitor` | query `?token=<token>` (EventSource também não) |
| Thumbnails `/api/v1/arena/.../thumbnail/<stamp>` | query `?token=<token>` (`<img>`) |

Sem token ou token desconhecido: `401 {"error":{"code":"unauthorized","message":"..."}}`
no HTTP e handshake WS recusado com 401. O cliente, ao receber 401, apaga o
token salvo e pede para ler o QR de novo.

Atenção ao log: a query `token=` não deve ir para log de acesso.

## Proposta: um token por aparelho e "Desvincular"

Status: **proposta do cliente**, ainda fora do contrato do motor.

No iPhone, cada janela guarda o próprio token: o Safari, o leitor de código da
Central de Controle e o app instalado (PWA) não compartilham armazenamento.
O caminho natural é parear o PWA pelo botão "Fotografar o QR" da tela de
bloqueio, e aí o token que ficou no Safari sobra. O cliente pede:

1. **Um celular por vez: o pareamento novo revoga todos os tokens
   anteriores.** Quem pareou por último fica; os outros recebem `401` e voltam
   para a tela de bloqueio. Cobre o Safari que sobra depois de parear o PWA e
   a regra "um desktop, um celular" (`docs/CONVERSA-UM-LUGAR.md`). Sem campo
   novo no `POST` (o contrato recusa campo desconhecido). Medido em
   2026-10-21: parear de novo no Safari deixa o PWA, pareado antes, logado.
2. **`DELETE /api/v1/pareamento`** com `Authorization: Bearer <token>`: revoga
   o próprio token (botão "Desvincular" no celular). Resposta `204`.
3. **`GET /api/v1/aparelhos`**, só do Mac: lista
   `[{"id":"...","ip":"192.168.0.50","pareadoEm":1792528561,"ultimoUsoEm":1792529000}]`
   (epoch em segundos, sem o token), e **`DELETE /api/v1/aparelhos/<id>`**
   revoga um deles pelo painel do Mac.

Token revogado responde `401 unauthorized`, como token desconhecido; o
cliente já apaga o token e volta para a tela de bloqueio nesse caso.

## Proposta: origem do WebSocket pelo Tailscale

Status: **proposta do cliente**, ainda fora do contrato do motor.

O mobile em produção entra por HTTPS via Tailscale Serve (ex.:
`https://mac.tail17794.ts.net:8443`), que dá contexto seguro (câmera ao vivo
no leitor de QR). O contrato hoje recusa no handshake WS toda origem com ponto
que não termine em `.local`, então o nome do MagicDNS (`*.ts.net`) volta `400`
e o celular fica sem WS. Medido: `Origin: https://mac.tail17794.ts.net:3003`
→ `400`; `Origin: http://mac:3003` → `101`.

O cliente pede trocar a lista de nomes por **Origin igual ao Host**: aceitar
quando o host:porta do `Origin` for o mesmo do cabeçalho `Host` do pedido. É a
defesa padrão contra WS aberto por outro site (o navegador não deixa um site
forjar `Origin`) e cobre Tailscale, `.local` e IP sem lista. A lista atual
pode continuar valendo junto.

Até lá, só em dev, o proxy do Vite troca o `Origin` pelo `localhost` quando ele
é igual ao `Host` (`vite.config.js`); origem de outro site segue intacta e o
motor continua recusando (`400`). Em produção, com o motor servindo o app, não
há esse contorno.
