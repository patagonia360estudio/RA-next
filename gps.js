/**
 * gps.js — Geolocalización, bearing, distancia, navegación GPS
 * Patagonia 360 · v6
 */
const GPS = (() => {
  let _watchId = null;
  let _lastPos = null;
  let _targetPoi = null;
  let _map = null;
  let _userMarker = null;
  let _destMarker = null;
  let _polyline = null;
  let _allMarkers = [];
  let _onProximity = null;   // callback cuando <50m
  let _compassHeading = 0;

  const PROXIMITY_THRESHOLD = 50; // metros

  // ── Cálculos geográficos ──────────────────────────────

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const dφ = (lat2 - lat1) * Math.PI / 180;
    const dλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function bearing(lat1, lng1, lat2, lng2) {
    const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
    const dλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(dλ) * Math.cos(φ2);
    const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(dλ);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  }

  function bearingLabel(deg) {
    const dirs = ['N','NE','E','SE','S','SO','O','NO'];
    return dirs[Math.round(deg / 45) % 8];
  }

  // Distancia total de un array de POIs [{lat,lng}...]
  function totalDistance(pois) {
    let d = 0;
    for (let i = 1; i < pois.length; i++) {
      d += haversine(pois[i-1].lat, pois[i-1].lng, pois[i].lat, pois[i].lng);
    }
    return d;
  }

  // ── Mapa Leaflet para navegación ─────────────────────

  function initNavMap() {
    if (_map) { _map.remove(); _map = null; }
    const el = document.getElementById('leaflet-map');
    if (!el) return;

    _map = L.map('leaflet-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([-41.1335, -71.3103], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(_map);

    L.control.zoom({ position: 'bottomright' }).addTo(_map);
  }

  function _userIcon() {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:var(--green,#22d68a);
        border:3px solid #fff;
        box-shadow:0 0 0 4px rgba(34,214,138,.35)">
      </div>`,
      iconSize: [18, 18], iconAnchor: [9, 9]
    });
  }

  function _destIcon(emoji = '📍') {
    return L.divIcon({
      className: '',
      html: `<div style="
        font-size:26px;line-height:1;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))">
        ${emoji}
      </div>`,
      iconSize: [30, 30], iconAnchor: [15, 28]
    });
  }

  // ── Iniciar watch GPS ─────────────────────────────────

  function startNav(poi, onProximityCallback) {
    _targetPoi = poi;
    _onProximity = onProximityCallback;

    initNavMap();
    _allMarkers.forEach(m => m.remove());
    _allMarkers = [];

    // Marker destino
    const emoji = UI.catEmoji(poi.category);
    _destMarker = L.marker([poi.lat, poi.lng], { icon: _destIcon(emoji) })
      .addTo(_map)
      .bindPopup(`<strong>${poi.name}</strong>`);
    _allMarkers.push(_destMarker);

    // Brújula / orientación
    _startOrientation();

    // GPS watch
    if (_watchId !== null) navigator.geolocation.clearWatch(_watchId);

    if (!navigator.geolocation) {
      UI.toast('GPS no disponible en este dispositivo', 'error');
      _setStatus('Sin GPS', false);
      return;
    }

    _setStatus('Buscando…', false);

    _watchId = navigator.geolocation.watchPosition(
      pos => _onPosition(pos),
      err => {
        console.warn('GPS error:', err.message);
        _setStatus('Error GPS', false);
        UI.toast('No se pudo obtener ubicación GPS', 'error');
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
  }

  function stopNav() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
    _stopOrientation();
    _allMarkers.forEach(m => m.remove());
    _allMarkers = [];
    if (_polyline) { _polyline.remove(); _polyline = null; }
    if (_userMarker) { _userMarker.remove(); _userMarker = null; }
    if (_destMarker) { _destMarker.remove(); _destMarker = null; }
  }

  function _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    _lastPos = { lat, lng };

    _setStatus('GPS ✓', true);

    // Actualizar / crear marker usuario
    if (!_userMarker) {
      _userMarker = L.marker([lat, lng], { icon: _userIcon() }).addTo(_map);
      _allMarkers.push(_userMarker);
    } else {
      _userMarker.setLatLng([lat, lng]);
    }

    // Centrar mapa la primera vez
    _map.setView([lat, lng], 17);

    if (!_targetPoi) return;

    const dist = haversine(lat, lng, _targetPoi.lat, _targetPoi.lng);
    const brg = bearing(lat, lng, _targetPoi.lat, _targetPoi.lng);
    const relBearing = ((brg - _compassHeading) + 360) % 360;

    // Actualizar polyline
    if (_polyline) _polyline.remove();
    _polyline = L.polyline([[lat, lng], [_targetPoi.lat, _targetPoi.lng]], {
      color: '#22d68a', weight: 3, dashArray: '8,6', opacity: 0.8
    }).addTo(_map);

    // Actualizar HUD
    _updateHUD(dist, brg, accuracy, relBearing);

    // AR update
    AR.update(dist, brg, relBearing, _targetPoi);

    // Proximidad
    const alert = document.getElementById('proximity-alert');
    if (alert) {
      if (dist < PROXIMITY_THRESHOLD) {
        alert.classList.remove('hidden');
        _onProximity?.();
      } else {
        alert.classList.add('hidden');
      }
    }
  }

  function _updateHUD(dist, brg, accuracy, relBearing) {
    const dv = document.getElementById('dist-val');
    const bv = document.getElementById('bearing-val');
    const av = document.getElementById('acc-val');
    const al = document.getElementById('arrow-label');
    const arrow = document.getElementById('nav-arrow');

    if (dv) dv.textContent = UI.fmtDist(dist);
    if (bv) bv.textContent = `${bearingLabel(brg)} (${Math.round(brg)}°)`;
    if (av) av.textContent = `±${Math.round(accuracy)}m`;
    if (al) al.textContent = bearingLabel(brg);
    if (arrow) arrow.style.transform = `rotate(${relBearing}deg)`;
  }

  function _setStatus(label, ok) {
    const el = document.getElementById('gps-status');
    if (!el) return;
    el.textContent = label;
    el.className = `badge ${ok ? 'badge-green' : 'gps-wait'}`;
  }

  // ── Brújula / Device Orientation ─────────────────────

  function _startOrientation() {
    const handler = e => {
      const h = e.webkitCompassHeading ?? (e.alpha ? 360 - e.alpha : 0);
      _compassHeading = h;
      _updateCompassUI(h);
    };
    if (window.DeviceOrientationEvent?.requestPermission) {
      DeviceOrientationEvent.requestPermission()
        .then(r => { if (r === 'granted') window.addEventListener('deviceorientation', handler); })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', handler);
    }
    window._gpsOrientationHandler = handler;
  }

  function _stopOrientation() {
    if (window._gpsOrientationHandler) {
      window.removeEventListener('deviceorientation', window._gpsOrientationHandler);
      window._gpsOrientationHandler = null;
    }
  }

  function _updateCompassUI(heading) {
    const dirs = document.getElementById('compass-dirs');
    if (dirs) dirs.style.transform = `translateX(calc(-50% - ${heading * 2.5}px))`;
  }

  // Llegada manual (botón "Llegué")
  function arrivedManual() {
    stopNav();
    Viewer.handleArrival();
  }

  // Getters
  function getLastPos() { return _lastPos; }
  function getMap() { return _map; }

  return {
    haversine, bearing, bearingLabel, totalDistance,
    startNav, stopNav, arrivedManual,
    getLastPos, getMap,
    initNavMap
  };
})();
