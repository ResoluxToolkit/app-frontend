// ------------------------------------------------------------
// Fachada do backend da UI: sonda o daemon uma vez na abertura
// e escolhe motor real ou mock. A decisão fica visível na topbar
// — esconder de qual motor veio a resposta é bug de produto.
// ------------------------------------------------------------

import { ReactiveVar } from 'meteor/reactive-var';

import { ResoluxDaemon } from '/imports/api/client';
import { MockDaemon } from '/imports/api/mock';
import { montarGrade } from '/imports/ui/grade';

const daemon = new ResoluxDaemon();
const mock = new MockDaemon();

// 'sondando' | 'daemon' | 'mock'
export const backendAtivo = new ReactiveVar('sondando');

let escolhido = mock;

export function obterBackend() {
  return escolhido;
}

// ------------------------------------------------------------
// Sessão do motor (GET/PATCH /api/v1/session)
// ------------------------------------------------------------

export const sessaoMotor = new ReactiveVar(null);
export const ferramentasMotor = new ReactiveVar([]);
export const salvandoSessao = new ReactiveVar(false);
export const erroSessao = new ReactiveVar(null);

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

export async function sondarBackend() {
  backendAtivo.set('sondando');
  const dePe = await daemon.sondar();
  escolhido = dePe ? daemon : mock;
  backendAtivo.set(dePe ? 'daemon' : 'mock');
  await Promise.all([carregarSessao(), carregarFerramentas()]);
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
export const estadoMonitor = new ReactiveVar('parado');
export const gradeMonitor = new ReactiveVar(null);
export const ultimoPollMonitor = new ReactiveVar(null);
export const erroMonitor = new ReactiveVar(null);

// Retorna { cancelar() }. Quem abre a tela assina; quem fecha cancela.
export function assinarMonitorGrade() {
  estadoMonitor.set('pollando');
  return obterBackend().assinarMonitor({
    onDados(composicao) {
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
      gradeMonitor.set(grade);
      ultimoPollMonitor.set(new Date());
      erroMonitor.set(null);
      estadoMonitor.set('ok');
    },
    onErro(codigo, mensagem) {
      erroMonitor.set(`${codigo}: ${mensagem}`);
      estadoMonitor.set('erro');
    },
  });
}
