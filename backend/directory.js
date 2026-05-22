// directory.js
import { Utils } from './utils.js';
import { SA_FACILITIES, PROVINCES, TOTAL_COUNT } from './facilities.js';

export class DirectoryController {
  constructor() {
    this.map = L.map('dir-map', { center: [-29.0, 25.0], zoom: 6, zoomControl: true });
    this.markerLayer = L.layerGroup().addTo(this.map);
    this.markerRefs = {};
    this.locationPinLayer = null;
    this.userLat = null;
    this.userLng = null;
    this.activeRadius = 0;
    this.activeIndex = null;
    this.userRole = localStorage.getItem('userRole') || 'patient';
  }

  markerOptions(facility) {
    let color;
    if (facility.sector === 'private') color = '#ff6b6b';
    else if (facility.type === 'hospital') color = '#60b4ff';
    else color = '#00e5a0';
    return { radius: facility.type === 'hospital' ? 8 : 6, fillColor: color, color: '#0b0e14', weight: 1.5, opacity: 1, fillOpacity: 0.82 };
  }

  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  setLocationPin(lat, lng) {
    if (this.locationPinLayer) this.map.removeLayer(this.locationPinLayer);
    if (lat == null) return;
    this.locationPinLayer = L.circleMarker([lat, lng], { radius: 10, fillColor: '#f9c74f', color: '#0b0e14', weight: 2, opacity: 1, fillOpacity: 0.95 }).addTo(this.map);
    this.locationPinLayer.bindTooltip('Your location', { permanent: false, direction: 'top', className: 'fac-tooltip', offset: [0, -6] });
  }

  activateLocation(lat, lng, label) {
    this.userLat = lat;
    this.userLng = lng;
    this.setLocationPin(lat, lng);
    this.map.flyTo([lat, lng], 12, { duration: 1.4 });
    const status = document.getElementById('loc-status');
    status.className = 'loc-status active';
    status.textContent = `📍 ${label}`;
    document.getElementById('radius-row').classList.remove('hidden');
    this.render();
  }

  clearLocation() {
    this.userLat = null;
    this.userLng = null;
    this.setLocationPin(null);
    document.getElementById('loc-input').value = '';
    document.getElementById('loc-status').textContent = '';
    document.getElementById('loc-status').className = 'loc-status';
    document.getElementById('radius-row').classList.add('hidden');
    document.getElementById('radius-select').value = '0';
    this.activeRadius = 0;
    this.map.fitBounds(L.latLngBounds(L.latLng(-34.82, 16.47), L.latLng(-22.13, 32.89)), { padding: [20, 20] });
    this.render();
  }

