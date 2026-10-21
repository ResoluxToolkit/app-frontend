// ------------------------------------------------------------
// Fachada do backend da UI: sonda o daemon uma vez na abertura
// e escolhe motor real ou mock. A decisão fica visível na topbar
// — esconder de qual motor veio a resposta é bug de produto.
// ------------------------------------------------------------

import { Sinal } from '../ui/signal.js';

import { ResoluxDaemon } from './client.js';
import { MockDaemon } from './mock.js';
import { lerCodigoPareamento, limparCodigoDaUrl } from '../ui/remoto.js';
import { montarGrade, mesmaGrade, progressosTimeGrid } from '../ui/grade.js';

import { aoEsquecerToken, lerToken } from './acesso.js';

export { cabecalhosAcesso } from './acesso.js';

export {
  estadoSistema,
  contratoSistema,
  erroSistema,
  historicoCpu,
  historicoMemoria,
  historicoGpu,
  assinarSistema,
  formatarBytes,
  formatarTaxa,
  formatarPct,
} from './monitorSistema.js';

const daemon = new ResoluxDaemon();
const mock = new MockDaemon();

// 'sondando' | 'daemon' | 'mock'
export const backendAtivo = new Sinal('sondando');

let escolhido = mock;

export function obterBackend() {
  return escolhido;
}

// ------------------------------------------------------------
// Sessão do motor (GET/PATCH /api/v1/session)
// ------------------------------------------------------------

export const sessaoMotor = new Sinal(null);
export const ferramentasMotor = new Sinal([]);
export const salvandoSessao = new Sinal(false);
export const erroSessao = new Sinal(null);

export async function carregarSessao() {
  try {
    sessaoMotor.set(await obterBackend().getSession());
    erroSessao.set(null);
  } catch (e) {
    sessaoMotor.set(null);
    erroSessao.set(`${e.codigo || 'erro'}: ${e.message}`);
  }
}

export async function carregarFerramentas() {
  try {
    const corpo = await obterBackend().getTools();
    ferramentasMotor.set(corpo.tools || []);
  } catch (_) {
    ferramentasMotor.set([]);
  }
}

export async function atualizarSessao(patch) {
  salvandoSessao.set(true);
  erroSessao.set(null);
  try {
    sessaoMotor.set(await obterBackend().patchSession(patch));
    return true;
  } catch (e) {
    // Recusa do motor aparece na cara, não no console.
    erroSessao.set(`${e.codigo || 'erro'}: ${e.message}`);
    return false;
  } finally {
    salvandoSessao.set(false);
  }
}

// ------------------------------------------------------------
// Pareamento do celular
// ------------------------------------------------------------

// Código rotativo do QR, pedido a quem estiver respondendo (no Mac).
export function obterPareamento() {
  return obterBackend().obterPareamento();
}

// 'nenhum' | 'pareando' | 'pareado' | 'recusado' | 'limitado' | 'sem_resposta'
// Recarregar o celular (sem `?p=`) mantém "pareado" enquanto o token
// salvo existir; um 401 apaga o token e volta para 'nenhum'.
export const estadoPareamento = new Sinal(lerToken() ? 'pareado' : 'nenhum');
aoEsquecerToken(() => estadoPareamento.set('nenhum'));

// O celular abriu a URL do QR: devolve o código ao motor real (só ele
// valida; o mock não existe para outro aparelho) e guarda o token.
// Roda antes da sonda, para a sessão já nascer autorizada.
export async function concluirPareamentoDaUrl(loc) {
  const codigo = lerCodigoPareamento(loc);
  if (!codigo) return;
  limparCodigoDaUrl();
  await parearComCodigo(codigo);
}

// Troca o código pelo token deste aparelho. Devolve true se pareou.
export async function parearComCodigo(codigo) {
  estadoPareamento.set('pareando');
  try {
    await daemon.parear(codigo);
    estadoPareamento.set('pareado');
    return true;
  } catch (e) {
    const porCodigo = { rate_limited: 'limitado', sem_resposta: 'sem_resposta' };
    estadoPareamento.set(porCodigo[e?.codigo] || 'recusado');
    return false;
  }
}

// Quem pode ver o painel: 'verificando' | 'liberado' | 'sem_pareamento' | 'motor_fora'.
// O motor só protege os dados; sem esta trava o celular via a casca do
// app (ou o mock inteiro, com o motor fora) e parecia ter entrado.
export const acessoPainel = new Sinal('verificando');

