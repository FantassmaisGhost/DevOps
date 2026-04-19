/* ============================================================
   SA HealthMap — directory.js  (UPDATED — with location search)
   ============================================================

   OVERVIEW — this file is organised into 9 sections:

   1. MAP INIT          — creates the Leaflet map, tile layer, SA default view.
   2. MARKER STYLES     — colour-coded CircleMarkers by type/sector.
   3. LAYER GROUPS      — single LayerGroup for efficient clear/redraw.
   4. SIDEBAR SETUP     — province dropdown + all filter/search controls.
   5. LOCATION SEARCH   — "Search by location" geocoding (Nominatim) with
                          "Use my current location" button (Geolocation API).
                          Sets a reference point + optional radius filter;
                          sidebar list is sorted by distance when active.
   6. RENDER LOGIC      — central render() reads filters + location state,
                          filters SA_FACILITIES, draws markers, builds list.
   7. DETAIL CARD       — slide-up detail card for a selected facility.
   8. EVENT WIRING      — all event listeners.
   9. INIT              — initial render + fitBounds to South Africa.

   ============================================================ */

/* ============================================================
   SECTION 1 — MAP INIT
   ============================================================ */

const map = L.map('dir-map', {
  center: [-29.0, 25.0],
  zoom: 6,
  zoomControl: true,
});

map.zoomControl.setPosition('bottomright');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

/* ============================================================
   SECTION 2 — MARKER STYLES
   ============================================================ */

function markerOptions(facility) {
  let color;
  if (facility.sector === 'private') {
    color = '#ff6b6b';
  } else if (facility.type === 'hospital') {
    color = '#60b4ff';
  } else {
    color = '#00e5a0';
  }
  return {
    radius: facility.type === 'hospital' ? 8 : 6,
    fillColor: color,
    color: '#0b0e14',
    weight: 1.5,
    opacity: 1,
    fillOpacity: 0.82,
  };
}

/* ============================================================
   SECTION 3 — LAYER GROUP
   ============================================================ */

const markersLayer = L.layerGroup().addTo(map);
const markerRefs   = {};

// Separate marker for the user's chosen/detected location
let locationPinLayer = null;

/* ============================================================
   SECTION 4 — SIDEBAR SETUP
   ============================================================ */

const provinceSelect = document.getElementById('filter-province');
PROVINCES.forEach(prov => {
  const opt = document.createElement('option');
  opt.value       = prov;
  opt.textContent = prov;
  provinceSelect.appendChild(opt);
});

const typeSelect   = document.getElementById('filter-type');
const sectorSelect = document.getElementById('filter-sector');
const searchInput  = document.getElementById('dir-search');
const clearBtn     = document.getElementById('dir-search-clear');
const facilityList = document.getElementById('facility-list');
const statShowing  = document.getElementById('stat-showing');
const statTotal    = document.getElementById('stat-total');
const hudCount     = document.getElementById('hud-count');

/* ============================================================
   SECTION 5 — LOCATION SEARCH
   ============================================================

   Adds two controls above (or inside) the existing search bar:

   ┌────────────────────────────────────┬────────┐
   │  📍 Search by location…            │  [📍]  │
   └────────────────────────────────────┴────────┘
       text input (geocode on Enter)    small "use my location" button

   State:
     userLat / userLng  — the reference coordinates (null = inactive)
     activeRadius       — km threshold for filtering (0 = show all sorted by dist)

   When a location is active:
   • Facilities are sorted by straight-line distance.
   • If a radius is selected, facilities beyond it are hidden.
   • A subtle pin marker is placed on the map.
   • A "× Clear location" link appears beneath the input.
   ============================================================ */

// ── Location state ──────────────────────────────────────────
let userLat    = null;
let userLng    = null;
let activeRadius = 0;   // km; 0 means "sort only, no radius filter"

// ── Inject location UI ──────────────────────────────────────
// We inject HTML immediately after the existing #dir-search wrapper.
// Adjust the selector to match where you want the bar to appear in your HTML.

