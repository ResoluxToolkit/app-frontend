# Pareamento do celular — proposta de contrato para o motor

Status: **proposta do cliente**. O contrato é do motor (`app/docs/API-CONTRATO.md`);
este arquivo diz exatamente o que o frontend já envia e espera, para o motor
validar. Enquanto o motor não tiver a rota, o painel mostra o QR só com o
endereço e avisa que ainda não há validação.

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
- Comparação em tempo constante. Basta um limite simples de tentativas erradas
  por IP (ex.: 5 por minuto) para não dar para chutar.

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
