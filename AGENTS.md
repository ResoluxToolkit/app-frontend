# Resolux — Frontend (cliente web)

Cliente web do Resolux: interface de chat com o assistente local que opera o
Resolume Arena. App **estático** construído por **Vite**, com HTML/DOM vanilla e
estado reativo mínimo (`Sinal`). UI dark no padrão "Liquid Glass", escrita em
português (identificadores e comentários do código são pt-BR — mantenha assim).

Este diretório (`app/frontend`) é um projeto autônomo. Ele é a metade web do
sistema cuja outra metade é a engine Swift em `../engine` (ResoluxToolkit,
monorepo Xcode/SwiftPM, com seu próprio `AGENTS.md`). O contrato entre as duas
partes é a **Resolux API v1**, documentada em `../engine/docs/API-CONTRATO.md`
(essa doc pertence à engine; leia, não edite daqui).

## Arquitetura em runtime

```
Navegador (bundle estático)
  └─ imports/api/index.js   ← fachada: escolhe daemon real ou mock
       ├─ imports/api/client.js  → ResoluxDaemon → HTTP+WS 127.0.0.1:1980
       └─ imports/api/mock.js    → MockDaemon    → respostas locais
```

- O daemon real é o `ResoluxServer` da engine Swift, escutando apenas em
  `127.0.0.1:1980` (HTTP `/api/v1`, WebSocket `/api/v1/ws`).
- Na abertura, `sondarBackend()` faz `GET /api/v1/health` com timeout de 2 s.
  Daemon de pé → backend `daemon`; fora do ar → backend `mock` (sempre "de pé").
- **A UI nunca fala MCP, Ollama, Apple FM ou REST do Arena diretamente.** Tudo
  passa pela fachada (`obterBackend()`), e o `MockDaemon` implementa exatamente
  a mesma interface (`sondar`, `getSession`, `patchSession`, `getTools`,
  `enviarChat`), incluindo a validação do contrato (campo desconhecido → 400,
  mesmo envelope de erro `ErroApi`). O botão de origem na topbar mostra qual
  motor respondeu — esconder isso é considerado bug.
- Chat: um WebSocket por turno (`chat.send`), máximo um turno por conexão na
  v1. Timeout de turno: 5 minutos (turnos locais são longos: 34 s a 3 min+).
  `cancelar()` apenas fecha o socket — a v1 não tem cancelamento de turno.
- Estado da sessão do motor (`GET/PATCH /api/v1/session`, `GET /api/v1/tools`)
  fica em `Sinal`es exportados por `imports/api/index.js` e é editado na aba
  Ajustes. O mock guarda a sessão só em memória (recarregar zera).

## Estrutura de diretórios

| Caminho | Papel |
| --- | --- |
| `index.html` | Shell estático do app: topbar, seções, composer e placeholders. |
| `client/main.js` | Entry do cliente: eventos delegados, render por seção, fluxo do agente, boot. |
| `client/main.css` | ~1200 linhas; design tokens em `:root` (cores `--marca`, `--sucesso`, `--vidro` etc.) e estilos. |
| `imports/api/index.js` | Fachada de backend + estado da sessão do motor. |
| `imports/api/client.js` | `ResoluxDaemon`: cliente HTTP/WebSocket da API v1. |
| `imports/api/mock.js` | `MockDaemon`: mesma interface, respostas locais. |
| `imports/ui/signal.js` | `Sinal`: pub/sub reativo mínimo, substituto do ReactiveVar. |
| `imports/ui/store.js` | Estado global da UI em `Sinal` (mensagens, seção ativa, contexto %, rótulos). |
| `imports/ui/orb.js` | Renderer vanilla dos ThinkingOrbs (`thinking-orbs/engine`) em `<canvas data-orb="estado">`; respeita `prefers-reduced-motion`. |
| `imports/ui/grade.js` | Parser do `GET /composition` do Arena (leitura pura): endereço `camada.coluna`, slot, clipe ativo e regras de thumbnail. Espelha as regras da engine Swift. |
| `tests/*.test.js` | Testes Node nativos para parser da grade, assinatura do monitor, zoom e sinal. |
| `skills/`, `.agents/skills/` | Skills de agente (transições CSS, efeitos de UI). Ver abaixo. |
| `dist/` | Saída do build estático. Gerada; não edite. |

Os diretórios `.bob/`, `.claude/`, `.devin/`, `.hermes/`, `.mcpjam/` são cópias
das mesmas skills para diferentes agentes — não edite à mão.

## Comandos

```bash
npm start        # vite dev server em http://localhost:3003 (com proxy /api/v1)
npm run dev      # idem
npm run build    # gera o bundle estático em dist/
npm run preview  # serve dist/ em http://localhost:3003
npm test         # node --test (parser da grade, monitor, zoom e sinal)
```