(function injectLocationUI() {
  // Find a sensible anchor — the dir-search input's parent container
  const searchWrap = searchInput.closest('.search-wrap') || searchInput.parentElement;

  // ── Location search row ──
  const locRow = document.createElement('div');
  locRow.id        = 'loc-row';
  locRow.className = 'loc-row';
  locRow.innerHTML = `
    <div class="loc-input-wrap">
      <span class="loc-prefix-icon" aria-hidden="true">📍</span>
      <input
        id="loc-input"
        type="text"
        placeholder="Search by location…"
        autocomplete="off"
        spellcheck="false"
        aria-label="Search by location"
      />
      <button
        id="loc-gps-btn"
        class="loc-gps-btn"
        title="Use my current location"
        aria-label="Use my current location"
      >⊕</button>
    </div>
    <div class="loc-status" id="loc-status" aria-live="polite"></div>
  `;

  // Insert after the search wrapper
  searchWrap.insertAdjacentElement('afterend', locRow);

  // ── Radius filter row ──
  const radiusRow = document.createElement('div');
  radiusRow.id        = 'radius-row';
  radiusRow.className = 'radius-row hidden';
  radiusRow.innerHTML = `
    <label for="radius-select" class="radius-label">Show within</label>
    <select id="radius-select" class="radius-select">
      <option value="0">any distance</option>
      <option value="5">5 km</option>
      <option value="10">10 km</option>
      <option value="20">20 km</option>
      <option value="50">50 km</option>
      <option value="100">100 km</option>
    </select>
    <button id="loc-clear-btn" class="loc-clear-btn">✕ clear location</button>
  `;
  locRow.insertAdjacentElement('afterend', radiusRow);

  // ── Styles ──
  const style = document.createElement('style');
  style.textContent = `
    /* ── Location row ───────────────────────────────── */
    .loc-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0 4px;
    }
    .loc-input-wrap {
      display: flex;
      align-items: center;
      background: #111520;
      border: 1px solid #252b3d;
      border-radius: 6px;
      padding: 0 8px;
      gap: 6px;
      transition: border-color .2s;
    }
    .loc-input-wrap:focus-within {
      border-color: #00e5a0;
    }
    .loc-prefix-icon {
      font-size: 13px;
      opacity: .65;
      flex-shrink: 0;
      user-select: none;
    }
    #loc-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #dce2f0;
      font-family: 'Space Mono', monospace;
      font-size: 12px;
      padding: 9px 0;
    }
    #loc-input::placeholder { color: #3d4460; }

    /* ── GPS button (small) ─────────────────────────── */
    .loc-gps-btn {
      background: none;
      border: 1px solid #252b3d;
      border-radius: 4px;
      color: #00e5a0;
      font-size: 15px;
      line-height: 1;
      padding: 3px 6px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background .15s, border-color .15s;
    }
    .loc-gps-btn:hover {
      background: #00e5a015;
      border-color: #00e5a0;
    }
    .loc-gps-btn.loading {
      animation: loc-spin .8s linear infinite;
      opacity: .7;
      pointer-events: none;
    }
    @keyframes loc-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    /* ── Status line ────────────────────────────────── */
    .loc-status {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: #00e5a0;
      min-height: 14px;
      padding-left: 2px;
    }
    .loc-status.error { color: #ff6b6b; }

    /* ── Radius row ─────────────────────────────────── */
    .radius-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 2px 0 6px;
    }
    .radius-row.hidden { display: none; }
    .radius-label {
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: #7a85a8;
      white-space: nowrap;
    }
    .radius-select {
      background: #111520;
      border: 1px solid #252b3d;
      border-radius: 4px;
      color: #dce2f0;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      padding: 3px 6px;
      cursor: pointer;
      outline: none;
    }
    .loc-clear-btn {
      margin-left: auto;
      background: none;
      border: none;
      color: #7a85a8;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 3px;
      white-space: nowrap;
      transition: color .15s;
    }
    .loc-clear-btn:hover { color: #ff6b6b; }

    /* ── Distance badge on list items ───────────────── */
    .fac-dist {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: #7a85a8;
      white-space: nowrap;
      margin-left: 4px;
      align-self: center;
    }
    .fac-dist.nearby { color: #00e5a0; }
  `;
  document.head.appendChild(style);
})();

// ── Helper: Haversine distance (km) ─────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
               Math.cos(lat1 * Math.PI / 180) *
               Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Place / remove the user location pin ────────────────────
