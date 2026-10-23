# Resolux — Frontend (cliente web)

Cliente web do Resolux: Seu Resolume. Mais atento. App **estático** construído por **Vite**, com HTML/DOM vanilla e
estado reativo mínimo (`Sinal`). UI dark no estilo **"solid glass"** (vidro
com profundidade, mas denso e mais opaco, para o conteúdo ler fácil), escrita em
português (identificadores e comentários do código são pt-BR — mantenha assim).
A paleta segue o site resolux.app: fundo quase preto (`--fundo`) e laranja de
marca (`--marca`), com os tokens em `:root` no `client/main.css`.

O [README](README.md) é a porta de entrada para humanos e tem a seção
"Para a engine", que lista o que este cliente consome e espera do motor.

Este diretório (`app/frontend`) é um projeto autônomo. Ele é a metade web do
sistema cuja outra metade é a engine Swift em `../engine` (ResoluxToolkit,
monorepo Xcode/SwiftPM, com seu próprio `AGENTS.md`). O contrato entre as duas
partes é a **Resolux API v1**, documentada em `../engine/docs/API-CONTRATO.md`
(essa doc pertence à engine; leia, não edite daqui).

**Quem rege os contratos é o Spike, e somente ele** (backend; docs em
`github.com/ResoluxToolkit/app/tree/main/docs`): ele decide e escreve o
contrato, e este cliente não o edita. Mas o cliente **deve propor mudanças** e
avisar quando algo entregue for atrapalhar daqui (formato ruim de consumir,
campo que falta, bug que trava): abra uma `issue` no GitHub desse repositório,
com a identidade do agente (ver Git abaixo). Não precisa antecipar quando as
implementações chegam.

## Arquitetura em runtime

```
Navegador (bundle estático)
  └─ imports/api/index.js   ← fachada: escolhe daemon real ou mock
       ├─ imports/api/client.js  → ResoluxDaemon → HTTP+WS 127.0.0.1:1980
       └─ imports/api/mock.js    → MockDaemon    → respostas locais
```

- O daemon real é o `ResoluxServer` da engine Swift, escutando em
  `127.0.0.1:1980` por default (HTTP `/api/v1`, WebSocket `/api/v1/ws`);
  em release o `RESOLUX_BIND=0.0.0.0` abre a LAN/Tailscale e o bundle estático
  sai da mesma origem do daemon.
- Na abertura, `sondarBackend()` faz `GET /api/v1/health` com timeout de 2 s.
  Daemon de pé → backend `daemon`; fora do ar → backend `mock` (sempre "de pé").
- **A UI nunca fala MCP, Ollama, Apple FM ou REST do Arena diretamente.** Tudo
  passa pela fachada (`obterBackend()`), e o `MockDaemon` implementa exatamente
  a mesma interface (`sondar`, `getSession`, `patchSession`, `getTools`,
  `enviarChat`, `obterConversa`, `apagarConversa`, `assinarConversa`,
  `assinarMonitor`, `urlThumbnail`, `obterPareamento`, `parear`), incluindo a validação do contrato (campo
  desconhecido → 400, mesmo envelope de erro `ErroApi`). Método novo no
  `ResoluxDaemon` exige o par no `MockDaemon`. O botão de origem na topbar
  mostra qual motor respondeu — esconder isso é considerado bug.
- Chat: um WebSocket por turno (`chat.send`), máximo um turno por conexão na
  v1. Timeout de turno: 5 minutos (turnos locais são longos: 34 s a 3 min+).
  `cancelar()` apenas fecha o socket — a v1 não tem cancelamento de turno.
- Estado da sessão do motor (`GET/PATCH /api/v1/session`, `GET /api/v1/tools`)
  fica em `Sinal`es exportados por `imports/api/index.js` e é editado na aba
  Ajustes. O mock guarda a sessão só em memória (recarregar zera).
- Composição: o mock não inventa grade (a de exemplo virou fixture de teste
  em `tests/fixtures/`); sem motor a aba mostra "Motor fora do ar". O monitor
  só assina depois da sonda e reinicia quando o backend muda; sem dado nem erro
  do motor em 8 s, mostra `sem_resposta`. Sem grade, a aba lê o monitor do
  sistema (`imports/ui/estadoArena.js`) para dizer se o Arena está aberto e com
  o Webserver ligado; proposta do bloco `arena` em `docs/MONITOR-ARENA.md`.
- Conversa: a thread vive em `localStorage` (`imports/ui/persistencia.js`) e
  sobrevive ao refresh. Com o daemon de pé, `GET /api/v1/conversa` +
  `assinarConversa` (WebSocket) sincronizam a thread entre dispositivos
  (`definirConversa`/`incorporarTurnos` no store); no mock não há espelho.
