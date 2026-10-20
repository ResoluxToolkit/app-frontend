# Resolux — Frontend

Cliente web do **Resolux: Seu Resolume. Mais atento.** É o painel que o
operador usa no Mac e no celular para acompanhar a composição do Resolume
Arena, conversar com o Assistente e ver a saúde da máquina. A outra metade do
sistema é a engine Swift ([ResoluxToolkit/app](https://github.com/ResoluxToolkit/app)),
que roda o daemon local e fala com o Arena.

App estático (Vite + HTML/DOM vanilla), UI dark no estilo "solid glass" com a
paleta do resolux.app. Sem engine rodando, o app abre sozinho num mock e
avisa na topbar.

## Rodar

```bash
npm install
npm start      # http://localhost:3003
npm test
npm run build  # bundle estático em dist/
```

Detalhes de arquitetura, convenções e roteiro de verificação estão no
[AGENTS.md](AGENTS.md).

## O que tem hoje

| Seção | Plataforma | O que faz |
| --- | --- | --- |
| Assistente | desktop e mobile | Chat com o motor (somente leitura nesta fase), ditado por voz. |
| Composição | só desktop | Grade de colunas e clipes do Arena, ao vivo. |
| Atalhos | só mobile | Deck bento de teclas que acham a coluna do Arena pelo nome. |
| Status | desktop e mobile | Veredito de saúde, métricas (CPU, memória, GPU, rede), processos e detalhes técnicos. |
| Ajustes | desktop e mobile | Modo, backend, modelo e ferramentas da sessão do motor. |

Desktop ou mobile é decidido pelo **aparelho**, não pela largura da janela.

## Para a engine

Esta seção é para quem cuida do motor (Spike). O contrato é da engine
(`app/docs/API-CONTRATO.md`) e este cliente não o edita: aqui fica só o que o
frontend consome hoje e o que ele está esperando. Pedidos formais viram
`issue` no repositório da engine.

### O que o cliente usa hoje

| Canal | Uso no cliente |
| --- | --- |
| `GET /api/v1/health` | Sonda na abertura (timeout 2 s). Fora do ar, o app cai no mock. |
| `GET` / `PATCH /api/v1/session`, `GET /api/v1/tools` | Aba Ajustes. O `PATCH` só manda `mode`, `backend`, `model`, `toolAllowlist`. |
| `GET` / `DELETE /api/v1/conversa` | Carrega e apaga a conversa espelhada. |
| WS `/api/v1/ws` → `chat.send` | Um turno por conexão. Espera `hello`, `chat.started`, `chat.result`, `chat.error`/`error`. Timeout de 5 min no cliente. |
| WS `/api/v1/ws` → `conversa.subscribe` | Sincroniza a thread entre aparelhos via `conversa.update`. |
| WS `/api/v1/ws` → `monitor.subscribe` | Grade da Composição/Atalhos via `monitor.update`/`monitor.error`. O poll de 1 s no Arena é do daemon. |
| `GET /api/v1/arena/api/v1/composition` e `.../clips/by-id/<id>/thumbnail/<stamp>` | Proxy read-only do Arena. Thumbnails ainda vêm por aqui. |
| SSE `/monitor` (mesma porta do daemon) | Aba Status inteira. Sem mock: sem motor, a aba fica offline. |
| `POST /monitor/processes/<pid>/terminate` | Botão de encerrar processo na aba Status. |

Em produção o bundle é servido pelo próprio daemon (mesma origem). Em dev, o
Vite (porta 3003) faz proxy de `/api/v1` e `/monitor` para `127.0.0.1:1980`.

### Comportamentos do cliente que valem saber

- **Coluna "tocando"** é derivada dos clipes, não do `connected` da coluna: no
  Arena a coluna só fica "Connected" com a coluna inteira disparada.
- **Atalhos** acham a coluna pelo nome, sem acento e sem diferença de
  maiúscula. Nome repetido no Arena aparece como "ambíguo" para o operador.
- **Chat somente leitura**: a UI trata a `ToolPolicy` como fixa e não oferece
  escrita no Arena nesta fase.

### O que o cliente está esperando

1. **Desvincular aparelho pareado.** O pareamento por QR (`GET`/`POST
   /api/v1/pareamento`, token em `Authorization: Bearer` no HTTP e `?token=` em
   WS, SSE e thumbnails) já é contrato da engine; falta uma rota para revogar
   um token sem reiniciar o daemon.
2. **Migrar para WebSocket** o que ainda é HTTP/SSE: `/health`, `/session`,
   `/tools`, `/conversa`, miniaturas (idealmente junto com a composição no
   `monitor.update`) e o SSE `/monitor` da aba Status. Cada um depende de
   mensagem nova no contrato. Recurso novo com o motor (ex.: disparar coluna)
   já nasce em WS.
3. **Cancelar turno de chat**: hoje o cliente só fecha o socket, porque a v1
   não tem cancelamento.