function setLocationPin(lat, lng) {
  if (locationPinLayer) {
    map.removeLayer(locationPinLayer);
    locationPinLayer = null;
  }
  if (lat == null) return;

  locationPinLayer = L.circleMarker([lat, lng], {
    radius:      10,
    fillColor:   '#f9c74f',
    color:       '#0b0e14',
    weight:      2,
    opacity:     1,
    fillOpacity: 0.95,
  }).addTo(map);

  locationPinLayer.bindTooltip('Your location', {
    permanent:  false,
    direction:  'top',
    className:  'fac-tooltip',
    offset:     [0, -6],
  });
}

// ── Activate a location ─────────────────────────────────────
function activateLocation(lat, lng, label) {
  userLat = lat;
  userLng = lng;

  setLocationPin(lat, lng);
  map.flyTo([lat, lng], 12, { duration: 1.4 });

  const status = document.getElementById('loc-status');
  status.className   = 'loc-status';
  status.textContent = `📍 ${label}`;

  document.getElementById('radius-row').classList.remove('hidden');
  render();
}

// ── Clear location ───────────────────────────────────────────
function clearLocation() {
  userLat = null;
  userLng = null;
  setLocationPin(null);

  document.getElementById('loc-input').value  = '';
  document.getElementById('loc-status').textContent = '';
  document.getElementById('loc-status').className = 'loc-status';
  document.getElementById('radius-row').classList.add('hidden');
  document.getElementById('radius-select').value = '0';
  activeRadius = 0;

  // Return to SA bounding box
  map.fitBounds(
    L.latLngBounds(L.latLng(-34.82, 16.47), L.latLng(-22.13, 32.89)),
    { padding: [20, 20] }
  );
  render();
}

