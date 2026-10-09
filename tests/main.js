import assert from "assert";

describe("resolux-frontend", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "resolux-frontend");
  });

  describe("grade de clips (imports/ui/grade)", function () {
    // Shape real medido do GET /composition do Arena: parâmetros
    // embrulhados em {value: ...}, campos diretos crus.
    const composicao = {
      layers: [
        {
          active_clip: { id: 11 },
          clips: [
            {
              id: 11,
              name: { value: "Spike" },
              video: { fileinfo: { path: { value: "/media/Spike.mov" } } },
              transport: { controls: {} },
              thumbnail: { id: 5, last_update: "1696000000", is_default: false },
            },
            { id: 12, name: { value: "" } },
            {
              id: 13,
              name: { value: "Sólido" },
              transport: { controls: {} },
            },
            {
              id: 14,
              name: { value: "SemThumb" },
              transport: { controls: {} },
              thumbnail: { id: 6, last_update: "1696000000", is_default: true },
            },
            {
              id: 15,
              name: { value: "StampZero" },
              transport: { controls: {} },
              thumbnail: { id: 7, last_update: "0", is_default: false },
            },
          ],
        },
        { clips: [] },
      ],
    };

    it("monta endereços camada.coluna na ordem do Arena", async function () {
      const { montarGrade } = await import("../imports/ui/grade.js");
      const grade = montarGrade(composicao);
      assert.strictEqual(grade.camadas.length, 2);
      assert.deepStrictEqual(
        grade.camadas[0].celulas.map((c) => c.id),
        ["1.1", "1.2", "1.3", "1.4", "1.5"],
      );
      assert.strictEqual(grade.camadas[1].celulas.length, 0);
    });

    it("classifica preenchido, vazio e generator como a engine", async function () {
      const { montarGrade } = await import("../imports/ui/grade.js");
      const celulas = montarGrade(composicao).camadas[0].celulas;
      assert.strictEqual(celulas[0].preenchido, true); // mídia em disco
      assert.strictEqual(celulas[1].preenchido, false); // slot vazio
      assert.strictEqual(celulas[2].preenchido, true); // generator
    });

    it("marca só o clip do active_clip como tocando", async function () {
      const { montarGrade } = await import("../imports/ui/grade.js");
      const grade = montarGrade(composicao);
      const celulas = grade.camadas[0].celulas;
      assert.strictEqual(celulas[0].ativo, true);
      assert.ok(celulas.slice(1).every((c) => !c.ativo));
      assert.deepStrictEqual(grade.ativo, { nome: "Spike", endereco: "1.1" });
    });

    it("só aceita thumbnail com id e last_update válidos", async function () {
      const { montarGrade } = await import("../imports/ui/grade.js");
      const celulas = montarGrade(composicao).camadas[0].celulas;
      assert.deepStrictEqual(celulas[0].thumb, { id: 5, stamp: "1696000000" });
      assert.strictEqual(celulas[2].thumb, null); // sem bloco thumbnail
      assert.strictEqual(celulas[3].thumb, null); // is_default
      assert.strictEqual(celulas[4].thumb, null); // stamp "0"
    });

    it("mock do backend empurra a composição de exemplo via assinatura", async function () {
      const { montarGrade } = await import("../imports/ui/grade.js");
      const { MockDaemon } = await import("../imports/api/mock.js");
      const backend = new MockDaemon();
      const composicao = await new Promise((resolve) => {
        const inscricao = backend.assinarMonitor({ onDados: resolve });
        inscricao.cancelar();
      });
      const grade = montarGrade(composicao);
      assert.strictEqual(grade.camadas.length, 3);
      assert.ok(grade.camadas.every((c) => c.celulas.length === 9));
      const preenchidos = grade.camadas
        .flatMap((c) => c.celulas)
        .filter((cel) => cel.preenchido).length;
      assert.strictEqual(preenchidos, 15);
      assert.strictEqual(grade.ativo, null);
      // Mock não finge thumbnail de Arena.
      assert.strictEqual(backend.urlThumbnail(1, "x"), null);
    });

    it("cancelar a assinatura do mock para o fluxo de dados", async function () {
      const { MockDaemon } = await import("../imports/api/mock.js");
      const backend = new MockDaemon();
      let chamadas = 0;
      const inscricao = backend.assinarMonitor({ onDados: () => chamadas++ });
      inscricao.cancelar();
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.strictEqual(chamadas, 1); // só o poll inicial síncrono
    });
  });

  describe("zoom da grade (imports/ui/store)", function () {
    it("clamp: nem abaixo do piso nem acima do teto", async function () {
      const { zoomGrade, ajustarZoom, resetarZoom, ZOOM_MIN, ZOOM_MAX } =
        await import("../imports/ui/store.js");
      ajustarZoom(99);
      assert.strictEqual(zoomGrade.get(), ZOOM_MAX);
      ajustarZoom(0.01);
      assert.strictEqual(zoomGrade.get(), ZOOM_MIN);
      resetarZoom();
      assert.strictEqual(zoomGrade.get(), 1);
    });
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });
  }
});
