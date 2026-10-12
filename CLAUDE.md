# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Fonte da verdade

Leia e siga o [AGENTS.md](AGENTS.md) — ele documenta os comandos (`npm start`,
`npm run build`, `npm test`), a arquitetura em runtime (fachada
`imports/api/index.js` → daemon real ou mock), a estrutura de diretórios, as
convenções pt-BR e as regras de segurança. Não duplique esse conteúdo aqui:
atualize o AGENTS.md quando algo mudar.

## Complementos

- **Teste único**: `npm test` roda toda a suíte (`node --test` sobre
  `tests/*.test.js`); para um arquivo só, use
  `node --test tests/grade.test.js` (troque pelo arquivo desejado).
- **Acesso externo no dev**: `npm run dev:host` expõe o Vite na rede
  (mantém a porta `3003`).
- **Git**: antes de `commit`/`push`/`gh`, carregue a identidade do agente
  conforme o AGENTS.md. Se `~/.spike/resolux-org.env` não existir, commite com
  `resolux-org <resoluxtoolkit@gmail.com>` inline.