- Aba Composição (seção `monitor`): a UI **assina** a grade
  (`assinarMonitorGrade()` → `assinarMonitor`); o dono do poll de 1 s no Arena
  é o daemon. `montarGrade` + `mesmaGrade` evitam re-render a cada tick (as
  thumbnails piscariam); o progresso da TimeGrid anda num `Sinal` separado
  (`progressoGrade`) pelo mesmo motivo.
- Composição é do desktop e **Atalhos** é do mobile: seções
  separadas (`monitor` e `atalhos`, cada uma só na sua plataforma) que leem a
  mesma grade e a mesma assinatura (`SECOES_GRADE`); só a apresentação muda.
  No mobile as colunas viram atalhos (o operador cria a tecla pelo nome da
  coluna), sem a grade de clipes. `montarGrade` devolve `colunas` com
  `preenchidos`/`tocando` por coluna, derivados dos clips — o `connected` da
  coluna no Arena só vira "Connected" com a coluna inteira disparada, então
  não serve de estado. Mobile é decidido pelo **aparelho**, não pela largura:
  o script `detectar-plataforma` no `<head>` do `index.html` põe `html.mobile`
  antes do primeiro paint (celular pelo user agent/Client Hints, tablet por
  ser touch sem hover; largura só sem `matchMedia`). Desktop com a janela
  estreita continua desktop. O CSS do mobile usa `html.mobile`, não
  `@media (max-width: 900px)`. Para testar o mobile no desktop, use a emulação
  de aparelho do DevTools. Em links `#monitor`/`#atalhos`,
  `secaoDaPlataforma` (`imports/ui/plataforma.js`) leva para a seção
  equivalente da outra plataforma.
  A barra inferior do celular é uma cápsula de vidro (`.nav-capsula`) com um
  indicador que desliza até o item ativo: `posicionarIndicadorMobile` grava o
  índice em `--ativo` e a transição é do CSS (ligada só depois da posição inicial).
- Aba Status: segundo canal, fora do `/api/v1` — SSE em `/monitor`
  (no daemon, `127.0.0.1:1980/monitor`; `imports/api/monitorSistema.js`), reexportado pela
  fachada. Não tem mock: sem motor a aba fica `offline`. Encerrar processo é
  `POST /monitor/processes/{pid}/terminate`.
  A tela abre com um **veredito** (`avaliarSaude`): CPU/GPU contam pela média
  das últimas 20 amostras (um pico não derruba), e memória conta por uso e por
  compressão, não por "livre" (no macOS ela fica baixa por projeto). Em seguida
  vêm os tiles de métrica e a lista de processos; o resto (portas, NDI, MIDI,
  Art-Net, captura, áudio, displays) fica no bloco recolhível "Detalhes
  técnicos", cujo estado aberto/fechado sobrevive ao re-render.
- Em produção o bundle (`base: "./"`) é servido pelo próprio daemon, então
  HTTP, WS e SSE resolvem pelo mesmo origem; em dev o proxy do Vite faz esse
  papel para `/api/v1` e `/monitor`.
- **Direção: WebSocket primeiro.** HTTP só serve a página; a comunicação do
  cliente (principalmente no mobile) prioriza o WebSocket. Chat, conversa e
  monitor da composição já são WS. Ainda em HTTP/SSE e a migrar: `/health`,
  `/session`, `/tools`, `/conversa`, miniaturas e o SSE `/monitor` da aba
  Status — cada um depende de mensagem nova no contrato da engine. Funcionalidade
  nova que precise de canal com o motor (ex.: disparar coluna) nasce em WS.

## Estrutura de diretórios

