// ------------------------------------------------------------
// Sinal reativo mínimo: substitui ReactiveVar/Tracker do Meteor
// sem runtime de framework. As views assinam apenas o que exibem.
// ------------------------------------------------------------

export class Sinal {
  constructor(valor) {
    this.valor = valor;
    this.assinantes = new Set();
  }

  get() {
    return this.valor;
  }

  set(proximo) {
    if (proximo === this.valor) return;
    this.valor = proximo;
    for (const assinante of [...this.assinantes]) {
      assinante(this.valor);
    }
  }

  assinar(callback) {
    this.assinantes.add(callback);
    return () => this.assinantes.delete(callback);
  }
}
