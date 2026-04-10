/* ============================================================
   SA HealthMap — directory.js
   ============================================================

   OVERVIEW — this file is organised into 8 sections:

   1. MAP INIT         — creates the Leaflet map, defines tile layer
                         and sets the default view over South Africa.

   2. MARKER STYLES    — defines colour-coded circle markers for
                         hospitals, clinics, and private facilities.

   3. LAYER GROUPS     — organises markers into a Leaflet LayerGroup
                         so the entire set can be cleared and redrawn
                         efficiently when filters change.

   4. SIDEBAR SETUP    — populates the province <select> dropdown
                         and wires up all filter/search controls.

   5. RENDER LOGIC     — the central render() function that reads
                         current filter state, filters SA_FACILITIES,
                         redraws map markers, rebuilds the sidebar
                         list, and updates the stats strip.

   6. DETAIL CARD      — handles opening, populating, and closing
                         the slide-up detail card when a facility
                         is clicked in the list or on the map.

   7. EVENT WIRING     — attaches all event listeners (search input,
                         filter selects, clear button, card close).

   8. INIT             — runs on page load: populates the sidebar,
                         does the initial render, and flies the map
                         to South Africa's bounding box.

   ============================================================ */


/* ============================================================
   SECTION 1 — MAP INIT
   ============================================================
   We use OpenStreetMap tiles (same as the main GeoExplorer map).
   The initial view is set to the geographic centre of South Africa
   at a zoom level that shows the whole country.
   ============================================================ */

const map = L.map('dir-map', {
  center:      [-29.0, 25.0], // geographic centre of South Africa
  zoom:        6,
  zoomControl: true,
});

// Move zoom control out of the top-left corner (the HUD lives there)
map.zoomControl.setPosition('bottomright');

// OpenStreetMap street tile layer — no API key required
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);


/* ============================================================
   SECTION 2 — MARKER STYLES
   ============================================================
   Leaflet's CircleMarker is used instead of the default pin so
   we can apply colour coding by facility type and sector.

   Colour logic:
     - Private facilities  → coral (#ff6b6b) regardless of type
     - Public hospitals    → blue  (#60b4ff)
     - Public clinics/CHC  → teal  (#00e5a0)
   ============================================================ */

/**
 * Returns a Leaflet CircleMarker options object for a given facility.
 * @param {Object} facility - A record from SA_FACILITIES
 * @returns {Object} Leaflet path options for L.circleMarker()
 */
function markerOptions(facility) {
  let color;

  if (facility.sector === 'private') {
    color = '#ff6b6b';           // coral — private sector
  } else if (facility.type === 'hospital') {
    color = '#60b4ff';           // blue — public hospital
  } else {
    color = '#00e5a0';           // teal — public clinic / CHC
  }

  return {
    radius:      facility.type === 'hospital' ? 8 : 6, // hospitals slightly larger
    fillColor:   color,
    color:       '#0b0e14',      // dark border matching page background
    weight:      1.5,
    opacity:     1,
    fillOpacity: 0.82,
  };
}


/* ============================================================
   SECTION 3 — LAYER GROUP
   ============================================================
   All facility markers are added to a single LayerGroup rather
   than directly to the map. This lets us call
   markersLayer.clearLayers() to wipe all markers in one call
   before redrawing filtered results.
   ============================================================ */

const markersLayer = L.layerGroup().addTo(map);

// Keeps a reference from facility index → Leaflet marker,
// so clicking a sidebar item can trigger the matching map marker.
const markerRefs = {};


/* ============================================================
   SECTION 4 — SIDEBAR SETUP
   ============================================================
   Reads PROVINCES (derived from SA_FACILITIES in facilities.js)
   and injects an <option> for each province into the select.
   ============================================================ */

// Populate province dropdown with real SA provinces from the dataset
const provinceSelect = document.getElementById('filter-province');
PROVINCES.forEach(prov => {
  const opt    = document.createElement('option');
  opt.value    = prov;
  opt.textContent = prov;
  provinceSelect.appendChild(opt);
});