| Caminho | Papel |
| --- | --- |
| `index.html` | Shell estático do app: topbar, seções, composer e placeholders. |
| `client/main.js` | Entry do cliente: eventos delegados, render por seção, fluxo do agente, boot. |
| `client/main.css` | ~3100 linhas; design tokens em `:root` (cores `--marca`, `--sucesso`, `--vidro` etc.) e estilos. |
| `imports/api/index.js` | Fachada de backend + estado da sessão do motor e do monitor da grade. |
| `imports/api/client.js` | `ResoluxDaemon`: cliente HTTP/WebSocket da API v1. |
| `imports/api/mock.js` | `MockDaemon`: mesma interface, respostas locais. |
| `imports/api/acesso.js` | Token do aparelho pareado: guarda no `localStorage` e anexa às chamadas (header ou `?token=`). |
| `imports/api/monitorSistema.js` | Feed SSE `/monitor` da aba Status (CPU/RAM/GPU, portas, NDI etc.) e históricos. |
| `imports/ui/signal.js` | `Sinal`: pub/sub reativo mínimo, substituto do ReactiveVar. |
| `imports/ui/store.js` | Estado global da UI em `Sinal` (mensagens, seção ativa, zoom, rótulos). |
| `imports/ui/persistencia.js` | `localStorage` degradável (conversa, atalhos, aviso de instalação). |
| `imports/ui/markdown.js` | Markdown → HTML das respostas do agente (escapa antes de formatar). |
| `imports/ui/dashboard.js` | Tiles de métrica (CPU, RAM, GPU, rede) e lista de processos da aba Status. |
| `imports/ui/widgets.js` | Kit de widgets em funções puras que devolvem HTML: `sparkline`, `tileMetrica`, `veredito`, `grupoRecolhivel`. A cor de cada tile vem de `--acento`. |
| `imports/ui/saude.js` | `avaliarSaude`: veredito da aba Status (Tudo certo / Atenção / Problema) por regras sobre o contrato do motor e o histórico recente. Limites em `LIMITES`. |
| `imports/ui/remoto.js` | QR Code sem dependências + URL de LAN do painel remoto. |
| `imports/ui/ditado.js` | Ditado por voz do Assistente (Web Speech API, só em contexto seguro). |
| `imports/ui/preloader.js`, `pwa.js`, `wco.js`, `logoMetal.js` | Abertura, instalação PWA/iOS, Window Controls Overlay e logo `metal-fx`. |
| `imports/ui/orb.js` | Renderer vanilla dos ThinkingOrbs (`thinking-orbs/engine`) em `<canvas data-orb="estado">`; respeita `prefers-reduced-motion`. |
| `imports/ui/grade.js` | Parser do `GET /composition` do Arena (leitura pura): endereço `camada.coluna`, slot, clipe ativo e regras de thumbnail. Espelha as regras da engine Swift. |
| `imports/ui/plataforma.js` | `secaoDaPlataforma`: leva `#monitor`/`#atalhos` para a seção equivalente da plataforma atual (a detecção do aparelho fica no script `detectar-plataforma` do `index.html`). |
| `imports/ui/atalhos.js` | Deck de atalhos (nome + cor + tamanho bento p/m/g). `resolverAtalho` acha a coluna do Arena pelo nome, sem acento e sem caixa: ok, ambíguo ou sem coluna. Vive em `localStorage` (`resolux-atalhos-v1`). O layout é a ordem da lista (grid de 3 colunas, `dense`, monta de cima para baixo); no modo de edição há botão de tamanho (p→m→g) e alça para arrastar, com reflow animado, e a ordem só é gravada ao soltar. |
| `tests/*.test.js` | Testes Node nativos (grade, atalhos, plataforma e detecção do aparelho, monitor do sistema, saúde, widgets, store/conversa, persistência, markdown, ditado, QR, preloader, URL do WS). |
| `skills/`, `.agents/skills/` | Skills de agente (transições CSS, efeitos de UI). Ver abaixo. |
| `dist/` | Saída do build estático. Gerada; não edite. |

Os diretórios `.bob/`, `.claude/`, `.devin/`, `.hermes/`, `.mcpjam/` são cópias
das mesmas skills para diferentes agentes — não edite à mão.

## Comandos

```bash
npm start        # vite dev server em http://localhost:3003 (proxy /api/v1 e /monitor)
npm run dev      # idem
npm run build    # gera o bundle estático em dist/
npm run preview  # serve dist/ em http://localhost:3003
npm test         # node --test tests/*.test.js
node --test tests/grade.test.js   # um arquivo só
```

Não há lint nem typecheck configurados. O `vite.config.js` já sobe com
`host: true` e `allowedHosts` (`mac`, tailnet) — o dev server fica acessível
na rede para o painel remoto/QR.

Requisitos: Node + dependências do `package.json`. Para o backend real, a engine
Swift precisa estar rodando (`ResoluxServer` em `127.0.0.1:1980`); sem ela o
app abre automaticamente no mock. O bundle de produção existe (`npm run
build`), mas não há deploy configurado. O CI
(`.github/workflows/test.yml`) roda `npm ci` + `npm test` em push e PR para
`main` — por isso o `package-lock.json` precisa estar em sincronia com o
`package.json`. A verificação padrão é `npm test` + o app rodando (`npm start`, abrir http://localhost:3003 e
exercitar a tela).

Para capturar a tela sem abrir navegador (macOS, via WebKit), use
`.tools/websnap.swift`:

```bash
swift .tools/websnap.swift <url> <saida.png> [largura] [altura] [esperaSegundos]
```

