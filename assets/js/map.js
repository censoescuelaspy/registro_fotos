const STATUS_COLORS = {
  PENDIENTE: '#64748b',
  EN_PROCESO: '#d97706',
  FINALIZADO: '#15803d',
  CON_PENDIENTES: '#b91c1c'
};

export class SchoolMap {
  constructor(element, onSelect) {
    this.element = element;
    this.onSelect = onSelect;
    this.map = null;
    this.markers = new Map();
    this.userMarker = null;
  }

  init() {
    if (this.map || !this.element || !window.L) return;
    this.map = L.map(this.element, { zoomControl: true, maxZoom: 21 }).setView([-25.3, -57.55], 10);
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors'
    });
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, attribution: 'Tiles &copy; Esri' }
    );
    streets.addTo(this.map);
    L.control.layers({ Calles: streets, Satelite: satellite }, null, { position: 'topright' }).addTo(this.map);
  }

  setSchools(schools, progress = {}, selectedCode = '') {
    this.init();
    if (!this.map) return;
    const visible = new Set(schools.map((school) => school.codigo));
    for (const [code, marker] of this.markers) {
      if (!visible.has(code)) {
        marker.remove();
        this.markers.delete(code);
      }
    }

    const bounds = [];
    for (const school of schools) {
      const status = progress[school.codigo]?.estado || 'PENDIENTE';
      const selected = selectedCode === school.codigo;
      const icon = L.divIcon({
        className: 'school-marker-wrap',
        html: `<span class="school-marker ${selected ? 'is-selected' : ''}" style="--marker-color:${STATUS_COLORS[status] || STATUS_COLORS.PENDIENTE}"></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      let marker = this.markers.get(school.codigo);
      if (!marker) {
        marker = L.marker([school.latitud, school.longitud], { icon })
          .addTo(this.map)
          .on('click', () => this.onSelect?.(school.codigo));
        this.markers.set(school.codigo, marker);
      } else {
        marker.setLatLng([school.latitud, school.longitud]);
        marker.setIcon(icon);
      }
      marker.bindTooltip(`<strong>${school.codigo}</strong><br>${escapeMapText(school.nombre)}`);
      bounds.push([school.latitud, school.longitud]);
    }
    if (bounds.length && !selectedCode) this.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    setTimeout(() => this.map?.invalidateSize(), 50);
  }

  focusSchool(school) {
    if (!this.map || !school) return;
    this.map.setView([school.latitud, school.longitud], 18, { animate: true });
    this.markers.get(school.codigo)?.openTooltip();
  }

  showUserLocation(location) {
    this.init();
    if (!this.map || !location) return;
    const point = [location.latitud, location.longitud];
    if (!this.userMarker) {
      this.userMarker = L.circleMarker(point, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1
      }).addTo(this.map).bindTooltip('Mi ubicacion');
    } else {
      this.userMarker.setLatLng(point);
    }
    this.map.setView(point, Math.max(this.map.getZoom(), 16));
  }

  destroy() {
    this.map?.remove();
    this.map = null;
    this.markers.clear();
  }
}

function escapeMapText(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}
