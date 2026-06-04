/**
 * creator.js — Creación de recorridos con múltiples POIs
 * Patagonia 360 · v6
 */
const Creator = (() => {
  let _tour = _emptyTour();
  let _map = null;
  let _markers = [];
  let _polyline = null;
  let _pendingLatLng = null;
  let _editingIdx = null;
  let _photoDataURL = null;

  function _emptyTour() {
    return { id: null, name: '', description: '', pois: [], createdAt: null };
  }

  // ── Init ─────────────────────────────────────────────

  function init() {
    _tour = _emptyTour();
    _photoDataURL = null;
    _editingIdx = null;

    // Limpiar formularios
    _el('tour-name-input').value = '';
    _el('tour-desc-input').value = '';
    _resetPoiForm();
    _renderPoiList();
    _updateActions();

    // Init mapa creator
    if (_map) { _map.remove(); _map = null; }
    const el = document.getElementById('creator-map');
    if (!el) return;

    _map = L.map('creator-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([-41.1335, -71.3103], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_map);
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    // Click en mapa → pre-llenar coordenadas
    _map.on('click', e => {
      _pendingLatLng = e.latlng;
      _el('poi-lat-input').value = e.latlng.lat.toFixed(6);
      _el('poi-lng-input').value = e.latlng.lng.toFixed(6);
      // Abrir formulario si no está abierto
      const form = document.getElementById('add-poi-form');
      if (form && form.getAttribute('aria-hidden') === 'true') togglePoiForm();
      UI.toast('Coordenadas cargadas desde el mapa 📍', 'ok', 2000);
    });
  }

  // ── Formulario POI ────────────────────────────────────

  function togglePoiForm() {
    const form = document.getElementById('add-poi-form');
    const btn  = document.getElementById('btn-add-poi');
    if (!form) return;
    const open = form.getAttribute('aria-hidden') === 'false';
    form.setAttribute('aria-hidden', open ? 'true' : 'false');
    btn?.setAttribute('aria-expanded', !open);
    form.style.display = open ? 'none' : 'block';
    if (!open) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelPoiForm() {
    const form = document.getElementById('add-poi-form');
    if (form) { form.setAttribute('aria-hidden', 'true'); form.style.display = 'none'; }
    document.getElementById('btn-add-poi')?.setAttribute('aria-expanded', 'false');
    _resetPoiForm();
  }

  function _resetPoiForm() {
    ['poi-name-input','poi-desc-input'].forEach(id => { const e = _el(id); if (e) e.value = ''; });
    ['poi-lat-input','poi-lng-input'].forEach(id => { const e = _el(id); if (e) e.value = ''; });
    const cat = _el('poi-cat-input'); if (cat) cat.value = 'other';
    const preview = document.getElementById('photo-preview');
    if (preview) preview.classList.add('hidden');
    const badge = document.getElementById('exif-badge');
    if (badge) { badge.textContent = 'Sin GPS EXIF'; badge.className = 'exif-badge exif-none'; }
    _photoDataURL = null;
    _pendingLatLng = null;
    _editingIdx = null;
  }

  async function onPhotoSelected(input) {
    const file = input.files[0];
    if (!file) return;

    // Mostrar preview
    const reader = new FileReader();
    reader.onload = e => {
      _photoDataURL = e.target.result;
      const img = document.getElementById('preview-img');
      if (img) img.src = _photoDataURL;
      document.getElementById('photo-preview')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);

    // Leer EXIF GPS
    try {
      if (window.exifr) {
        const gps = await exifr.gps(file);
        const badge = document.getElementById('exif-badge');
        if (gps?.latitude && gps?.longitude) {
          _el('poi-lat-input').value = gps.latitude.toFixed(6);
          _el('poi-lng-input').value = gps.longitude.toFixed(6);
          if (badge) { badge.textContent = '✓ GPS del EXIF'; badge.className = 'exif-badge exif-ok'; }
          UI.toast('Coordenadas GPS leídas de la foto ✓', 'ok', 2500);
        } else {
          if (badge) { badge.textContent = 'Sin GPS EXIF'; badge.className = 'exif-badge exif-none'; }
        }
      }
    } catch (e) { console.warn('EXIF error:', e); }
  }

  function useMyLocation() {
    if (!navigator.geolocation) { UI.toast('GPS no disponible', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        _el('poi-lat-input').value = pos.coords.latitude.toFixed(6);
        _el('poi-lng-input').value = pos.coords.longitude.toFixed(6);
        UI.toast('Ubicación actual cargada ✓', 'ok', 2000);
      },
      () => UI.toast('No se pudo obtener ubicación', 'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function confirmAddPoi() {
    const name = _el('poi-name-input').value.trim();
    const lat  = parseFloat(_el('poi-lat-input').value);
    const lng  = parseFloat(_el('poi-lng-input').value);
    const desc = _el('poi-desc-input').value.trim();
    const cat  = _el('poi-cat-input').value;

    if (!name) { UI.toast('El nombre es obligatorio', 'error'); return; }
    if (isNaN(lat) || isNaN(lng)) { UI.toast('Ingresá coordenadas válidas o tocá el mapa', 'error'); return; }

    const poi = {
      id: Date.now().toString(36),
      name, description: desc, category: cat,
      lat, lng,
      image: _photoDataURL,
      order: _tour.pois.length
    };

    if (_editingIdx !== null) {
      poi.id = _tour.pois[_editingIdx].id;
      poi.order = _tour.pois[_editingIdx].order;
      _tour.pois[_editingIdx] = poi;
    } else {
      _tour.pois.push(poi);
    }

    cancelPoiForm();
    _renderPoiList();
    _updateMapMarkers();
    _updateActions();
    UI.toast(`Punto "${name}" agregado ✓`, 'ok');
  }

  // ── Render lista POIs ─────────────────────────────────

  function _renderPoiList() {
    const list = document.getElementById('creator-poi-list');
    const empty = document.getElementById('creator-empty');
    const count = document.getElementById('poi-count');
    if (!list) return;

    const pois = _tour.pois;
    if (count) count.textContent = `${pois.length} punto${pois.length !== 1 ? 's' : ''}`;

    if (pois.length === 0) {
      if (empty) empty.style.display = 'block';
      // Limpiar lista excepto el empty
      [...list.querySelectorAll('.creator-poi-item')].forEach(e => e.remove());
      _updateDistances();
      return;
    }
    if (empty) empty.style.display = 'none';

    // Reconstruir lista
    [...list.querySelectorAll('.creator-poi-item')].forEach(e => e.remove());

    pois.forEach((poi, idx) => {
      const item = document.createElement('div');
      item.className = 'creator-poi-item';
      item.dataset.idx = idx;

      const isLast = idx === pois.length - 1;
      item.innerHTML = `
        <div class="cpi-sequence">
          <div class="cpi-number">${idx + 1}</div>
          ${!isLast ? '<div class="cpi-line"></div>' : ''}
        </div>
        <div class="cpi-body">
          ${poi.image ? `<img src="${poi.image}" class="cpi-thumb" alt="">` : `<div class="cpi-thumb-placeholder">${UI.catEmoji(poi.category)}</div>`}
          <div class="cpi-info">
            <span class="cpi-name">${poi.name}</span>
            <span class="cpi-meta">${UI.catEmoji(poi.category)} ${poi.lat.toFixed(4)}, ${poi.lng.toFixed(4)}</span>
            ${poi.description ? `<span class="cpi-desc">${poi.description}</span>` : ''}
          </div>
          <div class="cpi-actions">
            ${idx > 0 ? `<button class="cpi-btn" onclick="Creator.movePoi(${idx},-1)" title="Subir">↑</button>` : ''}
            ${!isLast ? `<button class="cpi-btn" onclick="Creator.movePoi(${idx},1)" title="Bajar">↓</button>` : ''}
            <button class="cpi-btn cpi-btn-del" onclick="Creator.removePoi(${idx})" title="Eliminar">✕</button>
          </div>
        </div>
      `;
      list.appendChild(item);
    });

    _updateDistances();
  }

  function _updateDistances() {
    const container = document.getElementById('distances-summary');
    const list = document.getElementById('distances-list');
    const total = document.getElementById('total-distance');
    if (!container) return;

    const pois = _tour.pois;
    if (pois.length < 2) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');

    let distList = '';
    let totalDist = 0;
    for (let i = 1; i < pois.length; i++) {
      const d = GPS.haversine(pois[i-1].lat, pois[i-1].lng, pois[i].lat, pois[i].lng);
      totalDist += d;
      distList += `<div class="dist-row"><span>${pois[i-1].name} → ${pois[i].name}</span><strong>${UI.fmtDist(d)}</strong></div>`;
    }
    if (list) list.innerHTML = distList;
    if (total) total.textContent = UI.fmtDist(totalDist);
  }

  // ── Operaciones sobre POIs ───────────────────────────

  function movePoi(idx, dir) {
    const arr = _tour.pois;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    arr.forEach((p, i) => p.order = i);
    _renderPoiList();
    _updateMapMarkers();
  }

  function removePoi(idx) {
    _tour.pois.splice(idx, 1);
    _tour.pois.forEach((p, i) => p.order = i);
    _renderPoiList();
    _updateMapMarkers();
    _updateActions();
  }

  // ── Mapa markers + polyline ───────────────────────────

  function _updateMapMarkers() {
    if (!_map) return;
    _markers.forEach(m => m.remove());
    _markers = [];
    if (_polyline) { _polyline.remove(); _polyline = null; }

    const pois = _tour.pois;
    const latlngs = [];

    pois.forEach((poi, idx) => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:#021a10;border:2px solid #e8b84b;
          display:flex;align-items:center;justify-content:center;
          color:#e8b84b;font-size:11px;font-weight:700;
          box-shadow:0 2px 6px rgba(0,0,0,.4)">
          ${idx+1}
        </div>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
      });
      const m = L.marker([poi.lat, poi.lng], { icon })
        .addTo(_map)
        .bindPopup(`<strong>${idx+1}. ${poi.name}</strong>`);
      _markers.push(m);
      latlngs.push([poi.lat, poi.lng]);
    });

    if (latlngs.length >= 2) {
      _polyline = L.polyline(latlngs, {
        color: '#e8b84b', weight: 2, dashArray: '6,5', opacity: 0.75
      }).addTo(_map);
    }

    if (latlngs.length > 0) {
      if (latlngs.length === 1) {
        _map.setView(latlngs[0], 15);
      } else {
        _map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
      }
    }
  }

  // ── Guardar ───────────────────────────────────────────

  function saveTour() {
    const name = _el('tour-name-input').value.trim() || 'Recorrido sin nombre';
    const desc = _el('tour-desc-input').value.trim();
    _tour.name = name;
    _tour.description = desc;
    _tour.id = _tour.id || Date.now().toString(36);
    _tour.createdAt = _tour.createdAt || new Date().toISOString();
    _tour.updatedAt = new Date().toISOString();

    Gallery.save(_tour);
    UI.toast(`"${name}" guardado ✓`, 'ok');
    _updateActions();

    // Habilitar exportar QR
    document.getElementById('export-qr-btn')?.removeAttribute('disabled');
  }

  function exitConfirm() {
    if (_tour.pois.length > 0) {
      UI.confirm('¿Salir sin guardar? Se perderán los cambios.', () => UI.go('screen-home'));
    } else {
      UI.go('screen-home');
    }
  }

  function _updateActions() {
    const hasPois = _tour.pois.length > 0;
    const saveBtn = document.getElementById('save-tour-btn');
    const qrBtn   = document.getElementById('export-qr-btn');
    const hint    = document.getElementById('save-hint');
    if (saveBtn) saveBtn.disabled = !hasPois;
    if (qrBtn)   qrBtn.disabled   = !hasPois;
    if (hint)    hint.style.display = hasPois ? 'none' : 'block';
  }

  function getCurrentTour() { return _tour; }

  function _el(id) { return document.getElementById(id); }

  return {
    init, togglePoiForm, cancelPoiForm,
    onPhotoSelected, useMyLocation, confirmAddPoi,
    movePoi, removePoi,
    saveTour, exitConfirm,
    getCurrentTour
  };
})();
