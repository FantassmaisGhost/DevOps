class DirectoryController {
  constructor() {
    this.map = L.map('dir-map').setView([-29.0, 25.0], 6);
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.filtered = [];
    this.userLocation = null;
    this.activeRadius = 0;
  }

  init() {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '...' }).addTo(this.map);
    this.setupUI();
    this.render();
  }

  render() {
    const query = document.getElementById('dir-search').value.trim().toLowerCase();
    const province = document.getElementById('filter-province').value;
    const type = document.getElementById('filter-type').value;
    const sector = document.getElementById('filter-sector').value;

    let filtered = SA_FACILITIES.filter(f => {
      if (query && !`${f.name} ${f.city} ${f.province}`.toLowerCase().includes(query)) return false;
      if (province && f.province !== province) return false;
      if (type && f.type !== type) return false;
      if (sector && f.sector !== sector) return false;
      if (this.userLocation && this.activeRadius > 0) {
        const dist = haversineKm(this.userLocation.lat, this.userLocation.lng, f.lat, f.lng);
        if (dist > this.activeRadius) return false;
      }
      return true;
    });

    if (this.userLocation) {
      filtered.forEach(f => f._distKm = haversineKm(this.userLocation.lat, this.userLocation.lng, f.lat, f.lng));
      filtered.sort((a,b) => a._distKm - b._distKm);
    }

    this.markerLayer.clearLayers();
    filtered.forEach(f => {
      const marker = L.circleMarker([f.lat, f.lng], this.getMarkerOptions(f));
      marker.bindTooltip(f.name);
      marker.on('click', () => this.openDetail(f));
      this.markerLayer.addLayer(marker);
    });

    this.filtered = filtered;
    this.renderList();
  }

  async geocodeLocation(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.length) {
      const { lat, lon, display_name } = data[0];
      this.setUserLocation(parseFloat(lat), parseFloat(lon), display_name);
    }
  }

  useMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        this.setUserLocation(pos.coords.latitude, pos.coords.longitude, 'Current location');
      });
    }
  }

  setUserLocation(lat, lng, label) {
    this.userLocation = { lat, lng };
    // add pin and fly to
    this.render();
  }
}