// DOM references used throughout
const typeSelect   = document.getElementById('filter-type');
const sectorSelect = document.getElementById('filter-sector');
const searchInput  = document.getElementById('dir-search');
const clearBtn     = document.getElementById('dir-search-clear');
const facilityList = document.getElementById('facility-list');
const statShowing  = document.getElementById('stat-showing');
const statTotal    = document.getElementById('stat-total');
const hudCount     = document.getElementById('hud-count');


/* ============================================================
   SECTION 5 — RENDER LOGIC
   ============================================================
   render() is the single source of truth for what's visible.
   It runs whenever any filter or search value changes.

   Steps:
     a. Read current filter state from the DOM controls.
     b. Filter SA_FACILITIES against those values.
     c. Clear existing map markers.
     d. Add a new CircleMarker for each matching facility.
     e. Rebuild the sidebar list from matching facilities.
     f. Update the stats strip (count) and map HUD.
   ============================================================ */

// Tracks the currently selected (highlighted) facility index
let activeIndex = null;

function render() {

  // ── 5a: Read filter state ────────────────────────────────
  const query  = searchInput.value.trim().toLowerCase();
  const prov   = provinceSelect.value;
  const type   = typeSelect.value;
  const sector = sectorSelect.value;

  // ── 5b: Filter dataset ───────────────────────────────────
  const filtered = SA_FACILITIES.filter((f, i) => {
    // Store original index on the object so we can reference it later
    f._index = i;

    // Text search — matches name, city, or province
    if (query) {
      const haystack = `${f.name} ${f.city} ${f.province}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    // Province filter
    if (prov   && f.province !== prov)   return false;

    // Type filter — 'clinic' matches both 'clinic' and CHCs in the dataset
    if (type   && f.type     !== type)   return false;

    // Sector filter
    if (sector && f.sector   !== sector) return false;

    return true;
  });

  // ── 5c: Clear existing markers ───────────────────────────
  markersLayer.clearLayers();
  // Also clear the index → marker reference map
  Object.keys(markerRefs).forEach(k => delete markerRefs[k]);

  // ── 5d: Draw filtered markers ────────────────────────────
  filtered.forEach(f => {
    const marker = L.circleMarker([f.lat, f.lng], markerOptions(f));

    // Tooltip shows facility name on hover
    marker.bindTooltip(f.name, {
      permanent:   false,
      direction:   'top',
      className:   'fac-tooltip',
      offset:      [0, -4],
    });

    // Clicking a map marker opens the detail card and highlights the list item
    marker.on('click', () => openDetail(f));

    markersLayer.addLayer(marker);
    markerRefs[f._index] = marker; // store reference by original array index
  });

  // ── 5e: Rebuild sidebar list ─────────────────────────────
  if (filtered.length === 0) {
    facilityList.innerHTML = `
      <div class="no-results">
        No facilities match your filters.<br>
        <span style="opacity:0.5">Try widening the search.</span>
      </div>`;
  } else {
    facilityList.innerHTML = '';
    filtered.forEach(f => {
      const item = document.createElement('div');
      item.className = 'facility-item' + (f._index === activeIndex ? ' active' : '');
      item.dataset.index = f._index;

      // Determine dot class
      const dotClass = f.sector === 'private' ? 'private'
                     : f.type === 'hospital'   ? 'hospital'
                     : 'clinic';

      item.innerHTML = `
        <span class="fac-dot ${dotClass}"></span>
        <div class="fac-info">
          <div class="fac-name" title="${f.name}">${f.name}</div>
          <div class="fac-sub">${f.city} · ${f.province}</div>
        </div>
        <span class="fac-badge ${f.sector}">${f.sector.toUpperCase()}</span>`;

      // Click: pan map to marker, open detail card, highlight list item
      item.addEventListener('click', () => {
        openDetail(f);
        map.flyTo([f.lat, f.lng], 13, { duration: 1.2 });
        // Trigger the matching map marker's popup
        if (markerRefs[f._index]) {
          markerRefs[f._index].openTooltip();
        }
      });

      facilityList.appendChild(item);
    });
  }

  // ── 5f: Update stats and HUD ─────────────────────────────
  statShowing.textContent = filtered.length;
  statTotal.textContent   = TOTAL_COUNT;
  hudCount.textContent    = `${filtered.length} facilit${filtered.length === 1 ? 'y' : 'ies'} on map`;
}


/* ============================================================
   SECTION 6 — DETAIL CARD
   ============================================================
   The detail card is a slide-up panel anchored to the bottom-
   right of the map. It shows the full facility record.

   openDetail()  — populates and reveals the card
   closeDetail() — hides the card and removes active highlight
   ============================================================ */

const detailCard    = document.getElementById('detail-card');
const dcName        = document.getElementById('dc-name');
const dcSub         = document.getElementById('dc-sub');
const dcChips       = document.getElementById('dc-chips');
const dcCoords      = document.getElementById('dc-coords');
const dcDirections  = document.getElementById('dc-directions');

/**
 * Opens and populates the detail card for a facility.
 * @param {Object} f - A facility record from SA_FACILITIES
 */
function openDetail(f) {
  activeIndex = f._index;

  // Populate text fields
  dcName.textContent = f.name;
  dcSub.textContent  = `${f.city}, ${f.province}`;

  // Build type/sector chip badges
  const typeLabel   = f.type === 'hospital' ? 'HOSPITAL' : 'CLINIC / CHC';
  const typeClass   = f.type === 'hospital' ? 'chip-hosp' : 'chip-clinic';
  const sectorClass = f.sector === 'public'  ? 'chip-public' : 'chip-private';

  dcChips.innerHTML = `
    <span class="chip ${typeClass}">${typeLabel}</span>
    <span class="chip ${sectorClass}">${f.sector.toUpperCase()}</span>
    <span class="chip chip-prov">${f.province.toUpperCase()}</span>`;

  // Coordinates line
  dcCoords.textContent = `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`;

  // "Get Directions" opens Google Maps walking directions to the facility
  dcDirections.onclick = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
    window.open(url, '_blank');
  };

  // Show the card
  detailCard.classList.remove('hidden');
  // Force reflow before adding 'visible' so the CSS transition fires
  detailCard.offsetHeight;
  detailCard.classList.add('visible');

  // Highlight the corresponding sidebar list item
  document.querySelectorAll('.facility-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.index) === activeIndex);
  });
}

/** Hides the detail card and removes the active sidebar highlight. */
function closeDetail() {
  detailCard.classList.remove('visible');
  // Wait for CSS transition to finish, then hide the element entirely
  detailCard.addEventListener('transitionend', () => {
    if (!detailCard.classList.contains('visible')) {
      // Don't call hidden — keep it in place, just invisible
    }
  }, { once: true });
  activeIndex = null;
  document.querySelectorAll('.facility-item').forEach(el => el.classList.remove('active'));
}


/* ============================================================
   SECTION 7 — EVENT WIRING
   ============================================================
   All user-facing event listeners. Each one calls render() to
   refresh the map and list in response to input changes.
   ============================================================ */

// Live search — fires on every keystroke
searchInput.addEventListener('input', render);

// Province, type, and sector dropdowns
provinceSelect.addEventListener('change', render);
typeSelect.addEventListener('change',     render);
sectorSelect.addEventListener('change',   render);

// Clear search button — resets the input and re-renders
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  render();
});

// Close button on the detail card
document.getElementById('dc-close').addEventListener('click', closeDetail);

// Clicking the map background (not a marker) closes the detail card
map.on('click', closeDetail);

// Tooltip styling injection — Leaflet tooltips need custom CSS
// injected here because they live inside the Leaflet container
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
`;
document.head.appendChild(tooltipStyle);


/* ============================================================
   SECTION 8 — INIT
   ============================================================
   Runs once when the page first loads.

   Steps:
     1. Run initial render() to populate map + sidebar.
     2. Fit the map to South Africa's bounding box so all
        facilities are visible from the start.
   ============================================================ */

// Initial render — shows all facilities with no filters applied
render();

// Fit map to South Africa's geographic bounding box
// Bounds: SW corner (-34.82, 16.47) → NE corner (-22.13, 32.89)
const southAfricaBounds = L.latLngBounds(
  L.latLng(-34.82, 16.47),  // south-west: Cape Point area
  L.latLng(-22.13, 32.89)   // north-east: Limpopo / KZN border
);
map.fitBounds(southAfricaBounds, { padding: [20, 20] });