Requisitos: Node + dependências do `package.json`. Para o backend real, a engine
Swift precisa estar rodando (`ResoluxServer` em `127.0.0.1:1980`); sem ela o
app abre automaticamente no mock. O bundle de produção existe (`npm run
build`), mas não há CI nem deploy configurado — a verificação padrão é
`npm test` + o app rodando (`npm start`, abrir http://localhost:3003 e
exercitar a tela).

O dev usa a porta fixa `3003` de propósito: fica longe do daemon (`1980`) e do
REST do Arena (`8080` de fábrica, `8008` medido nesta máquina). O proxy do
Vite mantém `/api/v1` no mesmo origem durante o desenvolvimento.

## Convenções de código

- **Idioma pt-BR** em comentários, identificadores e textos de UI.
- **Honestidade de estado na cara da UI**: erros do motor aparecem na tela
  (banner na aba Ajustes, mensagem de erro na thread), não só no console.
  Sessão do mock é sempre rotulada como mock.
- **Nada de fingir capacidade**: o mock anuncia zero ferramentas em vez de
  inventar uma lista; seções sem tela usam `secaoEmBreve` ("fora desta
  tacada"), que existem só no app nativo.
- **Trabalho por tacada** (herdado do processo do projeto): um recurso por
  vez, menor escopo possível, sem refatoração lateral. Seções Câmera, Monitor
  e Starter são placeholder de propósito nesta tacada.
- HTML/DOM vanilla — sem React e sem template engine. Toda interpolação vinda
  do backend passa por `escaparHtml` antes de `innerHTML`.
- Estados do agente/orb são um enum fechado: `breathing | listening |
  searching | composing | working` (tintas definidas em `imports/ui/orb.js`).
- O re-render recria canvases dos orbs — o `OrbManager` usa um
  `MutationObserver` para rescanear, não retenha referências a canvas fora dele.

## Testes

`npm test` roda o runner nativo do Node (`node --test`) sobre `tests/*.test.js`.
A suíte cobre o parser da grade, a assinatura do monitor, o zoom e o `Sinal`;
ao adicionar lógica nova (especialmente em `imports/api`), escreva o teste junto.

## Git e repositório

Antes de qualquer operação de gerenciamento do repositório (`commit`, `push`,
`pull`, `gh`, criação de PR etc.), carregue a identidade do agente com:

```bash
set -a; source /Users/luizinho/.spike/resolux-org.env; set +a
```

O arquivo define `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`,
`GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL`, `GIT_SSH_COMMAND` (chave SSH
dedicada) e `GH_TOKEN` para o usuário `resolux-org`. Não altere o
`~/.gitconfig` nem as chaves SSH do operador — use sempre este env no escopo
da sessão.

## Segurança

- O daemon aceita só origens locais (`localhost`/`127.0.0.1`/`::1`); não há
  CORS nem rede externa no contrato.
- `ToolPolicy` é read-only e deny-by-default na v1 — a UI trata escrita como
  fixa e só muda o que `PATCH /api/v1/session` aceita
  (`mode`, `backend`, `model`, `toolAllowlist`).
- Erros do backend vêm em envelope `{"error":{"code","message"}}` e são
  convertidos em `ErroApi`; não vaze stack trace para a UI.
- Não commite segredos nem estado local: `.gitignore` cobre `node_modules/`,
  `dist/`, `_build/`, `*/build-assets*`, `*/build-chunks*` e `.rsdoctor`.
- `skills-lock.json` é versionado (hashes das skills instaladas).

## Skills de agente

`skills/` (e os espelhos em `.agents/skills/` e nos diretórios por-agente)
guardam skills instaladas com lock de hash em `skills-lock.json`:

- `transitions-dev` — 35 transições CSS prontas (badges, dropdowns, modals,
  toasts, streaming de texto etc.), seletores `t-*` + motion tokens.
- `transitions-polish` — refinamento de motion contra a escala de tokens
  (duração, distância, easing; assimetria open/close).
- `libraries-pro` — catálogo de efeitos de UI (via Libraries.dev).
- `find-skills` — descobrir e instalar skills do ecossistema aberto
  (CLI `npx skills`).
- `ios-liquid-glass`, `liquid-glass-design`, `swiftui-liquid-glass` —
  referências de API e design do Liquid Glass (iOS 26+); servem à engine Swift
  em `../engine`, mas ficam disponíveis aqui também.

Use essas skills ao adicionar animações/efeitos novos em vez de inventar CSS
ad-hoc; não edite os arquivos das skills diretamente.
