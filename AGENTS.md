# Resolux — Frontend (cliente web)

Cliente web do Resolux: interface de chat com o assistente local que opera o
Resolume Arena. App **Meteor 3.5.2** com templates **Blaze** (Spacebars),
bundling via **Rspack** (`@meteorjs/rspack`) e estado reativo com
`ReactiveVar`/`Tracker`. UI dark no padrão "Liquid Glass", escrita em
português (identificadores e comentários do código são pt-BR — mantenha assim).

Este diretório (`app/frontend`) é um projeto autônomo. Ele é a metade web do
sistema cuja outra metade é a engine Swift em `../engine` (ResoluxToolkit,
monorepo Xcode/SwiftPM, com seu próprio `AGENTS.md`). O contrato entre as duas
partes é a **Resolux API v1**, documentada em `../engine/docs/API-CONTRATO.md`
(essa doc pertence à engine; leia, não edite daqui).

## Arquitetura em runtime

```
Navegador (Meteor/Blaze)
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
  fica em `ReactiveVar`s exportados por `imports/api/index.js` e é editado na
  aba Ajustes. O mock guarda a sessão só em memória (recarregar zera).

## Estrutura de diretórios

| Caminho | Papel |
| --- | --- |
| `client/main.js` | Entry do cliente: helpers/eventos Blaze, fluxo do agente, boot. |
| `client/main.html` | Templates Blaze (`app`, `topbar`, `sidebar`, `thread`, `composer`, `ajustes`, `secaoEmBreve`, `painelContexto`). |
| `client/main.css` | ~1000 linhas; design tokens em `:root` (cores `--marca`, `--sucesso`, `--vidro` etc.) e estilos. |
| `server/main.js` | Scaffold vazio — ainda não há código de servidor. |
| `imports/api/index.js` | Fachada de backend + estado da sessão do motor. |
| `imports/api/client.js` | `ResoluxDaemon`: cliente HTTP/WebSocket da API v1. |
| `imports/api/mock.js` | `MockDaemon`: mesma interface, respostas locais. |
| `imports/ui/store.js` | Estado global da UI em `ReactiveVar` (mensagens, seção ativa, contexto %, rótulos). |
| `imports/ui/orb.js` | Renderer vanilla dos ThinkingOrbs (`thinking-orbs/engine`) em `<canvas data-orb="estado">`; respeita `prefers-reduced-motion`. |
| `tests/main.js` | Suíte mocha mínima (smoke client/server). |
| `skills/`, `.agents/skills/` | Skills de agente (transições CSS, efeitos de UI). Ver abaixo. |
| `_build/`, `public/build-chunks/` | Saída do build (Meteor Modern-Tools). Gerados; não edite. |

Os diretórios `.bob/`, `.claude/`, `.devin/`, `.hermes/`, `.mcpjam/` são cópias
das mesmas skills para diferentes agentes — não edite à mão.

## Comandos

```bash
npm start        # meteor run --port 3003 (dev, com HMR: hot-module-replacement + blaze-hot)
npm run dev      # idem
npm test         # meteor test --once --driver-package meteortesting:mocha
npm run test-app # TEST_WATCH=1 meteor test --full-app (modo watch)
npm run visualize # bundle-visualizer em modo production
```

Requisitos: Meteor 3.5.2 (`.meteor/release`). Para o backend real, a engine
Swift precisa estar rodando (`ResoluxServer` em `127.0.0.1:1980`); sem ela o
app abre automaticamente no mock. Não há scripts de build de produção, CI ou
deploy configurados — a verificação padrão é `npm test` + o app rodando
(`npm start`, abrir http://localhost:3003 e exercitar a tela).

O dev usa a porta fixa `3003` de propósito: o default do Meteor (app `3000`)
leva o HMR do Rspack para o `8080`, que é o default de fábrica do REST do
Arena — colisão com serviço interno. Com `--port 3003` o trio medido fica
app `3003` / HMR `8083` / Mongo `3004`, longe do daemon (`1980`) e do Arena
(`8080` de fábrica, `8008` medido nesta máquina).

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
- Blaze puro — sem React. HTML escapado manualmente antes de `{{{...}}}`
  (`escaparHtml` em `client/main.js`).
- Estados do agente/orb são um enum fechado: `breathing | listening |
  searching | composing | working` (tintas definidas em `imports/ui/orb.js`).
- Mustache/Spacebars: helper em posição de atributo precisa devolver um
  dicionário (`{ checked: true }` ou `{}`), nunca string solta.
- Blaze recria os canvases dos orbs a cada render — o `OrbManager` usa um
  `MutationObserver` para rescanear, não retenha referências a canvas fora
  dele.

## Testes

`npm test` roda mocha (`meteortesting:mocha`) com o módulo de teste
`tests/main.js` (configurado em `package.json` → `meteor.testModule`), nos
contextos client e server. A suíte atual é smoke-test; ao adicionar lógica
nova (especialmente em `imports/api`), escreva o teste junto.

## Segurança

- O daemon aceita só origens locais (`localhost`/`127.0.0.1`/`::1`); não há
  CORS nem rede externa no contrato.
- `ToolPolicy` é read-only e deny-by-default na v1 — a UI trata escrita como
  fixa e só muda o que `PATCH /api/v1/session` aceita
  (`mode`, `backend`, `model`, `toolAllowlist`).
- Erros do backend vêm em envelope `{"error":{"code","message"}}` e são
  convertidos em `ErroApi`; não vaze stack trace para a UI.
- Não commite segredos nem estado local: `.gitignore` cobre `node_modules/`,
  `_build/`, `*/build-assets*`, `*/build-chunks*` e `.rsdoctor`. Não adicione
  `.meteor/` inteiro ao ignore: `.meteor/packages` e `.meteor/release` são
  versionados (só `.meteor/local` é estado local).
- `skills-lock.json` é versionado (hashes das skills instaladas).

## Skills de agente

`skills/` (e os espelhos em `.agents/skills/` e nos diretórios por-agente)
guardam skills instaladas com lock de hash em `skills-lock.json`:

- `transitions-dev` — 32 transições CSS prontas (badges, dropdowns, modals,
  toasts, streaming de texto etc.), seletores `t-*` + motion tokens.
- `transitions-polish` — refinamento de motion contra a escala de tokens
  (duração, distância, easing; assimetria open/close).
- `libraries-pro` — catálogo de efeitos de UI (via Libraries.dev).

Use essas skills ao adicionar animações/efeitos novos em vez de inventar CSS
ad-hoc; não edite os arquivos das skills diretamente.