// O mock só serve para desenvolver no próprio Mac. Aberto pela rede, o
// mock faria um aparelho não pareado "entrar" num painel falso.
export function hostLocal(loc = typeof window !== 'undefined' ? window.location : undefined) {
  const host = loc?.hostname ?? '';
  return host === '' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

aoEsquecerToken(() => {
  if (escolhido === daemon) acessoPainel.set('sem_pareamento');
});

export async function sondarBackend(loc) {
  backendAtivo.set('sondando');
  const dePe = await daemon.sondar();
  if (!dePe && !hostLocal(loc)) {
    escolhido = daemon;
    backendAtivo.set('daemon');
    acessoPainel.set('motor_fora');
    return escolhido;
  }
  escolhido = dePe ? daemon : mock;
  backendAtivo.set(dePe ? 'daemon' : 'mock');
  // `/health` é público; `/session` diz se este aparelho tem acesso.
  // No Mac o motor nunca responde 401.
  try {
    sessaoMotor.set(await escolhido.getSession());
    erroSessao.set(null);
  } catch (e) {
    if (e?.codigo === 'unauthorized') {
      acessoPainel.set('sem_pareamento');
      return escolhido;
    }
    sessaoMotor.set(null);
    erroSessao.set(`${e.codigo || 'erro'}: ${e.message}`);
  }
  acessoPainel.set('liberado');
  await carregarFerramentas();
  return escolhido;
}

// ------------------------------------------------------------
// Monitor do Arena — leitura pura, empurrada pelo motor.
// A UI não poll nem fala com o Arena: ela ASSINA o monitor na
// fachada e recebe as atualizações (o daemon é dono do poll de
// 1 s no Arena). Erro fica visível e a última grade boa continua
// na tela (o Arena fechado não pode apagar o que já vimos).
// ------------------------------------------------------------

// 'parado' | 'pollando' | 'ok' | 'erro'
export const estadoMonitor = new Sinal('parado');
export const gradeMonitor = new Sinal(null);
export const ultimoPollMonitor = new Sinal(null);
export const erroMonitor = new Sinal(null);
// Barras de progresso da TimeGrid: [{ endereco, progresso }] — fora do
// modelo da grade de propósito: position muda a cada tick e não pode
// forçar re-render (as thumbnails seriam recriadas).
export const progressoGrade = new Sinal([]);

// Retorna { cancelar() }. Quem abre a tela assina; quem fecha cancela.
// Sem dado nem erro do motor nesse prazo, a tela diz o que está
// acontecendo em vez de "Sondando o Arena…" para sempre (o motor atual
// não responde ao monitor.subscribe quando o Arena está fechado).
export const PRAZO_PRIMEIRA_GRADE_MS = 8000;

export function assinarMonitorGrade() {
  estadoMonitor.set('pollando');
  const prazo = setTimeout(() => {
    if (!gradeMonitor.get() && !erroMonitor.get()) {
      erroMonitor.set('sem_resposta: o motor não mandou a composição. O Arena pode estar fechado.');
      estadoMonitor.set('erro');
    }
  }, PRAZO_PRIMEIRA_GRADE_MS);
  const inscricao = obterBackend().assinarMonitor({
    onDados(composicao) {
      clearTimeout(prazo);
      const grade = montarGrade(composicao);
      const backend = obterBackend();
      // Só o daemon real tem URL de thumbnail; o mock devolve null e
      // a célula cai pra exibir só o nome — sem fingir thumb. Quando
      // o feed WS do motor chegar, as thumbs vêm junto no canal e
      // este remendo de URL por HTTP de teste sai.
      for (const camada of grade.camadas) {
        for (const celula of camada.celulas) {
          celula.thumbUrl =
            celula.thumb && backend.urlThumbnail
              ? backend.urlThumbnail(celula.thumb.id, celula.thumb.stamp)
              : null;
        }
      }
      // Barra antes da grade: se o clip ativo mudou, o render nasce já
      // com o progresso novo; ticks seguintes só movem o preenchimento.
      progressoGrade.set(progressosTimeGrid(composicao));
      // O daemon compara o JSON bruto do Arena, que muda por causa do
      // transporte/parâmetros. Aqui só atualizamos o que a grade exibe;
      // sem isso, <img> é recriado a cada tick e a thumb pisca.
      if (!mesmaGrade(gradeMonitor.get(), grade)) {
        ultimoPollMonitor.set(new Date());
        gradeMonitor.set(grade);
      }
      erroMonitor.set(null);
      estadoMonitor.set('ok');
    },
    onErro(codigo, mensagem) {
      clearTimeout(prazo);
      erroMonitor.set(`${codigo}: ${mensagem}`);
      estadoMonitor.set('erro');
    },
  });
  return {
    cancelar() {
      clearTimeout(prazo);
      inscricao.cancelar();
    },
  };
}
