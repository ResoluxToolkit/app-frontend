import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { markdownParaHtml } from '../imports/ui/markdown.js';

describe('markdown do balão de resposta', () => {
  it('escapa HTML e formata ênfase, código e link', () => {
    const saida = markdownParaHtml(
      '<script>alert("x")</script>\n\n**Importante:** use `GET /health` — veja [contrato](/docs/api).',
    );

    assert.ok(!saida.includes('<script>'));
    assert.equal(saida, [
      '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>',
      '<p><strong>Importante:</strong> use <code>GET /health</code> — veja <a href="/docs/api" target="_blank" rel="noopener noreferrer">contrato</a>.</p>',
    ].join(''));
  });

  it('renderiza título, lista e bloco de código', () => {
    const saida = markdownParaHtml(
      '## Passos\n\n- Verificar câmera\n1. Abrir o Arena\n\n```js\nconst a = "<b>";\n```',
    );

    assert.ok(saida.includes('<h2>Passos</h2>'));
    assert.ok(saida.includes('<ul><li>Verificar câmera</li></ul>'));
    assert.ok(saida.includes('<ol><li>Abrir o Arena</li></ol>'));
    assert.ok(saida.includes('<pre data-linguagem="js"><code>const a = &quot;&lt;b&gt;&quot;;</code></pre>'));
  });
});
