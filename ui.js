/**
 * ui.js — Gestión de pantallas, toast, utilidades UI
 * Patagonia 360 · v6
 */
const UI = (() => {
  let _current = 'screen-home';

  function go(screenId, data = {}) {
    // Ocultar pantalla actual
    const prev = document.getElementById(_current);
    if (prev) prev.classList.remove('active');

    _current = screenId;
    const next = document.getElementById(screenId);
    if (next) {
      next.classList.add('active');
      // Scroll al tope
      const body = next.querySelector('.screen-body');
      if (body) body.scrollTop = 0;
    }

    // Hooks de ciclo de vida por pantalla
    switch (screenId) {
      case 'screen-gallery':   Gallery.render(); break;
      case 'screen-creator':   Creator.init(); break;
      case 'screen-viewer-browse': Viewer.renderBrowse(); break;
      case 'screen-tour-overview':
        if (data.tour) Viewer.renderOverview(data.tour);
        break;
    }

    // Actualizar sub-título en home
    if (screenId === 'screen-home') _updateHomeStats();
  }

  function _updateHomeStats() {
    const tours = Gallery.getAll();
    const el = document.getElementById('gallery-home-sub');
    if (!el) return;
    el.textContent = tours.length
      ? `${tours.length} recorrido${tours.length > 1 ? 's' : ''} guardado${tours.length > 1 ? 's' : ''}`
      : 'Sin recorridos guardados';
  }

  function toast(msg, type = 'ok', duration = 3000) {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-text');
    if (!t) return;
    icon.textContent = type === 'ok' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    text.textContent = msg;
    t.className = `toast toast--${type}`;
    t.classList.remove('hidden');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(() => t.classList.add('hidden'), duration);
  }

  function confirm(msg, onOk, onCancel) {
    if (window.confirm(msg)) onOk?.();
    else onCancel?.();
  }

  // Formatea metros/kilómetros
  function fmtDist(meters) {
    if (meters == null || isNaN(meters)) return '—';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // Emoji por categoría
  const CAT_EMOJI = {
    viewpoint: '🏔️', food: '🍽️', nature: '🌿',
    culture: '🏛️', sport: '🎿', hotel: '🏨', other: '📍'
  };
  function catEmoji(cat) { return CAT_EMOJI[cat] || '📍'; }

  // Tiempo estimado (4 km/h caminando)
  function estTime(meters) {
    const min = Math.round(meters / 1000 / 4 * 60);
    return min < 60 ? `${min} min` : `${(min/60).toFixed(1)} h`;
  }

  return { go, toast, confirm, fmtDist, catEmoji, estTime };
})();