Argumentos opcionais extras: um JS de interação, a espera depois dele e um
segundo PNG (veja o cabeçalho do arquivo). Os erros de JS da página saem no
stderr, na linha `DEBUG` (campo `errs`).

O dev usa a porta fixa `3003` de propósito: fica longe do daemon (`1980`) e do
REST do Arena (`8080` de fábrica, `8008` medido nesta máquina). O proxy do
Vite mantém `/api/v1` no mesmo origem durante o desenvolvimento.

## Convenções de código

- **Idioma pt-BR** em comentários, identificadores e textos de UI.
- **Honestidade de estado na cara da UI**: erros do motor aparecem na tela
  (banner na aba Ajustes, mensagem de erro na thread), não só no console.
  Sessão do mock é sempre rotulada como mock.
- **Abstrair o protocolo (princípio do produto)**: o usuário pede um recurso
  ou um resultado e o sistema roteia o sinal. Ele nunca precisa saber de MIDI,
  DMX, OSC, REST, NDI ou WebSocket, nem mapear nada: "receber mídia e entregar
  OSC" é trabalho do sistema. Telas, rótulos e erros falam a língua do
  operador (atalhos, mídia, nomes que ele deu), nunca a do protocolo.
  O deck de atalhos é o exemplo: a tecla vincula pelo nome da coluna.
- **Chat o mais automático possível**: o Assistente não é painel de botões.
  Nada de elemento de mockup sem recurso real por trás (câmera e painel de
  fontes saíram por isso). Só fica na tela o que vale construir depois, e
  marcado como tal.
- **Nada de fingir capacidade**: o mock anuncia zero ferramentas em vez de
  inventar uma lista nem thumbnails; seção sem tela cai no `#view-em-breve`.
- **Trabalho por tacada** (herdado do processo do projeto): um recurso por
  vez, menor escopo possível, sem refatoração lateral. As seções com tela
  hoje são `monitor` (rótulo "Composição"), `atalhos`, `assistente`,
  `status` e `ajustes`.
- Render: cada seção tem um `render*` em `client/main.js` que reescreve
  `innerHTML` a partir dos `Sinal`es (`registrarAssinaturas`); eventos são
  delegados em `registrarEventos`. Dado que muda a cada tick fica fora do
  modelo renderizado e é aplicado por patch direto no DOM.
- HTML/DOM vanilla — sem React e sem template engine. Toda interpolação vinda
  do backend passa por `escaparHtml` antes de `innerHTML`.
- Estados do agente/orb são um enum fechado: `breathing | listening |
  searching | composing | working` (tintas definidas em `imports/ui/orb.js`).
- O re-render recria canvases dos orbs — o `OrbManager` usa um
  `MutationObserver` para rescanear, não retenha referências a canvas fora dele.

## Testes

`npm test` roda o runner nativo do Node (`node --test`) sobre `tests/*.test.js`.
Os testes rodam sem DOM: módulos testáveis guardam acessos a `window`/
`localStorage` (`typeof window !== 'undefined'`, `globalThis.localStorage?.`)
e recebem dependências por parâmetro (ex.: `assinarSistema(CriadorFonte, url)`,
`resolverUrlWs(loc)`). Ao adicionar lógica nova (especialmente em
`imports/api`), mantenha esse formato e escreva o teste junto.

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
- Celular entra pelo QR do Remote: a URL leva um código que o motor gira a
  cada 5 min; o celular devolve o código e recebe um token do aparelho, que vai
  em toda chamada. Contrato em `../engine/docs/API-CONTRATO.md` (seção
  "Pareamento do celular"); `docs/PAREAMENTO.md` resume o lado do cliente.
  Motor antigo sem a rota (`404`): o painel avisa que qualquer aparelho entra.
  Sem token, o celular vê só a tela de bloqueio, que lê o QR por foto
  (`imports/ui/leitorQr.js`, jsQR carregado sob demanda) para parear o PWA.
- Conversa em um lugar só: quando um celular pareado assume a conversa, o
  desktop fica só lendo ("Retomar conversa" + switch que desconecta o remoto).
  Proposta de contrato em `docs/CONVERSA-UM-LUGAR.md`; sem a mensagem
  `conversa.controle` do motor, nada muda.
- Dev pelo Tailscale Serve: `https://mac.tail17794.ts.net:8443` → Vite em
  `localhost:3003`. Não usar 3003 (o `tailscaled` ocupa a porta no IP do
  tailnet e o Vite pula para a 3004) nem 1980 (o motor em release escuta nela
  na LAN e no Tailscale). Em HTTPS
  o leitor de QR lê ao vivo; o Vite troca o `Origin` do WS enquanto o motor não
  aceita `*.ts.net`.
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
