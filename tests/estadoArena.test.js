import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estadoArena, mensagemArena } from '../imports/ui/estadoArena.js';

const porta = (processName, localPort, transport = 'TCP') => ({ processName, localPort, transport });

describe('estado do Arena pelo monitor do sistema', () => {
  it('porta TCP do Arena aberta: rodando com o Webserver na menor porta', () => {
    const estado = estadoArena({ ports: [porta('node', 3003), porta('Arena', 8080), porta('Arena', 7000, 'UDP')] });
    assert.deepEqual(estado, { executando: true, webserver: { ativo: true, porta: 8080 }, respondendo: null, fonte: 'portas' });
    assert.match(mensagemArena(estado).texto, /porta 8080/);
  });

  it('sem porta do Arena: não dá para saber se está fechado ou sem Webserver', () => {
    const estado = estadoArena({ ports: [porta('ResoluxServer', 1980)] });
    assert.equal(estado.executando, null);
    assert.equal(estado.webserver.ativo, false);
    assert.equal(mensagemArena(estado).titulo, 'Arena sem Webserver');
  });

  it('bloco arena do motor (proposta) tem prioridade e distingue os casos', () => {
    const fechado = estadoArena({ arena: { executando: false }, ports: [porta('Arena', 8080)] });
    assert.equal(mensagemArena(fechado).titulo, 'Resolume Arena fechado');
    const semWeb = estadoArena({ arena: { executando: true, webserver: { ativo: false } } });
    assert.equal(mensagemArena(semWeb).titulo, 'Webserver do Arena desligado');
    const mudo = estadoArena({ arena: { executando: true, webserver: { ativo: true, porta: 8080, respondendo: false } } });
    assert.equal(mensagemArena(mudo).titulo, 'Webserver do Arena sem resposta');
  });

  it('sem contrato ainda: aguardando o monitor', () => {
    assert.equal(mensagemArena(estadoArena(null)).titulo, 'Lendo o sistema…');
  });
});
