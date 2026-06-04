/**
 * ar.js — Realidad Aumentada: cámara + Device Orientation + HUD mínimo
 * Patagonia 360 · v6
 */
const AR = (() => {
  let _stream = null;
  let _currentPoi = null;
  let _lastDist = null;
  let _lastBearing = null;
  let _orientHandler = null;
  let _active = false;

  async function open() {
    const screen = document.getElementById('screen-ar');
    if (!screen) return;

    screen.classList.remove('hidden');
    _active = true;

    // Iniciar cámara
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const vid = document.getElementById('ar-video');
      if (vid) { vid.srcObject = _stream; vid.play(); }
    } catch (e) {
      UI.toast('No se pudo acceder a la cámara', 'error');
      close();
      return;
    }

    // Iniciar orientación
    _startOrientationAR();

    // Aplicar datos actuales si ya los tenemos
    if (_currentPoi) _render();
  }

  function close() {
    _active = false;
    const screen = document.getElementById('screen-ar');
    if (screen) screen.classList.add('hidden');

    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }

    _stopOrientationAR();
  }

  // Llamado desde GPS._onPosition
  function update(dist, bearing, relBearing, poi) {
    _lastDist = dist;
    _lastBearing = bearing;
    _currentPoi = poi;

    if (!_active) return;
    _renderWithBearing(relBearing);
  }

  function _render() {
    if (!_lastBearing) return;
    _renderWithBearing(_lastBearing);
  }

  function _renderWithBearing(relBearing) {
    const dist = _lastDist;
    const poi = _currentPoi;

    // Mini HUD
    const nameEl = document.getElementById('ar-poi-name-mini');
    const distEl = document.getElementById('ar-dist-mini');
    const brgEl  = document.getElementById('ar-bearing-mini');
    if (nameEl) nameEl.textContent = poi?.name ?? '—';
    if (distEl) distEl.textContent = UI.fmtDist(dist);
    if (brgEl)  brgEl.textContent  = GPS.bearingLabel(_lastBearing ?? 0);

    // Flecha
    const arrow = document.getElementById('ar-direction-arrow');
    if (arrow) {
      arrow.style.transform = `translateX(-50%) rotate(${relBearing}deg)`;
      arrow.textContent = _arrowChar(relBearing);
    }

    // POI card — solo si <100m
    const card = document.getElementById('ar-poi-card');
    if (card) {
      if (dist != null && dist < 100) {
        card.classList.remove('hidden');
        const nameCard = document.getElementById('ar-poi-name');
        const distCard = document.getElementById('ar-poi-dist');
        const icon     = document.getElementById('ar-poi-icon');
        if (nameCard) nameCard.textContent = poi?.name ?? '—';
        if (distCard) distCard.textContent = UI.fmtDist(dist);
        if (icon)     icon.textContent     = UI.catEmoji(poi?.category);

        // Imagen del POI
        if (poi?.image) {
          const img = document.getElementById('ar-poi-img');
          if (img) { img.src = poi.image; img.classList.remove('hidden'); }
        }
      } else {
        card.classList.add('hidden');
      }
    }

    // GPS signal chips
    const gpsEl = document.getElementById('ar-gps');
    const sigEl = document.getElementById('ar-signal');
    if (gpsEl) gpsEl.textContent = '●●●●';
    if (sigEl) sigEl.textContent = 'Buena';
  }

  function _arrowChar(deg) {
    const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
    return dirs[Math.round(deg / 45) % 8];
  }

  // ── Orientación para AR ───────────────────────────────

  function _startOrientationAR() {
    _orientHandler = e => {
      const heading = e.webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : 0);
      _updateCompass(heading);

      // Detectar si el teléfono mira hacia abajo (beta > 80) → sugerir GPS
      const beta = e.beta ?? 0;
      if (beta > 80) {
        const hint = document.querySelector('.ar-bottom-hud .ar-chips');
        if (hint) hint.style.opacity = '0.5';
      }
    };

    if (window.DeviceOrientationEvent?.requestPermission) {
      DeviceOrientationEvent.requestPermission()
        .then(r => {
          if (r === 'granted') window.addEventListener('deviceorientation', _orientHandler);
        })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', _orientHandler);
    }
  }

  function _stopOrientationAR() {
    if (_orientHandler) {
      window.removeEventListener('deviceorientation', _orientHandler);
      _orientHandler = null;
    }
  }

  function _updateCompass(heading) {
    const dirs = document.getElementById('compass-dirs');
    if (dirs) dirs.style.transform = `translateX(calc(-50% - ${heading * 2.5}px))`;
  }

  return { open, close, update };
})();
