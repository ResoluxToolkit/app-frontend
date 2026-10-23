// ------------------------------------------------------------
// Monitor do sistema (CPU/RAM/GPU/rede/portas/NDI/MIDI/Art-Net/
// captura/áudio/displays). O feed é SSE do motor em `/monitor`:
// na mesma origem (dev usa o proxy do Vite; produção é servida
// pelo próprio daemon). A UI não abre sockets por conta própria —
// assina a fachada e recebe o contrato v1 pronto.
// ------------------------------------------------------------

import { Sinal } from '../ui/signal.js';
import { comToken, conferirToken } from './acesso.js';

// 'parado' | 'conectando' | 'ok' | 'offline'
export const estadoSistema = new Sinal('parado');
export const contratoSistema = new Sinal(null);
export const erroSistema = new Sinal(null);
export const historicoCpu = new Sinal([]);
export const historicoMemoria = new Sinal([]);
export const historicoGpu = new Sinal([]);

const LIMITE_HISTORICO_SISTEMA = 60;

const URL_PADRAO =
  typeof window !== 'undefined' && window.location.protocol.startsWith('http')
    ? '/monitor'
    : 'http://127.0.0.1:1980/monitor';

function horaCurta(data) {
  const partes = (valor) => String(valor).padStart(2, '0');
  return `${partes(data.getHours())}:${partes(data.getMinutes())}:${partes(data.getSeconds())}`;
}

function adicionarAmostraHistorico(historico, contrato, valorBruto) {
  const valor = Number(valorBruto);
  if (!Number.isFinite(valor) || valor < 0 || valor > 100) return;

  const tempo = new Date(contrato.capturedAt ?? '');
  const hora = Number.isNaN(tempo.getTime()) ? horaCurta(new Date()) : horaCurta(tempo);
  const amostra = { hora, valor: Math.round(valor * 10) / 10 };
  const atual = historico.get();
  const ultima = atual.at(-1);

  if (ultima?.hora === hora) {
    historico.set([...atual.slice(0, -1), amostra]);
    return;
  }

  historico.set([...atual, amostra].slice(-LIMITE_HISTORICO_SISTEMA));
}

function adicionarAmostraCpu(contrato) {
  adicionarAmostraHistorico(historicoCpu, contrato, contrato.cpu?.usagePercent);
}

function adicionarAmostraMemoria(contrato) {
  const memoria = contrato.memory;
  const total = Number(memoria?.totalBytes);
  const usada = Number(memoria?.usedBytes);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(usada)) return;
  adicionarAmostraHistorico(historicoMemoria, contrato, (usada / total) * 100);
}

function adicionarAmostraGpu(contrato) {
  const dispositivo = contrato.gpu?.devicePercent;
  if (dispositivo == null) return;
  adicionarAmostraHistorico(historicoGpu, contrato, dispositivo);
}

// Parse do contrato v1 do motor. JSON ruim fica visível na cara
// (erroSistema), não quebra a página nem limpa o último dado bom.
export function aplicarContratoSistema(evento) {
  const texto = typeof evento === 'string' ? evento : evento?.data ?? '';
  try {
    const contrato = JSON.parse(texto);
    if (!contrato || typeof contrato !== 'object' || contrato.contractVersion !== 1) {
      throw new Error(`contractVersion inesperado: ${contrato?.contractVersion ?? 'ausente'}`);
    }
    contratoSistema.set(contrato);
    adicionarAmostraCpu(contrato);
    adicionarAmostraMemoria(contrato);
    adicionarAmostraGpu(contrato);
    erroSistema.set(null);
    estadoSistema.set('ok');
    return contrato;
  } catch (e) {
    erroSistema.set(e.message);
    return null;
  }
}

// Quem abre a tela assina; quem fecha cancela. A reconexão é do
// EventSource; no offline mantemos o último contrato na tela —
// o motor parou de coletar, não apagamos o que já vimos.
// (CriadorFonte/url injetáveis para o teste no Node.)
export function assinarSistema(CriadorFonte = EventSource, url = URL_PADRAO) {
  estadoSistema.set('conectando');
  // EventSource não leva header: o token do aparelho vai na query.
  const fonte = new CriadorFonte(comToken(url));
  fonte.onopen = () => {
    erroSistema.set(null);
    estadoSistema.set('ok');
  };
  fonte.onmessage = (evento) => aplicarContratoSistema(evento);
  fonte.onerror = () => {
    estadoSistema.set('offline');
    conferirToken();
  };
  return {
    cancelar() {
      fonte.close();
      estadoSistema.set('parado');
    },
  };
}

// Formatação de dados do contrato — sem DOM, testável no Node.
export function formatarBytes(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return '—';
  if (numero < 1024) return `${Math.round(numero)} B`;
  const unidades = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let escala = numero;
  let indice = -1;
  do {
    escala /= 1024;
    indice += 1;
  } while (escala >= 1024 && indice < unidades.length - 1);
  return `${escala.toFixed(escala >= 10 ? 0 : 1)} ${unidades[indice]}`;
}

export function formatarTaxa(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return `${formatarBytes(numero)}/s`;
}

export function formatarPct(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return `${Math.round(numero)}%`;
}