// ── Geocode via Nominatim (free, no key) ────────────────────
async function geocodeLocation(query) {
  const status = document.getElementById('loc-status');
  status.className   = 'loc-status';
  status.textContent = 'Searching…';

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`;

  try {
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();

    if (!data || data.length === 0) {
      status.className   = 'loc-status error';
      status.textContent = 'Location not found — try a city or suburb name.';
      return;
    }

    const { lat, lon, display_name } = data[0];
    // Shorten the display name to the first two comma-separated parts
    const shortLabel = display_name.split(',').slice(0, 2).join(',').trim();
    activateLocation(parseFloat(lat), parseFloat(lon), shortLabel);

  } catch (err) {
    status.className   = 'loc-status error';
    status.textContent = 'Geocoding failed — check your connection.';
    console.error('Geocoding error:', err);
  }
}

// ── Geolocation (device GPS / network) ──────────────────────
function useMyLocation() {
  if (!navigator.geolocation) {
    const status = document.getElementById('loc-status');
    status.className   = 'loc-status error';
    status.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  const gpsBtn = document.getElementById('loc-gps-btn');
  const status = document.getElementById('loc-status');
  gpsBtn.classList.add('loading');
  status.className   = 'loc-status';
  status.textContent = 'Detecting your location…';

  navigator.geolocation.getCurrentPosition(
    position => {
      gpsBtn.classList.remove('loading');
      const { latitude: lat, longitude: lng } = position.coords;
      document.getElementById('loc-input').value = '';
      activateLocation(lat, lng, 'Current location');
    },
    error => {
      gpsBtn.classList.remove('loading');
      status.className   = 'loc-status error';
      const msgs = {
        1: 'Location permission denied.',
        2: 'Location unavailable.',
        3: 'Location request timed out.',
      };
      status.textContent = msgs[error.code] || 'Could not get location.';
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

// ── Event listeners for location UI ─────────────────────────
document.getElementById('loc-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) geocodeLocation(val);
  }
});

document.getElementById('loc-gps-btn').addEventListener('click', useMyLocation);

document.getElementById('loc-clear-btn').addEventListener('click', clearLocation);

// Lazy-bind radius select (injected above, so available now)
document.getElementById('radius-select').addEventListener('change', e => {
  activeRadius = parseInt(e.target.value, 10) || 0;
  render();
});

/* ============================================================
   SECTION 6 — RENDER LOGIC
   ============================================================ */

let activeIndex = null;

function render() {
  // ── 6a: Read filter state ─────────────────────────────
  const query  = searchInput.value.trim().toLowerCase();
  const prov   = provinceSelect.value;
  const type   = typeSelect.value;
  const sector = sectorSelect.value;

  // ── 6b: Filter dataset ────────────────────────────────
  let filtered = SA_FACILITIES.filter((f, i) => {
    f._index = i;

    // Text search
    if (query) {
      const haystack = `${f.name} ${f.city} ${f.province}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (prov   && f.province !== prov)   return false;
    if (type   && f.type     !== type)   return false;
    if (sector && f.sector   !== sector) return false;

    // Location-based radius filter
    if (userLat != null && activeRadius > 0) {
      const dist = haversineKm(userLat, userLng, f.lat, f.lng);
      if (dist > activeRadius) return false;
    }

    return true;
  });

  // ── 6c: Annotate with distance + sort ─────────────────
  if (userLat != null) {
    filtered.forEach(f => {
      f._distKm = haversineKm(userLat, userLng, f.lat, f.lng);
    });
    filtered.sort((a, b) => a._distKm - b._distKm);
  } else {
    filtered.forEach(f => { f._distKm = null; });
  }

  // ── 6d: Clear existing markers ────────────────────────
  markersLayer.clearLayers();
  Object.keys(markerRefs).forEach(k => delete markerRefs[k]);

  // ── 6e: Draw filtered markers ─────────────────────────
  filtered.forEach(f => {
    const marker = L.circleMarker([f.lat, f.lng], markerOptions(f));

    marker.bindTooltip(
      f._distKm != null
        ? `${f.name} (${f._distKm < 1 ? '<1' : Math.round(f._distKm)} km)`
        : f.name,
      { permanent: false, direction: 'top', className: 'fac-tooltip', offset: [0, -4] }
    );

    marker.on('click', () => openDetail(f));
    markersLayer.addLayer(marker);
    markerRefs[f._index] = marker;
  });

  // ── 6f: Rebuild sidebar list ──────────────────────────
  if (filtered.length === 0) {
    facilityList.innerHTML = `
      <li class="no-results">
        No facilities match your filters.<br>
        <span style="opacity:0.5">Try widening the search or increasing the radius.</span>
      </li>`;
  } else {
    facilityList.innerHTML = '';
    filtered.forEach(f => {
      const item = document.createElement('li');
      item.className   = 'facility-item' + (f._index === activeIndex ? ' active' : '');
      item.dataset.index = f._index;

      const dotClass = f.sector === 'private' ? 'private'
                     : f.type   === 'hospital' ? 'hospital'
                     : 'clinic';

      // Distance badge
      let distBadge = '';
      if (f._distKm != null) {
        const km      = f._distKm;
        const display = km < 1    ? '<1 km'
                      : km < 10   ? `${km.toFixed(1)} km`
                      :             `${Math.round(km)} km`;
        const cls     = km <= 5 ? 'fac-dist nearby' : 'fac-dist';
        distBadge     = `<span class="${cls}">${display}</span>`;
      }

      item.innerHTML = `
        <span class="fac-dot ${dotClass}" aria-hidden="true"></span>
        <div class="fac-info">
          <span class="fac-name" title="${f.name}">${f.name}</span>
          <span class="fac-sub">${f.city} · ${f.province}</span>
        </div>
        <span class="fac-badge ${f.sector}">${f.sector.toUpperCase()}</span>
        ${distBadge}`;

      item.addEventListener('click', () => {
        openDetail(f);
        map.flyTo([f.lat, f.lng], 13, { duration: 1.2 });
        if (markerRefs[f._index]) markerRefs[f._index].openTooltip();
      });

      facilityList.appendChild(item);
    });
  }

  // ── 6g: Update stats and HUD ──────────────────────────
  statShowing.textContent = filtered.length;
  statTotal.textContent   = TOTAL_COUNT;
  hudCount.textContent    = `${filtered.length} facilit${filtered.length === 1 ? 'y' : 'ies'} on map`;
}

/* ============================================================
   SECTION 7 — DETAIL CARD
   ============================================================ */

const detailCard   = document.getElementById('detail-card');
const dcName       = document.getElementById('dc-name');
const dcSub        = document.getElementById('dc-sub');
const dcChips      = document.getElementById('dc-chips');
const dcCoords     = document.getElementById('dc-coords');
const dcDirections = document.getElementById('dc-directions');

