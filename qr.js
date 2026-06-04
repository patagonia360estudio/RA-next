/**
 * qr.js — Generación y exportación de QR para recorridos completos
 * Patagonia 360 · v6
 */
const QR = (() => {
  let _currentTour = null;

  function openModal(tour) {
    if (!tour || !tour.pois?.length) {
      UI.toast('Guardá al menos 1 punto antes de exportar QR', 'error');
      return;
    }
    _currentTour = tour;

    const modal = document.getElementById('qr-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    // Nombre en modal
    const nameEl = document.getElementById('qr-tour-name');
    if (nameEl) nameEl.textContent = tour.name;

    _generate(tour);
  }

  function _generate(tour) {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas || !window.QRCode) return;

    // Construir URL que carga el recorrido completo
    // Estrategia: incrustar el ID en la URL hash → app.js lo lee al cargar
    // Si el recorrido ya está guardado, solo el ID es suficiente
    // Si no (recorrido temporal), codificamos un JSON mínimo en base64
    let url;
    const baseUrl = window.location.origin + window.location.pathname;

    if (tour.id && Gallery.getById(tour.id)) {
      // Recorrido ya guardado → solo el ID
      url = `${baseUrl}#tour=${tour.id}`;
    } else {
      // Recorrido temporal → codificar datos mínimos
      const minimal = {
        id: tour.id || Date.now().toString(36),
        name: tour.name,
        description: tour.description,
        pois: tour.pois.map(p => ({
          id: p.id, name: p.name, description: p.description,
          category: p.category, lat: p.lat, lng: p.lng, order: p.order
          // image omitida — demasiado pesada para QR
        }))
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
      url = `${baseUrl}#tourdata=${encoded}`;
    }

    QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 2,
      color: {
        dark: '#021a10',
        light: '#f5f0e8'
      }
    }, err => {
      if (err) { console.error('QR error:', err); UI.toast('Error generando QR', 'error'); }
    });

    // Guardar URL para copiar
    canvas.dataset.url = url;
  }

  function closeModal() {
    const modal = document.getElementById('qr-modal');
    if (modal) modal.classList.add('hidden');
    _currentTour = null;
  }

  function copyURL() {
    const canvas = document.getElementById('qr-canvas');
    const url = canvas?.dataset.url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      UI.toast('URL copiada al portapapeles ✓', 'ok');
    }).catch(() => {
      // Fallback para Safari
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      UI.toast('URL copiada ✓', 'ok');
    });
  }

  // Parsear URL hash al cargar la app
  function parseURLHash() {
    const hash = window.location.hash;
    if (!hash) return null;

    // #tour=ID
    const tourMatch = hash.match(/^#tour=(.+)$/);
    if (tourMatch) {
      const tour = Gallery.getById(tourMatch[1]);
      if (tour) return tour;
      UI.toast('Recorrido no encontrado en este dispositivo', 'error');
      return null;
    }

    // #tourdata=BASE64
    const dataMatch = hash.match(/^#tourdata=(.+)$/);
    if (dataMatch) {
      try {
        const json = decodeURIComponent(escape(atob(dataMatch[1])));
        const tour = JSON.parse(json);
        // Guardar localmente para próxima vez
        Gallery.save(tour);
        return tour;
      } catch (e) {
        console.error('Error parseando QR data:', e);
        UI.toast('Error al leer el QR', 'error');
        return null;
      }
    }

    return null;
  }

  return { openModal, closeModal, copyURL, parseURLHash };
})();
