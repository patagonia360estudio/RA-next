/**
 * viewer.js — Vista del recorrido, navegación secuencial, llegada, finalización
 * Patagonia 360 · v6
 */
const Viewer = (() => {
  let currentTour = null;
  let _currentPoiIdx = 0;
  let _overviewMap = null;
  let _browseMap = null;

  // ── OVERVIEW MAP ──────────────────────────────────────

  function renderOverview(tour) {
    currentTour = tour;
    _currentPoiIdx = 0;

    // Actualizar textos
    _setText('overview-tour-title', tour.name);
    _setText('overview-tour-desc', tour.description || 'Sin descripción');

    const pois = tour.pois;
    const totalDist = GPS.totalDistance(pois);
    _setText('overview-poi-count', pois.length);
    _setText('overview-total-dist', UI.fmtDist(totalDist));
    _setText('overview-est-time', UI.estTime(totalDist));
    _setText('overview-poi-badge', `${pois.length} pts`);

    // Lista de paradas
    const listEl = document.getElementById('overview-poi-list');
    if (listEl) {
      listEl.innerHTML = pois.map((poi, i) => {
        const distNext = i < pois.length - 1
          ? GPS.haversine(poi.lat, poi.lng, pois[i+1].lat, pois[i+1].lng)
          : null;
        return `
          <div class="overview-poi-row">
            <div class="opr-num">${i+1}</div>
            <div class="opr-body">
              ${poi.image ? `<img src="${poi.image}" class="opr-thumb" alt="">` : `<div class="opr-thumb-ph">${UI.catEmoji(poi.category)}</div>`}
              <div class="opr-info">
                <span class="opr-name">${poi.name}</span>
                <span class="opr-meta">${UI.catEmoji(poi.category)}</span>
                ${poi.description ? `<span class="opr-desc">${poi.description}</span>` : ''}
              </div>
              ${distNext != null ? `<div class="opr-dist-next"><span>↓</span> ${UI.fmtDist(distNext)}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    // Mapa overview
    setTimeout(() => _initOverviewMap(tour), 100);
  }

  function _initOverviewMap(tour) {
    if (_overviewMap) { _overviewMap.remove(); _overviewMap = null; }
    const el = document.getElementById('overview-map');
    if (!el) return;

    _overviewMap = L.map('overview-map', {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false
    }).setView([-41.1335, -71.3103], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_overviewMap);

    const pois = tour.pois;
    const latlngs = [];

    pois.forEach((poi, idx) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:26px;height:26px;border-radius:50%;
          background:${idx === 0 ? '#22d68a' : idx === pois.length-1 ? '#e8b84b' : '#021a10'};
          border:2px solid ${idx === 0 ? '#fff' : '#e8b84b'};
          display:flex;align-items:center;justify-content:center;
          color:${idx === 0 ? '#021a10' : '#e8b84b'};
          font-size:11px;font-weight:700;
          box-shadow:0 2px 8px rgba(0,0,0,.5)">
          ${idx+1}
        </div>`,
        iconSize: [26, 26], iconAnchor: [13, 13]
      });
      L.marker([poi.lat, poi.lng], { icon }).addTo(_overviewMap)
        .bindPopup(`<strong>${idx+1}. ${poi.name}</strong>`);
      latlngs.push([poi.lat, poi.lng]);
    });

    if (latlngs.length >= 2) {
      L.polyline(latlngs, { color: '#e8b84b', weight: 2.5, dashArray: '7,5', opacity: 0.8 }).addTo(_overviewMap);
    }

    if (latlngs.length > 0) {
      if (latlngs.length === 1) _overviewMap.setView(latlngs[0], 15);
      else _overviewMap.fitBounds(L.latLngBounds(latlngs), { padding: [24, 24] });
    }
  }

  // ── BROWSE MAP ────────────────────────────────────────

  function renderBrowse() {
    const tours = Gallery.getAll();
    const list  = document.getElementById('browse-list');
    const empty = document.getElementById('browse-empty');
    if (!list) return;

    list.innerHTML = '';
    if (tours.length === 0) {
      if (empty) empty.style.display = 'block';
    } else {
      if (empty) empty.style.display = 'none';
      tours.forEach(tour => {
        const card = document.createElement('div');
        card.className = 'browse-card';
        const dist = GPS.totalDistance(tour.pois);
        card.innerHTML = `
          <div class="bc-info">
            <span class="bc-name">${tour.name}</span>
            <span class="bc-meta">${tour.pois.length} paradas · ${UI.fmtDist(dist)} · ${UI.estTime(dist)}</span>
          </div>
          <button class="btn btn-green btn-sm" onclick="Viewer.renderOverview(Gallery.getById('${tour.id}')); UI.go('screen-tour-overview')">
            Ver →
          </button>
        `;
        list.appendChild(card);
      });
    }

    // Mapa browse
    setTimeout(() => _initBrowseMap(tours), 100);
  }

  function _initBrowseMap(tours) {
    if (_browseMap) { _browseMap.remove(); _browseMap = null; }
    const el = document.getElementById('browse-map');
    if (!el) return;

    _browseMap = L.map('browse-map', {
      zoomControl: false, attributionControl: false, scrollWheelZoom: false
    }).setView([-41.1335, -71.3103], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_browseMap);

    const allLatLngs = [];
    tours.forEach(tour => {
      const latlngs = tour.pois.map(p => [p.lat, p.lng]);
      allLatLngs.push(...latlngs);
      if (latlngs.length >= 2) {
        L.polyline(latlngs, { color: '#e8b84b', weight: 2, opacity: 0.6 }).addTo(_browseMap);
      }
      tour.pois.forEach((poi, i) => {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:10px;height:10px;border-radius:50%;background:#22d68a;border:1.5px solid #fff"></div>`,
          iconSize: [10, 10], iconAnchor: [5, 5]
        });
        L.marker([poi.lat, poi.lng], { icon }).addTo(_browseMap)
          .bindPopup(`<strong>${tour.name}</strong><br>${poi.name}`);
      });
    });

    if (allLatLngs.length > 0) {
      _browseMap.fitBounds(L.latLngBounds(allLatLngs), { padding: [20, 20] });
    }
  }

  // ── INICIAR RECORRIDO ─────────────────────────────────

  function startTour() {
    if (!currentTour || currentTour.pois.length === 0) {
      UI.toast('Este recorrido no tiene puntos', 'error');
      return;
    }
    _currentPoiIdx = 0;
    _navigateToPoi(_currentPoiIdx);
  }

  function _navigateToPoi(idx) {
    const poi = currentTour.pois[idx];
    if (!poi) return;

    // Actualizar título de nav
    _setText('nav-title', poi.name);

    // Progreso
    const total = currentTour.pois.length;
    const pct = total > 1 ? (idx / (total - 1)) * 100 : 100;
    const fill = document.getElementById('nav-progress-fill');
    const label = document.getElementById('nav-progress-label');
    if (fill)  fill.style.width = `${pct}%`;
    if (label) label.textContent = `${idx + 1} / ${total}`;

    // Iniciar GPS
    GPS.startNav(poi, () => {
      // Callback proximidad — solo notificar, no navegar automáticamente
    });

    UI.go('screen-nav');
  }

  // ── LLEGADA ───────────────────────────────────────────

  function handleArrival() {
    GPS.stopNav();
    const poi = currentTour?.pois[_currentPoiIdx];
    if (!poi) return;

    const total = currentTour.pois.length;
    const isLast = _currentPoiIdx >= total - 1;
    const nextPoi = !isLast ? currentTour.pois[_currentPoiIdx + 1] : null;

    // Llenar pantalla arrival
    _setText('arr-title', poi.name);
    _setText('arr-desc', poi.description || 'Sin descripción disponible.');
    _setText('arr-stop-num', `${_currentPoiIdx + 1} / ${total}`);
    _setText('arrival-stop-badge', `Parada ${_currentPoiIdx + 1}`);

    const catBadge = document.getElementById('arr-category-badge');
    if (catBadge) catBadge.textContent = `${UI.catEmoji(poi.category)} ${poi.category}`;

    // Imagen
    const img = document.getElementById('arrival-img');
    const placeholder = document.getElementById('arrival-img-placeholder');
    const catEmoji = document.getElementById('arrival-cat-emoji');
    if (poi.image) {
      if (img) { img.src = poi.image; img.classList.remove('hidden'); }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (img) img.classList.add('hidden');
      if (placeholder) placeholder.style.display = 'flex';
      if (catEmoji) catEmoji.textContent = UI.catEmoji(poi.category);
    }

    // Próxima distancia
    if (nextPoi) {
      const d = GPS.haversine(poi.lat, poi.lng, nextPoi.lat, nextPoi.lng);
      _setText('arr-next-dist', UI.fmtDist(d));
    } else {
      _setText('arr-next-dist', '—');
    }

    // Botones
    const nextBtn   = document.getElementById('arr-next-btn');
    const finishBtn = document.getElementById('arr-finish-btn');
    if (nextBtn)   nextBtn.style.display   = isLast ? 'none' : 'block';
    if (finishBtn) finishBtn.style.display = isLast ? 'block' : 'none';
    if (nextBtn)   nextBtn.textContent = nextPoi ? `Siguiente: ${nextPoi.name} →` : 'Siguiente parada →';

    UI.go('screen-arrival');
    UI.toast(`¡Llegaste a ${poi.name}! ✓`, 'ok', 3000);
  }

  function nextPoi() {
    if (!currentTour) return;
    _currentPoiIdx++;
    if (_currentPoiIdx < currentTour.pois.length) {
      _navigateToPoi(_currentPoiIdx);
    } else {
      finishTour();
    }
  }

  function finishTour() {
    GPS.stopNav();
    const tour = currentTour;
    if (!tour) return;

    _setText('finish-tour-name', tour.name);
    _setText('finish-pois', tour.pois.length);
    _setText('finish-dist', UI.fmtDist(GPS.totalDistance(tour.pois)));

    UI.go('screen-finish');
    UI.toast('¡Recorrido completado! 🏁', 'ok', 4000);
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  return {
    get currentTour() { return currentTour; },
    renderOverview, renderBrowse,
    startTour, handleArrival, nextPoi, finishTour
  };
})();
