import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { juntarDitado, reconhecedorDisponivel } from '../imports/ui/ditado.js';

describe('ditado', () => {
  it('só oferece reconhecedor em contexto seguro', () => {
    function Reconhecedor() {}
    assert.equal(reconhecedorDisponivel({ isSecureContext: false, webkitSpeechRecognition: Reconhecedor }), null);
    assert.equal(reconhecedorDisponivel({ isSecureContext: true, webkitSpeechRecognition: Reconhecedor }), Reconhecedor);
    assert.equal(reconhecedorDisponivel({ isSecureContext: true }), null);
    assert.equal(reconhecedorDisponivel(undefined), null);
  });

  it('continua o texto já digitado', () => {
    assert.equal(juntarDitado('', ' quantos clipes '), 'quantos clipes');
    assert.equal(juntarDitado('Na camada 2, ', 'quantos clipes'), 'Na camada 2, quantos clipes');
    assert.equal(juntarDitado('Oi ', ''), 'Oi');
  });
});
