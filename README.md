# Patagonia 360 · v6 — Spatial Layer

Plataforma de recorridos geolocalizados con AR para Bariloche.

## Arquitectura modular

```
/
├── index.html          — Estructura completa de pantallas
├── style.css           — Diseño y componentes
├── manifest.json       — PWA
├── assets/
│   └── logo.png        — Logo (proveer)
└── js/
    ├── ui.js           — Gestión de pantallas, toast, helpers
    ├── gps.js          — Geolocalización, bearing, distancia, Leaflet
    ├── ar.js           — Cámara, Device Orientation, HUD AR
    ├── creator.js      — Creación de recorridos multi-POI
    ├── gallery.js      — localStorage: guardar/leer/eliminar tours
    ├── qr.js           — Generación QR + deep link URL hash
    ├── viewer.js       — Overview, navegación secuencial, llegada
    └── app.js          — Bootstrap, demo tour, QR hash parser
```

## Flujo completo

```
CREADOR
  1. Nombre + descripción del recorrido
  2. Agregar POIs (foto + EXIF GPS automático, o tap en mapa, o mi ubicación)
  3. Reordenar POIs con ↑ ↓
  4. Ver distancias generadas automáticamente
  5. Guardar en localStorage
  6. Exportar QR → URL con #tour=ID o #tourdata=BASE64

USUARIO
  1. Escanear QR → abre URL → app carga recorrido completo
  2. Pantalla Overview: mapa con todos los POIs + estadísticas
  3. "Iniciar Recorrido" → navega al POI 1
  4. Pantalla Nav: mapa GPS, flecha, distancia en tiempo real
  5. Llegar (<50m) o presionar "Llegué"
  6. Pantalla Arrival: foto, nombre, descripción
  7. "Siguiente parada" → navega al POI 2, 3...
  8. Último POI → "Finalizar recorrido" → pantalla Finish
  9. En cualquier momento: "Vista AR" → cámara + HUD mínimo + flecha

AR
  - Teléfono vertical → AR activo, mini HUD en esquina superior derecha
  - POI card flotante solo cuando <100m (no tapa la cámara)
  - Flecha direccional animada con Device Orientation
  - Brújula superior
```

## Estructura de datos (localStorage)

```json
{
  "id": "abc123",
  "name": "Recorrido Clásico Bariloche",
  "description": "Los puntos icónicos...",
  "createdAt": "2025-01-01T00:00:00Z",
  "pois": [
    {
      "id": "poi_1",
      "name": "Centro Cívico",
      "description": "...",
      "category": "culture",
      "lat": -41.1335,
      "lng": -71.3103,
      "image": "data:image/jpeg;base64,...",
      "order": 0
    }
  ]
}
```

## Categorías de POI

| valor      | emoji | nombre        |
|------------|-------|---------------|
| viewpoint  | 🏔️   | Mirador       |
| food       | 🍽️   | Gastronomía   |
| nature     | 🌿    | Naturaleza    |
| culture    | 🏛️   | Cultura       |
| sport      | 🎿    | Deporte       |
| hotel      | 🏨    | Alojamiento   |
| other      | 📍    | Otro          |

## Deep link QR

El QR codifica una URL con hash:
- `#tour=ID` → recorrido guardado en el dispositivo
- `#tourdata=BASE64` → recorrido codificado en la propia URL (sin imágenes)

Al escanear, `app.js` llama a `QR.parseURLHash()` que detecta el tipo,
carga el tour y redirige a la pantalla de overview.

## Despliegue GitHub Pages

1. Subir todos los archivos a la rama `main` (o `gh-pages`)
2. Activar GitHub Pages en Settings → Pages
3. Generar QR con la URL de GitHub Pages (ej: `https://usuario.github.io/repo/#tour=demo_bari_001`)

## Dependencias externas (CDN, sin backend)

- Leaflet 1.9.4 — mapas
- exifr 7.1.3 — GPS desde fotos
- QRCode 1.5.3 — generación de QR
- Google Fonts (Syne + DM Sans)

## Próximas etapas sugeridas

- [ ] Service Worker para funcionamiento offline
- [ ] Exportar tour como JSON (backup)
- [ ] Importar tour desde JSON o QR
- [ ] Comentarios por POI
- [ ] Modo guía (audio)
- [ ] Backend opcional (Supabase / Firebase) para tours compartidos
