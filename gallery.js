/**
 * gallery.js — Persistencia localStorage + render galería
 * Patagonia 360 · v6
 */
const Gallery = (() => {
  const KEY = 'p360_tours_v6';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }

  function save(tour) {
    const tours = getAll();
    const idx = tours.findIndex(t => t.id === tour.id);
    if (idx >= 0) tours[idx] = tour;
    else tours.push(tour);
    localStorage.setItem(KEY, JSON.stringify(tours));
  }

  function remove(id) {
    const tours = getAll().filter(t => t.id !== id);
    localStorage.setItem(KEY, JSON.stringify(tours));
  }

  function getById(id) {
    return getAll().find(t => t.id === id) || null;
  }

  function render() {
    const list  = document.getElementById('gallery-list');
    const empty = document.getElementById('gallery-empty');
    const badge = document.getElementById('gallery-count-badge');
    if (!list) return;

    const tours = getAll();
    if (badge) badge.textContent = tours.length;

    list.innerHTML = '';

    if (tours.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    tours.slice().reverse().forEach(tour => {
      const totalDist = GPS.totalDistance(tour.pois);
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.setAttribute('role', 'listitem');

      // Thumbnail: primera foto de los POIs o placeholder
      const firstImg = tour.pois.find(p => p.image)?.image;

      card.innerHTML = `
        <div class="gc-thumb" ${firstImg ? `style="background-image:url('${firstImg}')"` : ''}>
          ${!firstImg ? `<span class="gc-thumb-icon">${UI.catEmoji(tour.pois[0]?.category)}</span>` : ''}
        </div>
        <div class="gc-body">
          <span class="gc-name">${tour.name}</span>
          <span class="gc-meta">${tour.pois.length} punto${tour.pois.length !== 1 ? 's' : ''} · ${UI.fmtDist(totalDist)}</span>
          ${tour.description ? `<span class="gc-desc">${tour.description}</span>` : ''}
          <div class="gc-pois-preview">
            ${tour.pois.slice(0,5).map((p,i) => `
              <div class="gc-poi-chip">${i+1}. ${p.name}</div>
            `).join('')}
            ${tour.pois.length > 5 ? `<div class="gc-poi-chip gc-more">+${tour.pois.length-5}</div>` : ''}
          </div>
        </div>
        <div class="gc-actions">
          <button class="btn btn-green btn-sm gc-btn" onclick="Gallery.openTour('${tour.id}')">▶ Ver</button>
          <button class="btn btn-outline btn-sm gc-btn" onclick="QR.openModal(Gallery.getById('${tour.id}'))">⊞</button>
          <button class="btn btn-outline btn-sm gc-btn gc-del" onclick="Gallery.confirmDelete('${tour.id}')">✕</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  function openTour(id) {
    const tour = getById(id);
    if (!tour) { UI.toast('Recorrido no encontrado', 'error'); return; }
    Viewer.renderOverview(tour);
    UI.go('screen-tour-overview');
  }

  function confirmDelete(id) {
    const tour = getById(id);
    if (!tour) return;
    UI.confirm(`¿Eliminar "${tour.name}"?`, () => {
      remove(id);
      render();
      UI.toast('Recorrido eliminado', 'ok');
    });
  }

  return { getAll, save, remove, getById, render, openTour, confirmDelete };
})();
