import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  grupoRecolhivel,
  sparkline,
  tileMetrica,
  veredito,
} from '../imports/ui/widgets.js';

describe('sparkline', () => {
  it('desenha linha e área a partir de uma série em %', () => {
    const html = sparkline([0, 50, 100]);
    assert.match(html, /<polyline class="spark-linha" points="0\.0,40\.0 50\.0,20\.0 100\.0,0\.0"/);
    assert.match(html, /<polygon class="spark-area"/);
  });

  it('com menos de duas amostras não inventa tendência', () => {
    assert.doesNotMatch(sparkline([42]), /polyline/);
    assert.doesNotMatch(sparkline([]), /polyline/);
    assert.doesNotMatch(sparkline(undefined), /polyline/);
  });

  it('limita valores fora de 0 a 100 e ignora o que não é número', () => {
    const html = sparkline([-20, 'x', 180]);
    assert.match(html, /points="0\.0,40\.0 100\.0,0\.0"/);
  });
});

describe('tileMetrica', () => {
  const base = { rotulo: 'CPU', valor: '87%', detalhe: 'user 50% · sys 37%', icone: 'cpu', acento: 'var(--gb-azul)' };

  it('mostra rótulo, valor grande, detalhe, tendência e barra', () => {
    const html = tileMetrica({ ...base, serie: [10, 90], percentual: 87 });
    assert.match(html, /<h3>CPU<\/h3><p>user 50% · sys 37%<\/p>/);
    assert.match(html, /<span class="tile-valor">87%<\/span>/);
    assert.match(html, /<polyline/);
    assert.match(html, /<div class="tile-barra"[^>]*><span style="width: 87\.0%">/);
    assert.match(html, /--acento: var\(--gb-azul\)/);
  });

  it('sem percentual e sem série, mostra só o número', () => {
    const html = tileMetrica(base);
    assert.doesNotMatch(html, /tile-barra/);
    assert.doesNotMatch(html, /polyline/);
  });

  it('escapa texto vindo do motor', () => {
    const html = tileMetrica({ ...base, rotulo: '<b>x</b>', detalhe: '"a" & b' });
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
    assert.match(html, /&quot;a&quot; &amp; b/);
  });

  it('limita a barra entre 0 e 100%', () => {
    assert.match(tileMetrica({ ...base, percentual: 250 }), /width: 100\.0%/);
    assert.match(tileMetrica({ ...base, percentual: -5 }), /width: 0\.0%/);
  });
});

describe('veredito', () => {
  it('mostra título e frase, com o nível na classe', () => {
    const html = veredito({
      nivel: 'atencao',
      titulo: 'Atenção',
      frase: 'GPU em 90%.',
      motivos: [{ nivel: 'atencao', texto: 'GPU em 90%.' }],
    });
    assert.match(html, /class="veredito vidro nivel-atencao"/);
    assert.match(html, /<h2>Atenção<\/h2>/);
    assert.match(html, /<p>GPU em 90%\.<\/p>/);
    assert.match(html, /role="status"/);
  });

  it('não repete na lista o que já está na frase; lista só o que sobrou', () => {
    const motivos = [
      { nivel: 'problema', texto: 'A.' },
      { nivel: 'atencao', texto: 'B.' },
      { nivel: 'atencao', texto: 'C.' },
    ];
    const html = veredito({ nivel: 'problema', titulo: 'Problema', frase: 'A. B.', motivos });
    assert.match(html, /<li class="motivo-atencao">C\.<\/li>/);
    assert.doesNotMatch(html, /<li[^>]*>A\.<\/li>/);
    assert.doesNotMatch(html, /<li[^>]*>B\.<\/li>/);
    assert.doesNotMatch(veredito({ nivel: 'atencao', titulo: 'x', frase: 'A. B.', motivos: motivos.slice(0, 2) }), /veredito-motivos/);
  });

  it('sem motivos não desenha lista; nível desconhecido cai no neutro', () => {
    const html = veredito({ nivel: 'qualquer', titulo: 'Sem dados', frase: 'Aguardando.', motivos: [] });
    assert.match(html, /nivel-desconhecido/);
    assert.doesNotMatch(html, /veredito-motivos/);
  });
});

describe('grupoRecolhivel', () => {
  it('nasce fechado e escapa o título', () => {
    const html = grupoRecolhivel('Detalhes <técnicos>', '<p>corpo</p>');
    assert.match(html, /<details class="status-detalhes"><summary>Detalhes &lt;técnicos&gt;<\/summary>/);
    assert.match(html, /<p>corpo<\/p>/);
  });

  it('pode nascer aberto', () => {
    assert.match(grupoRecolhivel('x', '', { aberto: true }), /<details class="status-detalhes" open>/);
  });
});
