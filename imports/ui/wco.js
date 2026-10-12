// ------------------------------------------------------------
// Window Controls Overlay: só ativa o modo “topbar = barra de
// título” quando o Chromium instalado realmente expõe a geometria.
// Navegador comum e iOS continuam com o layout atual.
// ------------------------------------------------------------

const CLASSE_WCO = 'wco-ativo';

export function overlayDeControlesDisponivel() {
  return 'windowControlsOverlay' in globalThis.navigator;
}

function atualizarModoWco() {
  const overlay = globalThis.navigator?.windowControlsOverlay;
  document.documentElement.classList.toggle(CLASSE_WCO, overlay?.visible === true);
}

export function iniciarControlesJanela() {
  const overlay = globalThis.navigator?.windowControlsOverlay;
  if (!overlay) return null;

  atualizarModoWco();
  let agendamento = null;
  const reagir = () => {
    clearTimeout(agendamento);
    agendamento = setTimeout(atualizarModoWco, 200);
  };
  overlay.addEventListener('geometrychange', reagir);
  return {
    cancelar() {
      clearTimeout(agendamento);
      overlay.removeEventListener('geometrychange', reagir);
    },
  };
}