  async geocodeLocation(query) {
    const status = document.getElementById('loc-status');
    status.className = 'loc-status';
    status.textContent = 'Searching…';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`;
    try {
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (!data || data.length === 0) {
        status.className = 'loc-status error';
        status.textContent = 'Location not found — try a city or suburb name.';
        return;
      }
      const { lat, lon, display_name } = data[0];
      const shortLabel = display_name.split(',').slice(0, 2).join(',').trim();
      this.activateLocation(parseFloat(lat), parseFloat(lon), shortLabel);
    } catch (err) {
      status.className = 'loc-status error';
      status.textContent = 'Geocoding failed — check your connection.';
    }
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      document.getElementById('loc-status').className = 'loc-status error';
      document.getElementById('loc-status').textContent = 'Geolocation is not supported by your browser.';
      return;
    }
    const gpsBtn = document.getElementById('loc-gps-btn');
    const status = document.getElementById('loc-status');
    gpsBtn.classList.add('loading');
    status.className = 'loc-status';
    status.textContent = 'Detecting your location…';
    navigator.geolocation.getCurrentPosition(position => {
      gpsBtn.classList.remove('loading');
      const { latitude: lat, longitude: lng } = position.coords;
      document.getElementById('loc-input').value = '';
      this.activateLocation(lat, lng, 'Current location');
    }, error => {
      gpsBtn.classList.remove('loading');
      status.className = 'loc-status error';
      const msgs = { 1: 'Location permission denied.', 2: 'Location unavailable.', 3: 'Location request timed out.' };
      status.textContent = msgs[error.code] || 'Could not get location.';
    }, { timeout: 10000, maximumAge: 60000 });
  }

  openDetail(f) {
    this.activeIndex = f._index;
    document.getElementById('dc-name').textContent = f.name;
    document.getElementById('dc-sub').textContent = `${f.city}, ${f.province}`;
    const typeLabel = f.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
    const typeClass = f.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
    const sectClass = f.sector === 'public' ? 'chip-public' : 'chip-private';
    let distChip = '';
    if (f._distKm != null) {
      const km = f._distKm;
      const display = km < 1 ? '<1 km' : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
      distChip = `<li><b class="chip chip-dist">${display} away</b></li>`;
    }
    document.getElementById('dc-chips').innerHTML = `<li><b class="chip ${typeClass}">${typeLabel}</b></li><li><b class="chip ${sectClass}">${f.sector.toUpperCase()}</b></li><li><b class="chip chip-prov">${f.province.toUpperCase()}</b></li>${distChip}`;
    document.getElementById('dc-coords').textContent = `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`;
    document.getElementById('dc-directions').onclick = () => {
      const origin = this.userLat != null ? `&origin=${this.userLat},${this.userLng}` : '';
      window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${f.lat},${f.lng}`, '_blank');
    };
    let bookBtn = document.getElementById('dc-book');
    if (!bookBtn) {
      bookBtn = document.createElement('button');
      bookBtn.id = 'dc-book';
      bookBtn.className = 'btn-directions';
      bookBtn.textContent = this.userRole === 'patient' ? '📅 Book Appointment' : '📅 See Facility';
      document.getElementById('dc-directions').insertAdjacentElement('afterend', bookBtn);
    }
    bookBtn.onclick = () => {
      const qs = new URLSearchParams({ clinicID: f.clinicID || '', name: f.name || '', type: f.type || '', sector: f.sector || '', city: f.city || '', province: f.province || '' });
      if (this.userRole === 'patient') window.location.href = `booking.html?${qs}`;
      else window.location.href = `SeeFacilities.html?${qs}`;
    };
    const detailCard = document.getElementById('detail-card');
    detailCard.classList.remove('hidden');
    detailCard.offsetHeight;
    detailCard.classList.add('visible');
    document.querySelectorAll('.facility-item').forEach(el => el.classList.toggle('active', parseInt(el.dataset.index) === this.activeIndex));
  }

  closeDetail() {
    const detailCard = document.getElementById('detail-card');
    detailCard.classList.remove('visible');
    this.activeIndex = null;
    document.querySelectorAll('.facility-item').forEach(el => el.classList.remove('active'));
  }

  render() {
    const query = document.getElementById('dir-search').value.trim().toLowerCase();
    const prov = document.getElementById('filter-province').value;
    const type = document.getElementById('filter-type').value;
    const sector = document.getElementById('filter-sector').value;
    let filtered = SA_FACILITIES.filter((f, i) => {
      f._index = i;
      if (query && !`${f.name} ${f.city} ${f.province}`.toLowerCase().includes(query)) return false;
      if (prov && f.province !== prov) return false;
      if (type && f.type !== type) return false;
      if (sector && f.sector !== sector) return false;
      if (this.userLat != null && this.activeRadius > 0) {
        const dist = this.haversineKm(this.userLat, this.userLng, f.lat, f.lng);
        if (dist > this.activeRadius) return false;
      }
      return true;
    });
    if (this.userLat != null) {
      filtered.forEach(f => { f._distKm = this.haversineKm(this.userLat, this.userLng, f.lat, f.lng); });
      filtered.sort((a, b) => a._distKm - b._distKm);
    } else {
      filtered.forEach(f => { f._distKm = null; });
    }
    this.markerLayer.clearLayers();
    Object.keys(this.markerRefs).forEach(k => delete this.markerRefs[k]);
    filtered.forEach(f => {
      const marker = L.circleMarker([f.lat, f.lng], this.markerOptions(f));
      marker.bindTooltip(f._distKm != null ? `${f.name} (${f._distKm < 1 ? '<1' : Math.round(f._distKm)} km)` : f.name, { permanent: false, direction: 'top', className: 'fac-tooltip', offset: [0, -4] });
      marker.on('click', () => {
        this.openDetail(f);
        this.map.flyTo([f.lat, f.lng], 13, { duration: 1.2 });
        marker.openTooltip();
        const listItem = document.querySelector(`.facility-item[data-index="${f._index}"]`);
        if (listItem) listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      this.markerLayer.addLayer(marker);
      this.markerRefs[f._index] = marker;
    });
    const facilityList = document.getElementById('facility-list');
    if (filtered.length === 0) {
      facilityList.innerHTML = `<li class="no-results">No facilities match your filters.<br><span style="opacity:0.5">Try widening the search or increasing the radius.</span></li>`;
    } else {
      facilityList.innerHTML = '';
      filtered.forEach(f => {
        const item = document.createElement('li');
        item.className = 'facility-item' + (f._index === this.activeIndex ? ' active' : '');
        item.dataset.index = f._index;
        const dotClass = f.sector === 'private' ? 'private' : f.type === 'hospital' ? 'hospital' : 'clinic';
        let distBadge = '';
        if (f._distKm != null) {
          const km = f._distKm;
          const display = km < 1 ? '<1 km' : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
          const cls = km <= 5 ? 'fac-dist nearby' : 'fac-dist';
          distBadge = `<small class="${cls}">${display}</small>`;
        }
        item.innerHTML = `<span class="fac-dot ${dotClass}" aria-hidden="true"></span><div class="fac-info"><strong class="fac-name" title="${f.name}">${f.name}</strong><small class="fac-sub">${f.city} · ${f.province}</small></div><b class="fac-badge ${f.sector}">${f.sector.toUpperCase()}</b>${distBadge}`;
        item.addEventListener('click', () => {
          this.openDetail(f);
          this.map.flyTo([f.lat, f.lng], 13, { duration: 1.2 });
          if (this.markerRefs[f._index]) this.markerRefs[f._index].openTooltip();
        });
        facilityList.appendChild(item);
      });
    }
    document.getElementById('stat-showing').textContent = filtered.length;
    document.getElementById('stat-total').textContent = TOTAL_COUNT;
    document.getElementById('hud-count').textContent = `${filtered.length} facilit${filtered.length === 1 ? 'y' : 'ies'} on map`;
  }

  setupUI() {
    const provinceSelect = document.getElementById('filter-province');
    PROVINCES.forEach(prov => { const opt = document.createElement('option'); opt.value = prov; opt.textContent = prov; provinceSelect.appendChild(opt); });
    const searchInput = document.getElementById('dir-search');
    const clearBtn = document.getElementById('dir-search-clear');
    searchInput.addEventListener('input', () => this.render());
    clearBtn.addEventListener('click', () => { searchInput.value = ''; searchInput.focus(); this.render(); });
    document.getElementById('filter-province').addEventListener('change', () => this.render());
    document.getElementById('filter-type').addEventListener('change', () => this.render());
    document.getElementById('filter-sector').addEventListener('change', () => this.render());
    document.getElementById('dc-close').addEventListener('click', () => this.closeDetail());
    this.map.on('click', () => this.closeDetail());

    // Location UI injection
    const searchWrap = searchInput.closest('.search-wrap') || searchInput.parentElement;
    const locRow = document.createElement('div'); locRow.id = 'loc-row'; locRow.className = 'loc-row';
    locRow.innerHTML = `<div class="loc-input-wrap"><span class="loc-prefix-icon" aria-hidden="true">📍</span><input id="loc-input" type="text" placeholder="Search by location…" autocomplete="off" spellcheck="false" /><button id="loc-gps-btn" class="loc-gps-btn" title="Use my current location">⊕</button></div><div class="loc-status" id="loc-status" aria-live="polite"></div>`;
    searchWrap.insertAdjacentElement('afterend', locRow);
    const radiusRow = document.createElement('div'); radiusRow.id = 'radius-row'; radiusRow.className = 'radius-row hidden';
    radiusRow.innerHTML = `<label for="radius-select" class="radius-label">Show within</label><select id="radius-select" class="radius-select"><option value="0">any distance</option><option value="5">5 km</option><option value="10">10 km</option><option value="20">20 km</option><option value="50">50 km</option><option value="100">100 km</option></select><button id="loc-clear-btn" class="loc-clear-btn">✕ clear location</button>`;
    locRow.insertAdjacentElement('afterend', radiusRow);
    document.getElementById('loc-input').addEventListener('keydown', e => { if (e.key === 'Enter') this.geocodeLocation(e.target.value.trim()); });
    document.getElementById('loc-gps-btn').addEventListener('click', () => this.useMyLocation());
    document.getElementById('loc-clear-btn').addEventListener('click', () => this.clearLocation());
    document.getElementById('radius-select').addEventListener('change', e => { this.activeRadius = parseInt(e.target.value, 10) || 0; this.render(); });
  }

  init() {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(this.map);
    this.map.zoomControl.setPosition('bottomright');
    this.setupUI();
    this.render();
    const southAfricaBounds = L.latLngBounds(L.latLng(-34.82, 16.47), L.latLng(-22.13, 32.89));
    this.map.fitBounds(southAfricaBounds, { padding: [20, 20] });
    // Additional CSS for tooltips
    const tooltipStyle = document.createElement('style');
    tooltipStyle.textContent = `.fac-tooltip { background: #111520 !important; border: 1px solid #252b3d !important; color: #dce2f0 !important; font-family: 'Space Mono', monospace !important; font-size: 11px !important; padding: 5px 10px !important; border-radius: 5px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important; white-space: nowrap !important; } .fac-tooltip::before { display: none; } .chip-dist { background: #1a2a1f; color: #00e5a0; border: 1px solid #00e5a033; }`;
    document.head.appendChild(tooltipStyle);
  }
}

const controller = new DirectoryController();
controller.init();