function openDetail(f) {
  activeIndex = f._index;

  dcName.textContent = f.name;
  dcSub.textContent  = `${f.city}, ${f.province}`;

  const typeLabel = f.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
  const typeClass = f.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
  const sectClass = f.sector === 'public' ? 'chip-public' : 'chip-private';

  // Distance chip (only when location is active)
  let distChip = '';
  if (f._distKm != null) {
    const km      = f._distKm;
    const display = km < 1 ? '<1 km' : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
    distChip = `<li class="chip chip-dist">${display} away</li>`;
  }

  dcChips.innerHTML = `
    <li class="chip ${typeClass}">${typeLabel}</li>
    <li class="chip ${sectClass}">${f.sector.toUpperCase()}</li>
    <li class="chip chip-prov">${f.province.toUpperCase()}</li>
    ${distChip}`;

  dcCoords.textContent = `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`;

  dcDirections.onclick = () => {
    // If we have the user's location, request directions from it
    const origin = userLat != null ? `&origin=${userLat},${userLng}` : '';
    const url    = `https://www.google.com/maps/dir/?api=1${origin}&destination=${f.lat},${f.lng}`;
    window.open(url, '_blank');
  };

  // ── Book Appointment button ─────────────────────────────
  let bookBtn = document.getElementById('dc-book');
  if (!bookBtn) {
    bookBtn = document.createElement('button');
    bookBtn.id        = 'dc-book';
    bookBtn.className = 'btn-book';
    bookBtn.textContent = '📅 See Facility';
    dcDirections.insertAdjacentElement('afterend', bookBtn);

    // Inject style once
    if (!document.getElementById('btn-book-style')) {
      const s = document.createElement('style');
      s.id = 'btn-book-style';
      s.textContent = `
        .btn-book {
          display: block;
          width: 100%;
          margin-top: 8px;
          padding: 10px;
          background: transparent;
          border: 1px solid var(--accent, #00e5a0);
          border-radius: 6px;
          color: var(--accent, #00e5a0);
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background .15s, color .15s;
        }
        .btn-book:hover {
          background: var(--accent, #00e5a0);
          color: #0b0e14;
        }
      `;
      document.head.appendChild(s);
    }
  }

  bookBtn.onclick = () => {
    const qs = new URLSearchParams({
      clinicID: f.clinicID || '',
      name:     f.name     || '',
      type:     f.type     || '',
      sector:   f.sector   || '',
      city:     f.city     || '',
      province: f.province || '',
    });
    window.location.href = `SeeFacilities.html?${qs}`;
  };

  detailCard.classList.remove('hidden');
  detailCard.offsetHeight; // force reflow
  detailCard.classList.add('visible');

  document.querySelectorAll('.facility-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.index) === activeIndex);
  });
}

function closeDetail() {
  detailCard.classList.remove('visible');
  detailCard.addEventListener('transitionend', () => {
    // Keep visible but collapsed — no need to fully hide
  }, { once: true });
  activeIndex = null;
  document.querySelectorAll('.facility-item').forEach(el => el.classList.remove('active'));
}

/* ============================================================
   SECTION 8 — EVENT WIRING
   ============================================================ */

searchInput.addEventListener('input', render);
provinceSelect.addEventListener('change', render);
typeSelect.addEventListener('change', render);
sectorSelect.addEventListener('change', render);

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  render();
});

document.getElementById('dc-close').addEventListener('click', closeDetail);
map.on('click', closeDetail);

// Tooltip CSS injection
const tooltipStyle = document.createElement('style');
tooltipStyle.textContent = `
  .fac-tooltip {
    background: #111520 !important;
    border: 1px solid #252b3d !important;
    color: #dce2f0 !important;
    font-family: 'Space Mono', monospace !important;
    font-size: 11px !important;
    padding: 5px 10px !important;
    border-radius: 5px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    white-space: nowrap !important;
  }
  .fac-tooltip::before { display: none; }

  /* Distance chip in detail card */
  .chip-dist {
    background: #1a2a1f;
    color: #00e5a0;
    border: 1px solid #00e5a033;
  }
`;
document.head.appendChild(tooltipStyle);

/* ============================================================
   SECTION 9 — INIT
   ============================================================ */

render();

const southAfricaBounds = L.latLngBounds(
  L.latLng(-34.82, 16.47),
  L.latLng(-22.13, 32.89)
);
map.fitBounds(southAfricaBounds, { padding: [20, 20] });