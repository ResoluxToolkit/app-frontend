# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fonte da verdade

Leia e siga o [AGENTS.md](AGENTS.md) — ele documenta os comandos (`npm start`,
`npm run build`, `npm test`), a arquitetura em runtime (fachada
`imports/api/index.js` → daemon real ou mock, mais o feed SSE `/monitor`), a
estrutura de diretórios, as convenções pt-BR e as regras de segurança. Não
duplique esse conteúdo aqui: atualize o AGENTS.md quando algo mudar.

O contrato com a engine Swift está em `../engine/docs/API-CONTRATO.md`
(somente leitura a partir deste diretório) — consulte antes de mexer em
`imports/api/`.

## Complementos

Comandos, teste de um arquivo só e o roteiro de verificação estão em
AGENTS.md › Comandos. Aqui ficam só os extras:

- **Preview no app desktop**: o preview `dev` do `.claude/launch.json` sobe o
  mesmo servidor do `npm start` (via `pnpm`, porta `3003`).
- **Screenshot headless**: use `.tools/websnap.swift` (uso em AGENTS.md ›
  Comandos) quando o painel de preview não estiver disponível.
- **Gerenciador de pacotes**: há `package-lock.json`, `pnpm-lock.yaml` e
  `pnpm-workspace.yaml` versionados; ao mudar dependências, mantenha os dois
  lockfiles em sincronia.
- **Git**: antes de `commit`/`push`/`gh`, carregue a identidade do agente
  conforme o AGENTS.md. Se `~/.spike/resolux-org.env` não existir, commite com
  `resolux-org <resoluxtoolkit@gmail.com>` inline.
