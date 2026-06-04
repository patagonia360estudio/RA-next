/**
 * app.js — Bootstrap principal + deep link QR
 * Patagonia 360 · v6
 */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Chequear deep link QR al cargar
  const tourFromQR = QR.parseURLHash();
  if (tourFromQR) {
    Viewer.renderOverview(tourFromQR);
    // Pequeño delay para que el DOM esté listo
    setTimeout(() => UI.go('screen-tour-overview'), 150);
  }

  // 2. Actualizar sub-home con recorridos existentes
  const tours = Gallery.getAll();
  const sub = document.getElementById('gallery-home-sub');
  if (sub) {
    sub.textContent = tours.length
      ? `${tours.length} recorrido${tours.length !== 1 ? 's' : ''} guardado${tours.length !== 1 ? 's' : ''}`
      : 'Sin recorridos guardados';
  }

  // 3. Barra de progreso de la brújula en AR
  _initCompassDirs();

  // 4. Demo tour — si no hay nada guardado, crear uno de ejemplo
  if (tours.length === 0) {
    _createDemoTour();
  }

  console.log('[Patagonia 360 v6] App lista ✓');
});

function _initCompassDirs() {
  const dirs = document.getElementById('compass-dirs');
  if (!dirs) return;
  const labels = ['N','NE','E','SE','S','SO','O','NO','N','NE','E','SE','S','SO','O','NO','N'];
  dirs.innerHTML = labels.map(l => `<span class="compass-dir">${l}</span>`).join('');
}

function _createDemoTour() {
  const demo = {
    id: 'demo_bari_001',
    name: 'Recorrido Clásico Bariloche',
    description: 'Los puntos icónicos del centro de Bariloche y el lago.',
    createdAt: new Date().toISOString(),
    pois: [
      {
        id: 'poi_cc', name: 'Centro Cívico', category: 'culture',
        description: 'El corazón arquitectónico de Bariloche, con sus edificios de piedra y madera estilo alpino.',
        lat: -41.1335, lng: -71.3103, order: 0, image: null
      },
      {
        id: 'poi_lago', name: 'Lago Nahuel Huapi', category: 'nature',
        description: 'Vistas panorámicas del lago más emblemático de la Patagonia andina.',
        lat: -41.1380, lng: -71.3200, order: 1, image: null
      },
      {
        id: 'poi_cerro', name: 'Cerro Campanario', category: 'viewpoint',
        description: 'Considerado uno de los diez mejores panoramas del mundo. Ideal para el atardecer.',
        lat: -41.0607, lng: -71.4856, order: 2, image: null
      },
      {
        id: 'poi_catedral', name: 'Cerro Catedral', category: 'sport',
        description: 'La estación de esquí más grande de Sudamérica, activa en verano como centro de trekking.',
        lat: -41.1783, lng: -71.4439, order: 3, image: null
      }
    ]
  };
  Gallery.save(demo);
  // Actualizar sub-home
  const sub = document.getElementById('gallery-home-sub');
  if (sub) sub.textContent = '1 recorrido guardado';
}
