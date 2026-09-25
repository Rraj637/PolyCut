/* OSM Extract & Buffer Tool — Road / Building / Water boxes, API/Local modes */
'use strict';

const $ = (id) => document.getElementById(id);
let toastTimer = null;

/* ---------------- categories: har box ka apna pipeline + sub-category keys ---------------- */
const CATEGORIES = [
  {
    id: 'road', title: '\u{1F6E3}\uFE0F Road', accent: '#a0522d',
    extractLabel: 'Extract Roads', noun: 'roads',
    cacheKey: 'roads', tag: 'highway',
    mapLine: { color: '#1e6bff', weight: 2, opacity: 0.9 },
    keys: [
      { v: 'motorway', l: 'Motorway', on: true }, { v: 'trunk', l: 'Trunk', on: true },
      { v: 'primary', l: 'Primary', on: true }, { v: 'secondary', l: 'Secondary', on: true },
      { v: 'tertiary', l: 'Tertiary', on: true }, { v: 'residential', l: 'Residential', on: true },
      { v: 'unclassified', l: 'Unclassified', on: false }, { v: 'living_street', l: 'Living street', on: false },
      { v: 'service', l: 'Service', on: false }, { v: 'pedestrian', l: 'Pedestrian', on: false },
      { v: 'motorway_link', l: 'Motorway link', on: false }, { v: 'trunk_link', l: 'Trunk link', on: false },
      { v: 'primary_link', l: 'Primary link', on: false }, { v: 'secondary_link', l: 'Secondary link', on: false },
      { v: 'footway', l: 'Footway', on: false }, { v: 'path', l: 'Path', on: false },
      { v: 'cycleway', l: 'Cycleway', on: false }, { v: 'track', l: 'Track', on: false },
      { v: 'steps', l: 'Steps', on: false },
    ],
  },
  {
    id: 'building', title: '\u{1F3DB}\uFE0F Building', accent: '#b0203c',
    extractLabel: 'Extract Buildings', noun: 'buildings',
    cacheKey: 'buildings', tag: 'building',
    mapPoly: { color: '#7b1fa2', weight: 1, fillColor: '#ab47bc', fillOpacity: 0.45 },
    keys: [
      { v: 'yes', l: 'Yes (generic)', on: true }, { v: 'residential', l: 'Residential', on: true },
      { v: 'house', l: 'House', on: true }, { v: 'apartments', l: 'Apartments', on: true },
      { v: 'commercial', l: 'Commercial', on: true }, { v: 'retail', l: 'Retail', on: false },
      { v: 'industrial', l: 'Industrial', on: false }, { v: 'office', l: 'Office', on: false },
      { v: 'school', l: 'School', on: false }, { v: 'hospital', l: 'Hospital', on: false },
      { v: 'warehouse', l: 'Warehouse', on: false }, { v: 'garage', l: 'Garage', on: false },
      { v: 'garages', l: 'Garages', on: false }, { v: 'shed', l: 'Shed', on: false },
      { v: 'hut', l: 'Hut', on: false }, { v: 'roof', l: 'Roof', on: false },
      { v: 'church', l: 'Church', on: false }, { v: 'mosque', l: 'Mosque', on: false },
      { v: 'temple', l: 'Temple', on: false }, { v: 'hotel', l: 'Hotel', on: false },
    ],
  },
  {
    id: 'water', title: '\u{1F4A7} Water', accent: '#29abe2',
    extractLabel: 'Extract Water', noun: 'water features',
    cacheKey: 'water',
    mapPoly: { color: '#0277bd', weight: 1, fillColor: '#4fc3f7', fillOpacity: 0.5 },
    mapLine: { color: '#0277bd', weight: 2, opacity: 0.9 },
    keyGroups: [
      {
        label: 'Areas — polygons (water=)',
        cls: 'keyck-area', tag: 'water',
        keys: [
          { v: 'yes', l: 'Yes (any water)', on: true }, { v: 'river', l: 'River', on: true },
          { v: 'lake', l: 'Lake', on: true }, { v: 'pond', l: 'Pond', on: true },
          { v: 'reservoir', l: 'Reservoir', on: true }, { v: 'canal', l: 'Canal (area)', on: false },
          { v: 'basin', l: 'Basin', on: false }, { v: 'moat', l: 'Moat', on: false },
          { v: 'fishpond', l: 'Fishpond', on: false }, { v: 'fountain', l: 'Fountain', on: false },
        ],
      },
      {
        label: 'Lines — rivers & canals (waterway=)',
        cls: 'keyck-line', tag: 'waterway',
        keys: [
          { v: 'river', l: 'River', on: true }, { v: 'canal', l: 'Canal', on: true },
          { v: 'stream', l: 'Stream', on: false }, { v: 'drain', l: 'Drain', on: false },
          { v: 'ditch', l: 'Ditch', on: false }, { v: 'channel', l: 'Channel', on: false },
        ],
      },
    ],
  },
  {
    id: 'nature', title: '\u{1F33F} Natural & Land Use', accent: '#2e7d32',
    extractLabel: 'Extract Natural / Land Use', noun: 'natural & land use areas',
    cacheKey: 'nature', tag: 'natural',
    mapPoly: { color: '#2e7d32', weight: 1, fillColor: '#66bb6a', fillOpacity: 0.35 },
    keyGroups: [
      {
        label: 'Natural (natural=)',
        cls: 'keyck-area', tag: 'natural',
        keys: [
          { v: 'wood', l: 'Wood / Forest', on: true }, { v: 'scrub', l: 'Scrub', on: true },
          { v: 'grassland', l: 'Grassland', on: true }, { v: 'wetland', l: 'Wetland', on: true },
          { v: 'heath', l: 'Heath', on: false }, { v: 'sand', l: 'Sand', on: false },
          { v: 'bare_rock', l: 'Bare rock', on: false }, { v: 'beach', l: 'Beach', on: false },
          { v: 'tree', l: 'Tree / vegetation', on: false }, { v: 'scrub', l: '', skip: true },
        ].filter((k) => !k.skip),
      },
      {
        label: 'Land Use (landuse=)',
        cls: 'keyck-line', tag: 'landuse',
        keys: [
          { v: 'forest', l: 'Forest', on: true }, { v: 'farmland', l: 'Farmland', on: true },
          { v: 'meadow', l: 'Meadow', on: false }, { v: 'grass', l: 'Grass', on: true },
          { v: 'residential', l: 'Residential', on: false }, { v: 'commercial', l: 'Commercial', on: false },
          { v: 'industrial', l: 'Industrial', on: false }, { v: 'retail', l: 'Retail', on: false },
          { v: 'cemetery', l: 'Cemetery', on: false }, { v: 'quarry', l: 'Quarry', on: false },
        ],
      },
    ],
  },
];

const UNIT_TO_M = { m: 1, mm: 0.001, cm: 0.01, km: 1000, ft: 0.3048 };
const STEP_BY_UNIT = { m: 1, mm: 100, cm: 10, km: 0.1, ft: 5 };
const BUFFER_STYLE = { color: '#ff9800', weight: 2.5, opacity: 0.9, fillColor: '#ff9800', fillOpacity: 0.3 };
const DISSOLVED_STYLE = { color: '#2e7d32', weight: 1.5, fillColor: '#2e7d32', fillOpacity: 0.4 };

/* ---------------- per-category symbology (user-editable, session-level) ---------------- */
const SYMB = {};
/* base layer ka show/hide toggle — buffer/dissolve ke baad base (line/polygon) chhupao */
const baseHidden = {};
CATEGORIES.forEach((c) => {
  SYMB[c.id] = {
    stroke: (c.mapLine && c.mapLine.color) || (c.mapPoly && c.mapPoly.color) || c.accent,
    weight: c.id === 'road' ? 2 : 1,
    fillColor: (c.mapPoly && c.mapPoly.fillColor) || c.accent,
    fill: true,
    fillOpacity: (c.mapPoly && c.mapPoly.fillOpacity) != null ? c.mapPoly.fillOpacity : 0.4,
  };
});
function catStyle(cat, f) {
  const S = SYMB[cat.id];
  const isLine = f.geometry.type.indexOf('Line') >= 0;
  if (isLine) return { color: S.stroke, weight: S.weight, opacity: 0.95 };
  return {
    color: S.stroke, weight: Math.max(0.8, S.weight),
    fillColor: S.fillColor, fillOpacity: S.fill ? S.fillOpacity : 0, fill: S.fill,
  };
}

function metersPerPixel() {
  const c = map.getCenter();
  return 40075016.686 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom() + 8);
}

function utmLabel(b) {
  if (state.utmOverride) {
    const { zone, south } = state.utmOverride;
    const hemi = south ? 'S' : 'N';
    const epsg = (south ? 32700 : 32600) + zone;
    return `UTM Zone ${zone}${hemi} (EPSG:${epsg}) — manual override`;
  }
  const lat = (b.south + b.north) / 2, lon = (b.west + b.east) / 2;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const hemi = lat >= 0 ? 'N' : 'S';
  const epsg = (hemi === 'N' ? 32600 : 32700) + zone;
  return `UTM Zone ${zone}${hemi} (EPSG:${epsg})`;
}
function utmParams() {
  // server buffer calls ke liye override params (ya empty)
  if (!state.utmOverride) return {};
  return { utm_zone: state.utmOverride.zone, utm_south: state.utmOverride.south };
}

/* ---------------- map & base layers ---------------- */
const map = L.map('map', { preferCanvas: true }).setView([28.6139, 77.2090], 13);

map.createPane('polyPane').style.zIndex = 355;
map.createPane('bufPane').style.zIndex = 360;
map.createPane('disPane').style.zIndex = 370;
map.createPane('roadPane').style.zIndex = 380;
map.createPane('hlPane').style.zIndex = 400;   // local preview highlight
map.createPane('drawPane').style.zIndex = 420; // digitized features

const osmClassic = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
});
const osmTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17, subdomains: 'abc',
  attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)',
});
const esriImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
});
const esriLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Labels &copy; Esri',
});
const hybrid = L.layerGroup([esriImagery, esriLabels]);
const esriSatPure = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Imagery &copy; Esri (no labels)',
});
const esriTopo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: '&copy; Esri &mdash; Topographic',
});
const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: '&copy; Esri &mdash; Street Map',
});
const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
});
const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
});

osmClassic.addTo(map);
L.control.layers({
  'OSM Classic': osmClassic,
  'OSM Topo Map': osmTopo,
  'Satellite Hybrid (Esri + labels)': hybrid,
  'Satellite Only (Esri)': esriSatPure,
  'Topographic (Esri)': esriTopo,
  'Street Map (Esri)': esriStreet,
  'Light Gray Canvas (CARTO)': cartoLight,
  'Dark Canvas (CARTO)': cartoDark,
}, {}, { position: 'topright' }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const groups = {};
CATEGORIES.forEach((cat) => {
  groups[cat.id] = {
    base: L.layerGroup().addTo(map),
    buffer: L.layerGroup().addTo(map),
    dissolved: L.layerGroup().addTo(map),
  };
});

/* digitized + preview + snap + composite layers */
const drawnGroups = {
  points: L.layerGroup().addTo(map),
  lines: L.layerGroup().addTo(map),
  polys: L.layerGroup().addTo(map),
};
const compositeGroup = L.layerGroup().addTo(map);
const editGroup = L.layerGroup().addTo(map); // extracted layers ka editable render target
const previewGroups = {};
CATEGORIES.forEach((cat) => { previewGroups[cat.id] = L.layerGroup().addTo(map); });
const highlightGroup = L.layerGroup().addTo(map);
const snapGroup = L.layerGroup().addTo(map);
let rubberBand = null;   // drawing preview
let snapDot = null;      // snap indicator

/* ---------------- state & history (undo/redo) ---------------- */
function emptyState() {
  const layers = {};
  CATEGORIES.forEach((c) => {
    layers[c.id] = { fc: null, meta: null, bufferFC: null, bufferMeta: null, dissolvedFC: null, dissolveMeta: null };
  });
  return {
    bbox: null, bboxArea: 0, source: 'api', localId: null, localData: null, layers,
    utmOverride: null,  // {zone, south} — manual CRS override, null = auto
    composite: { type: 'FeatureCollection', features: [] },
    drawn: {
      points: { type: 'FeatureCollection', features: [] },
      lines: { type: 'FeatureCollection', features: [] },
      polys: { type: 'FeatureCollection', features: [] },
    },
  };
}
let state = emptyState();
let hist = [];
let hIdx = -1;
let busy = false;

function pushHist() {
  hist = hist.slice(0, hIdx + 1);
  hist.push(JSON.parse(JSON.stringify(state)));
  hIdx = hist.length - 1;
  rebuildSnapCache(); // har data change ke baad snap targets fresh karo
  updateHistBtns();
}
function applyHist(i) {
  if (i < 0 || i >= hist.length) return;
  hIdx = i;
  state = JSON.parse(JSON.stringify(hist[i]));
  clearSel();
  hideLiveGeom();
  rebuildSnapCache();
  syncSourceUI();
  render();
}
function updateHistBtns() {
  $('undoBtn').disabled = busy || hIdx <= 0;
  $('redoBtn').disabled = busy || hIdx >= hist.length - 1;
}

/* ---------------- status & toast ---------------- */
function status(msg) { $('status').textContent = msg || ''; }
function toast(msg, err) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 4500);
}

/* ---------------- area selection (drag rectangle) ---------------- */
let drawMode = false, drawing = false, startLL = null;
let selRect = null;
let searchMarker = null;
let extentRectHidden = false; // boundary off/on — data unaffected

const RECT_STYLE = { color: '#2266ff', weight: 2, dashArray: '6 4', fillOpacity: 0.05 };

$('extentToggleBtn').onclick = () => {
  extentRectHidden = !extentRectHidden;
  render();
};

function setDrawMode(on) {
  drawMode = on;
  $('drawBtn').classList.toggle('active', on);
  map.getContainer().style.cursor = on ? 'crosshair' : '';
  if (!on && drawing) { drawing = false; map.dragging.enable(); }
}
$('drawBtn').onclick = () => {
  if (!drawMode) { cancelDrawing(); setGisTool(null); }
  setDrawMode(!drawMode);
};

map.on('mousedown', (e) => {
  if (!drawMode) return;
  drawing = true;
  startLL = e.latlng;
  map.dragging.disable();
  if (selRect) { map.removeLayer(selRect); selRect = null; }
});
map.on('mousemove', (e) => {
  if (!drawing) return;
  const b = L.latLngBounds(startLL, e.latlng);
  if (!selRect) {
    selRect = L.rectangle(b, RECT_STYLE).addTo(map);
  } else {
    selRect.setBounds(b);
  }
  $('bboxInfo').textContent = bboxText(boundsToBBox(b));
});
map.on('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;
  map.dragging.enable();
  const bb = boundsToBBox(L.latLngBounds(startLL, e.latlng));
  const area = bboxAreaKm2(bb);
  if (area < 0.002) {
    toast('Selected area is too small — drag a bigger rectangle.', true);
    if (selRect) { map.removeLayer(selRect); selRect = null; }
    $('bboxInfo').textContent = 'No area selected yet.';
    return;
  }
  state.bbox = bb;
  state.bboxArea = area;
  setDrawMode(false);
  render();
  status(`Extent selected: ${area.toFixed(2)} km²`);
});

function boundsToBBox(b) {
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}
function bboxAreaKm2(b) {
  const mid = (b.south + b.north) / 2;
  return Math.abs(b.east - b.west) * 111.32 * Math.cos(mid * Math.PI / 180) * Math.abs(b.north - b.south) * 110.574;
}
function bboxText(b) {
  return `Area: ${bboxAreaKm2(b).toFixed(2)} km² — [${b.south.toFixed(4)}, ${b.west.toFixed(4)}] → [${b.north.toFixed(4)}, ${b.east.toFixed(4)}]`;
}

$('viewBtn').onclick = () => {
  state.bbox = boundsToBBox(map.getBounds());
  state.bboxArea = bboxAreaKm2(state.bbox);
  render();
  status(`Map view selected (${state.bboxArea.toFixed(2)} km²).`);
};

$('fitBtn').onclick = () => {
  if (!state.bbox) return;
  map.fitBounds([[state.bbox.south, state.bbox.west], [state.bbox.north, state.bbox.east]], { padding: [30, 30] });
};

/* ---------------- search: coordinates + Google-style autocomplete ---------------- */
const suggBox = $('suggestions');
let suggItems = [], suggIdx = -1, suggTimer = null;

function hideSuggestions() {
  suggBox.classList.add('hidden');
  suggBox.innerHTML = '';
  suggItems = [];
  suggIdx = -1;
}
function showSuggestions(items) {
  suggItems = items;
  suggIdx = -1;
  if (!items.length) { hideSuggestions(); return; }
  suggBox.innerHTML = items.map((it, i) =>
    `<div class="sugg" data-i="${i}"><span class="sugg-main">${it.main}</span>` +
    `<span class="sugg-sub">${it.sub}</span></div>`).join('');
  suggBox.classList.remove('hidden');
  suggBox.querySelectorAll('.sugg').forEach((el) => {
    el.onmousedown = (e) => { e.preventDefault(); pickSuggestion(+el.dataset.i); };
  });
}
function pickSuggestion(i) {
  const it = suggItems[i];
  hideSuggestions();
  if (!it) return;
  $('searchInput').value = it.main + (it.sub ? ', ' + it.sub.split(' · ')[0] : '');
  gotoResult(it.lat, it.lon, it.display);
}
async function fetchSuggestions(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'en' } });
    const j = await r.json();
    const items = (j || []).map((o) => {
      const parts = String(o.display_name).split(', ');
      return {
        lat: parseFloat(o.lat), lon: parseFloat(o.lon),
        main: parts[0],
        sub: parts.slice(1).join(' · '),
        display: o.display_name,
      };
    });
    showSuggestions(items);
  } catch (e) { hideSuggestions(); }
}
$('searchInput').addEventListener('input', () => {
  const q = $('searchInput').value.trim();
  clearTimeout(suggTimer);
  if (q.length < 3) { hideSuggestions(); return; }
  suggTimer = setTimeout(() => fetchSuggestions(q), 350); // debounced — Nominatim usage policy friendly
});
$('searchInput').addEventListener('keydown', (e) => {
  if (!suggItems.length) {
    if (e.key === 'Enter') doSearch();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggIdx = Math.min(suggIdx + 1, suggItems.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggIdx = Math.max(suggIdx - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggIdx >= 0) pickSuggestion(suggIdx);
    else if (suggItems.length) pickSuggestion(0);
    else doSearch();
    return;
  } else if (e.key === 'Escape') {
    hideSuggestions();
    return;
  } else return;
  suggBox.querySelectorAll('.sugg').forEach((el, i) => el.classList.toggle('active', i === suggIdx));
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.searchbox')) hideSuggestions();
});

$('searchBtn').onclick = doSearch;

async function doSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;
  const m = q.match(/^(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (m) {
    const lat = parseFloat(m[1]), lon = parseFloat(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      gotoResult(lat, lon, `Coordinate: ${lat.toFixed(5)}, ${lon.toFixed(5)}`, 15);
      return;
    }
  }
  status('Searching place…');
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'en' } });
    const j = await r.json();
    if (j && j.length) {
      gotoResult(parseFloat(j[0].lat), parseFloat(j[0].lon), j[0].display_name, 14);
    } else {
      toast('Place not found.', true);
      status('');
    }
  } catch (err) {
    toast('Search failed: ' + err.message, true);
    status('');
  }
}
function gotoResult(lat, lon, label, zoom) {
  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.marker([lat, lon]).addTo(map).bindPopup(label).openPopup();
  map.setView([lat, lon], zoom);
  status(label);
}

/* ---------------- API helper ---------------- */
async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* non-JSON error */ }
  if (!r.ok) throw new Error((j && j.error) || `Server error (HTTP ${r.status})`);
  return j;
}

/* ---------------- sub-category selection ---------------- */
function checkedValues(sel) {
  return new Set(Array.from(document.querySelectorAll(sel + ':checked')).map((c) => c.value));
}
function getSelectedKeys(cat) {
  if (cat.keyGroups) {
    const out = { area: new Set(), line: new Set() };
    cat.keyGroups.forEach((grp) => {
      const vals = checkedValues(`#cat-${cat.id} .${grp.cls}`);
      if (grp.cls === 'keyck-area') out.area = vals; else out.line = vals;
    });
    return out;
  }
  return { area: checkedValues(`#cat-${cat.id} .keyck`), line: new Set() };
}

function filterFeatures(cat, features) {
  const sel = getSelectedKeys(cat);
  if (cat.id === 'road') {
    return features.filter((f) => sel.area.has(f.properties.highway || ''));
  }
  if (cat.id === 'building') {
    return features.filter((f) => sel.area.has(f.properties.building || 'yes'));
  }
  if (cat.id === 'nature') {
    return features.filter((f) => f.geometry.type.indexOf('Polygon') >= 0 &&
      (sel.area.has(f.properties.natural || '') || sel.line.has(f.properties.landuse || '')));
  }
  const polys = features.filter((f) => f.geometry.type.indexOf('Polygon') >= 0 && sel.area.has(f.properties.water || 'yes'));
  const lines = features.filter((f) => f.geometry.type.indexOf('Line') >= 0 && sel.line.has(f.properties.waterway || ''));
  return [...polys, ...lines];
}

function computeMeta(cat, features) {
  const meta = { count: features.length };
  if (typeof turf !== 'undefined' && features.length) {
    let len = 0, area = 0;
    features.forEach((f) => {
      try {
        if (f.geometry.type.indexOf('Line') >= 0) len += turf.length(f, { units: 'kilometers' });
        else area += turf.area(f);
      } catch (e) { /* skip bad geometry */ }
    });
    meta.length_km = len;
    meta.area_m2 = area;
  }
  return meta;
}

/* ---------------- category pipelines (Extract → Buffer → Dissolve) ---------------- */
function catRoot(cat) { return document.getElementById('cat-' + cat.id); }
function catQuery(cat, sel) { return catRoot(cat).querySelector(sel); }

async function doExtract(cat) {
  if (busy || !state.bbox) return;
  const sel = getSelectedKeys(cat);
  const total = sel.area.size + sel.line.size;
  if (total === 0) { toast('Select at least one sub-category.', true); return; }

  busy = true; render();
  try {
    let features;
    if (state.source === 'local') {
      if (!state.localData) throw new Error('No cached dataset — use "Download Extent Data" first.');
      let cached;
      if (cat.id === 'water') {
        cached = [...state.localData.waterPoly.features, ...state.localData.waterLine.features];
      } else {
        const c = state.localData[cat.cacheKey];
        cached = c ? c.features : [];
      }
      features = filterFeatures(cat, cached);
      status(`Extracting ${cat.noun} from cached local data…`);
    } else {
      status(`Extracting ${cat.noun} from OpenStreetMap (live API)… large extents take a while`);
      let j;
      if (cat.cacheKey === 'roads') {
        j = await api('/api/extract', { ...state.bbox });
      } else {
        j = await api('/api/extract-poly', { ...state.bbox, kind: cat.id });
      }
      features = filterFeatures(cat, j.features || []);
    }
    if (!features.length) throw new Error('0 features matched — check sub-category filters or the extent.');

    const st = state.layers[cat.id];
    st.fc = { type: 'FeatureCollection', features };
    st.meta = computeMeta(cat, features);
    st.bufferFC = null; st.bufferMeta = null;
    st.dissolvedFC = null; st.dissolveMeta = null;
    pushHist(); render();
    status(`Extraction complete — ${features.length} ${cat.noun} (${state.source === 'local' ? 'cached' : 'live'}).`);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  busy = false; render();
}

function doBuffer(cat) {
  const st = state.layers[cat.id];
  if (busy || !st.fc) return;
  const width = parseFloat(catQuery(cat, '.buf-width').value);
  if (!(width > 0)) { toast('Enter a buffer width greater than 0.', true); return; }
  const unit = catQuery(cat, '.buf-unit').value;
  const widthM = width * UNIT_TO_M[unit];

  busy = true; render();
  status(`Creating ${cat.title} buffer (turf.js): ${width} ${unit}…`);

  setTimeout(async () => {
    try {
      let feats, engine;
      if (typeof turf !== 'undefined') {
        const buffered = turf.buffer(st.fc, widthM, { units: 'meters' });
        feats = (buffered && buffered.features ? buffered.features : [])
          .filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
        engine = 'turf.js';
      } else {
        feats = null;
      }
      if (!feats || !feats.length) {
        // turf fail/empty ho to server-side shapely fallback (UTM-accurate)
        status('turf.js produced no buffer — falling back to server-side Shapely buffer…');
        const j = await api('/api/buffer', { geojson: st.fc, width, unit, cap: 'round', ...utmParams() });
        feats = j.features;
        engine = 'server (shapely)';
      }
      if (!feats.length) throw new Error('Buffer empty nikla — width bahut chhota hai?');

      st.bufferFC = { type: 'FeatureCollection', features: feats };
      st.bufferMeta = { count: feats.length, width, unit, width_m: widthM, engine };
      st.dissolvedFC = null; st.dissolveMeta = null;
      pushHist(); render();

      const px = widthM / metersPerPixel();
      if (px < 1.5) {
        toast(`Buffer created (${feats.length} polygons) but only ~${px.toFixed(2)} px wide at this zoom — invisible on the map. Zoom in or increase the width.`, true);
        status('Buffer created, but invisible at the current zoom level. Zoom in or increase the width.');
      } else {
        status(`${cat.title} buffer created — ${feats.length} polygons (${engine}). Dissolve optional hai.`);
      }
    } catch (err) {
      toast('Buffer failed: ' + err.message, true);
      status('');
    }
    busy = false; render();
  }, 60);
}

async function doDissolve(cat) {
  const st = state.layers[cat.id];
  if (busy || !st.bufferFC) return;
  busy = true; render();
  status(`Dissolving ${cat.title} buffer polygons…`);
  try {
    const j = await api('/api/dissolve', { geojson: st.bufferFC });
    st.dissolvedFC = { type: 'FeatureCollection', features: j.features };
    st.dissolveMeta = j.meta;
    pushHist(); render();
    status(`${cat.title} dissolved — ${j.meta.parts_in} polygons merged into ${j.meta.parts_out}.`);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  busy = false; render();
}

/* ---------------- one-click extract all (all categories) ---------------- */
async function doExtractAll() {
  if (busy || !state.bbox) return;
  busy = true; render();
  try {
    if (state.source === 'api') {
      // server cache hit? (avoid a repeat Overpass request)
      const cid = `${state.bbox.south.toFixed(4)}_${state.bbox.west.toFixed(4)}_${state.bbox.north.toFixed(4)}_${state.bbox.east.toFixed(4)}`;
      const pre = await fetch(`/api/local/get?id=${encodeURIComponent(cid)}`);
      if (pre.ok) {
        state.localData = await pre.json();
        state.localId = cid;
        saveLocalDataset(state.localData, cid);
      } else {
        status('One-shot OSM request (all categories in a single Overpass call)…');
        const j = await api('/api/local/download', { ...state.bbox });
        state.localData = await fetch(`/api/local/get?id=${encodeURIComponent(j.id)}`).then((r) => {
          if (!r.ok) throw new Error('Downloaded data could not be loaded (HTTP ' + r.status + ')');
          return r.json();
        });
        state.localId = j.id;
        saveLocalDataset(state.localData, j.id);
      }
      state.source = 'local';
      syncSourceUI();
    }
    if (!state.localData) throw new Error('No cached dataset available — retry in API mode.');

    const results = {};
    for (const cat of CATEGORIES) {
      const cached = cat.id === 'water'
        ? [...state.localData.waterPoly.features, ...state.localData.waterLine.features]
        : ((state.localData[cat.cacheKey] || { features: [] }).features);
      const features = filterFeatures(cat, cached);
      if (features.length) {
        const st = state.layers[cat.id];
        st.fc = { type: 'FeatureCollection', features };
        st.meta = computeMeta(cat, features);
        st.bufferFC = null; st.bufferMeta = null;
        st.dissolvedFC = null; st.dissolveMeta = null;
      }
      results[cat.id] = features.length;
    }
    pushHist(); render();
    status(`Batch extraction complete — ${results.road} road, ${results.building} building, ${results.water} water, ${results.nature} natural features.`);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  busy = false; render();
}

/* ---------------- local data download ---------------- */
$('downloadBtn').onclick = async () => {
  if (busy) return;
  if (!state.bbox) { toast('Select an extent first (Draw Extent or Map Extent).', true); return; }
  busy = true; render();
  try {
    const cid = `${state.bbox.south.toFixed(4)}_${state.bbox.west.toFixed(4)}_${state.bbox.north.toFixed(4)}_${state.bbox.east.toFixed(4)}`;
    let data = null, j = null;
    // same extent ka cache server pe already hai?
    const pre = await fetch(`/api/local/get?id=${encodeURIComponent(cid)}`);
    if (pre.ok) {
      data = await pre.json();
      j = {
        id: cid,
        counts: {
          roads: data.roads.features.length, buildings: data.buildings.features.length,
          waterPoly: data.waterPoly.features.length, waterLine: data.waterLine.features.length,
          nature: data.nature ? data.nature.features.length : 0,
        },
        cached: true,
      };
    } else {
      status('Downloading extent data from OSM (roads + buildings + water + natural + land use)… large extents take minutes');
      j = await api('/api/local/download', { ...state.bbox });
      data = await fetch(`/api/local/get?id=${encodeURIComponent(j.id)}`).then((r) => {
        if (!r.ok) throw new Error('Downloaded data could not be loaded (HTTP ' + r.status + ')');
        return r.json();
      });
    }
    state.localId = j.id;
    state.localData = data;
    state.source = 'local';
    syncSourceUI();
    pushHist(); render();
    status(`Cached dataset loaded — ${j.counts.roads} roads, ${j.counts.buildings} buildings, ${j.counts.waterPoly} water areas, ${j.counts.waterLine} water lines, ${j.counts.nature || 0} natural features.`);
    saveLocalDataset(data, j.id);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  busy = false; render();
};

function syncSourceUI() {
  document.querySelectorAll('input[name="srcmode"]').forEach((r) => { r.checked = r.value === state.source; });
}
document.querySelectorAll('input[name="srcmode"]').forEach((r) => {
  r.onchange = () => {
    state.source = r.value;
    render();
    if (r.value === 'local' && !state.localData) {
      toast('No local dataset yet — use "Download Extent Data" or load a saved dataset.', true);
    }
  };
});

/* ---------------- undo / redo / clear ---------------- */
$('undoBtn').onclick = () => { if (!busy) applyHist(hIdx - 1); };
$('redoBtn').onclick = () => { if (!busy) applyHist(hIdx + 1); };
$('clearBtn').onclick = () => {
  if (busy) return;
  state = emptyState();
  syncSourceUI();
  pushHist(); render();
  status('Session cleared. (Undo restores everything.)');
};

/* ---------------- exports ---------------- */
function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportFC(name, fc) {
  if (!fc) return;
  downloadBlob(name, new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }));
}
function selectedExport() {
  const cat = $('expCat').value;
  if (cat === 'composite') return { cat, stage: 'composite', fc: state.composite };
  return { cat, stage: $('expStage').value, fc: state.layers[cat][$('expStage').value] };
}
async function exportViaServer(path, body, filename, mime) {
  const r = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = 'Export fail (HTTP ' + r.status + ')';
    try { msg = (await r.json()).error || msg; } catch (e) { /* keep default */ }
    throw new Error(msg);
  }
  downloadBlob(filename, await r.blob());
}
function captureMap(kind) {
  if (typeof html2canvas === 'undefined') { toast('html2canvas not loaded — check the internet connection.', true); return; }
  busy = true; render();
  status('Rendering map view…');
  html2canvas(document.getElementById('map'), { useCORS: true, logging: false }).then((canvas) => {
    if (kind === 'png') {
      canvas.toBlob((b) => downloadBlob('map-view.png', b), 'image/png');
    } else {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'px', format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save('map-view.pdf');
    }
    status('Exported.');
  }).catch((e) => {
    toast('Map render fail: ' + e.message, true);
    status('');
  }).finally(() => { busy = false; render(); });
}

function exportName(cat, stage) {
  if (cat === 'composite') return 'composite-map';
  return `${cat}-${stage === 'fc' ? 'base' : stage.replace('FC', '').toLowerCase() || 'base'}`;
}

$('fmtGeojson').onclick = () => {
  const { cat, stage, fc } = selectedExport();
  if (!fc || !fc.features || !fc.features.length) { toast('Nothing to export at this stage — extract or buffer first.', true); return; }
  exportFC(`${exportName(cat, stage)}.geojson`, fc);
};
$('fmtShp').onclick = async () => {
  const { cat, stage, fc } = selectedExport();
  if (!fc || !fc.features || !fc.features.length) { toast('Nothing to export at this stage — extract or buffer first.', true); return; }
  busy = true; render();
  try {
    await exportViaServer('/api/export/shp', { geojson: fc, name: exportName(cat, stage) },
      `${exportName(cat, stage)}-shapefile.zip`, 'application/zip');
    status('Shapefile ZIP downloaded.');
  } catch (err) { toast(err.message, true); }
  busy = false; render();
};
$('fmtSvg').onclick = async () => {
  const { cat, stage, fc } = selectedExport();
  if (!fc || !fc.features || !fc.features.length) { toast('Nothing to export at this stage — extract or buffer first.', true); return; }
  const conf = CATEGORIES.find((c) => c.id === cat);
  const S = conf ? SYMB[conf.id] : { stroke: '#e91e63', fillColor: '#e91e63', fill: true, fillOpacity: 0.4 };
  busy = true; render();
  try {
    await exportViaServer('/api/export/svg', {
      geojson: fc, name: exportName(cat, stage),
      stroke: S.stroke, fill: S.fillColor,
      fill_opacity: S.fill ? S.fillOpacity : 0,
    }, `${exportName(cat, stage)}.svg`, 'image/svg+xml');
    status('SVG downloaded (symbology applied).');
  } catch (err) { toast(err.message, true); }
  busy = false; render();
};
$('fmtPdf').onclick = () => captureMap('pdf');
$('fmtPng').onclick = () => captureMap('png');

/* ---------------- all-in-one export (every dataset in one ZIP) ---------------- */
function collectAllExports() {
  const out = [];
  CATEGORIES.forEach((cat) => {
    const st = state.layers[cat.id];
    const S = SYMB[cat.id];
    [['fc', 'base'], ['bufferFC', 'buffer'], ['dissolvedFC', 'dissolved']].forEach(([key, label]) => {
      const fc = st[key];
      if (fc && fc.features && fc.features.length) {
        out.push({
          name: `${cat.id}-${label}`,
          geojson: fc,
          style: {
            stroke: S.stroke,
            fill: S.fillColor,
            fill_opacity: S.fill ? S.fillOpacity : 0,
          },
        });
      }
    });
  });
  // composite + digitized features pack me
  if (state.composite && state.composite.features.length) {
    out.push({ name: 'composite-map', geojson: state.composite, style: { stroke: '#e91e63', fill: '#e91e63', fill_opacity: 0.2 } });
  }
  [['points', 'drawn-points'], ['lines', 'drawn-lines'], ['polys', 'drawn-polys']].forEach(([key, label]) => {
    const fc = state.drawn[key];
    if (fc && fc.features.length) {
      out.push({ name: label, geojson: fc, style: { stroke: '#00bcd4', fill: '#00bcd4', fill_opacity: 0.2 } });
    }
  });
  return out;
}

$('fmtAll').onclick = async () => {
  const entries = collectAllExports();
  if (!entries.length) { toast('Nothing to export yet — run an extract first.', true); return; }
  busy = true; render();
  status(`Packing ${entries.length} datasets into one ZIP (GeoJSON + SHP + SVG each)…`);
  try {
    await exportViaServer('/api/export/all', { name: 'osm-export-all', exports: entries },
      'osm-export-all.zip', 'application/zip');
    status(`All-in-one ZIP downloaded — ${entries.length} datasets, one folder each with GeoJSON + SHP + SVG.`);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  busy = false; render();
};

/* ================= GIS DIGITIZING TOOLBOX =================
   Point/Line/Polygon draw, select/edit/move, merge, split, delete.
   Snapping: vertex (poore project me) + edge (drawn features), 10px tolerance. */
const DRAWN_STYLE = { color: '#00bcd4', weight: 2.5, opacity: 0.95, fillColor: '#00bcd4', fillOpacity: 0.18 };
const DRAWN_LINE_STYLE = { color: '#00bcd4', weight: 2.5, opacity: 0.95 };
const SELECTED_STYLE = { color: '#ffd600', weight: 4, opacity: 1, fillColor: '#ffd600', fillOpacity: 0.28 };
const SELECTED_LINE_STYLE = { color: '#ffd600', weight: 4, opacity: 1 };
const PREVIEW_STYLES = {
  road: { color: '#1e6bff', weight: 1.5, opacity: 0.55 },
  building: { color: '#7b1fa2', weight: 1, fillColor: '#ab47bc', fillOpacity: 0.25 },
  water: { color: '#0277bd', weight: 1.5, opacity: 0.6, fillColor: '#4fc3f7', fillOpacity: 0.3 },
};
const HIGHLIGHT_STYLE = { color: '#ff3d00', weight: 4, opacity: 1, fillColor: '#ff3d00', fillOpacity: 0.35 };

let gisTool = null;          // null = Select | 'point' | 'line' | 'poly' | 'split'
let drawPts = [];            // in-progress vertices (L.LatLng)
let snapTargets = [];        // cached [lon, lat] arrays for vertex snapping
let snappingOn = true;
let snapPx = 12;             // snap tolerance in pixels (slider 0-100)
let selRefs = [];            // selected editable features: [{coll, feat}]
let lastClickAt = 0;
const vertexHandles = L.layerGroup().addTo(map);
const liveGeom = L.layerGroup().addTo(map);

/* ---------- helpers ---------- */
function distMeters(a, b) {
  const midLat = (a.lat + b.lat) / 2;
  const dx = (b.lng - a.lng) * 111320 * Math.cos(midLat * Math.PI / 180);
  const dy = (b.lat - a.lat) * 110574;
  return Math.sqrt(dx * dx + dy * dy);
}
function coordPositions(geometry) {
  // har [lng,lat] pair ka {arr, i} reference — vertex edit/move ke liye
  const out = [];
  const t = geometry.type;
  if (t === 'Point') out.push({ arr: geometry.coordinates, i: 0, isPair: true });
  else if (t === 'MultiPoint' || t === 'LineString' || t === 'MultiLineString') {
    if (t === 'LineString') geometry.coordinates.forEach((_, i) => out.push({ arr: geometry.coordinates, i }));
    else geometry.coordinates.forEach((part) => part.forEach((_, i) => out.push({ arr: part, i })));
  } else if (t === 'Polygon') geometry.coordinates.forEach((ring) => ring.forEach((_, i) => out.push({ arr: ring, i })));
  else if (t === 'MultiPolygon') geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((_, i) => out.push({ arr: ring, i }))));
  return out;
}
function shiftedGeometry(geometry, dLat, dLng) {
  const g = JSON.parse(JSON.stringify(geometry));
  coordPositions(g).forEach((pos) => {
    if (pos.isPair) { g.coordinates = [g.coordinates[0] + dLng, g.coordinates[1] + dLat]; return; }
    const cur = pos.arr[pos.i];
    pos.arr[pos.i] = [cur[0] + dLng, cur[1] + dLat];
  });
  return g;
}
function featureMetrics(f) {
  const t = f.geometry.type;
  try {
    if (t === 'LineString' || t === 'MultiLineString') return { length_m: turf.length(f, { units: 'kilometers' }) * 1000 };
    if (t === 'Polygon' || t === 'MultiPolygon') {
      return { area_m2: turf.area(f), perimeter_m: turf.length(f, { units: 'kilometers' }) * 1000 };
    }
  } catch (e) { /* skip */ }
  return {};
}
function recomputeMetrics(f) { Object.assign(f.properties, featureMetrics(f)); }
function showLiveGeom(geometry) {
  liveGeom.clearLayers();
  L.geoJSON({ type: 'Feature', geometry, properties: {} }, {
    pane: 'drawPane', interactive: false,
    style: { color: '#ff00ff', weight: 2, dashArray: '4 4', fillOpacity: 0.1 },
    pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 5, color: '#ff00ff', fillOpacity: 0.8 }),
  }).addTo(liveGeom);
}
function hideLiveGeom() { liveGeom.clearLayers(); }

/* ---------- editable collections: GIS tools map pe jo dikh raha hai usi pe chalte hain ----------
   local mode = cached dataset (bina Extract ke bhi editable), API mode = extracted dataset. */
function editableCollections() {
  const cols = [];
  ['points', 'lines', 'polys'].forEach((k) => {
    if (state.drawn[k] && state.drawn[k].features.length) {
      cols.push({ id: 'drawn-' + k, label: 'Digitized', store: k, fc: state.drawn[k] });
    }
  });
  CATEGORIES.forEach((cat) => {
    const st = state.layers[cat.id];
    const pool = visiblePoolFor(cat);
    if (pool && pool.features && pool.features.length) {
      cols.push({ id: cat.id + '-base', label: cat.title, fc: pool });
    }
    if (st.bufferFC && st.bufferFC.features.length) cols.push({ id: cat.id + '-buffer', label: cat.title + ' Buffer', fc: st.bufferFC });
    if (st.dissolvedFC && st.dissolvedFC.features.length) cols.push({ id: cat.id + '-dissolved', label: cat.title + ' Dissolved', fc: st.dissolvedFC });
  });
  if (state.composite && state.composite.features.length) {
    cols.push({ id: 'composite', label: 'Composite', fc: state.composite });
  }
  return cols;
}
function collectionById(id) { return editableCollections().find((c) => c.id === id) || null; }
function removeFeature(collId, feat) {
  const col = collectionById(collId);
  if (col) col.fc.features = col.fc.features.filter((f) => f !== feat);
}

/* ---------- snapping engine ---------- */
function rebuildSnapCache() {
  snapTargets = [];
  const pushFC = (fc) => {
    if (!fc || !fc.features) return;
    fc.features.forEach((f) => {
      coordPositions(f.geometry).forEach((pos) => {
        if (pos.isPair) snapTargets.push([pos.arr[0], pos.arr[1]]);
        else snapTargets.push(pos.arr[pos.i]);
      });
    });
  };
  editableCollections().forEach((col) => pushFC(col.fc));
}
function nearestVertexSnap(ll, tolM) {
  let best = null, bestD = tolM;
  for (const p of snapTargets) {
    const dy = (p[1] - ll.lat) * 110574;
    if (Math.abs(dy) > bestD) continue;
    const dx = (p[0] - ll.lng) * 111320 * Math.cos(ll.lat * Math.PI / 180);
    if (Math.abs(dx) > bestD) continue;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { latLng: L.latLng(best[1], best[0]), kind: 'vertex' } : null;
}
function nearestEdgeSnap(ll, tolM) {
  // saare editable polygon/line features ke segments pe projection (precise join)
  let best = null, bestD = tolM;
  const checkSegs = (coords, closed) => {
    for (let i = 0; i < coords.length - (closed ? 0 : 1); i++) {
      const a = L.latLng(coords[i][1], coords[i][0]);
      const b = L.latLng(coords[(i + 1) % coords.length][1], coords[(i + 1) % coords.length][0]);
      const abLat = b.lat - a.lat, abLng = b.lng - a.lng;
      const len2 = abLat * abLat + abLng * abLng;
      let t = len2 ? ((ll.lat - a.lat) * abLat + (ll.lng - a.lng) * abLng) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const proj = L.latLng(a.lat + t * abLat, a.lng + t * abLng);
      const d = distMeters(ll, proj);
      if (d < bestD) { bestD = d; best = proj; }
    }
  };
  editableCollections().forEach((col) => {
    col.fc.features.forEach((f) => {
      const c = f.geometry.coordinates;
      const t = f.geometry.type;
      if (t === 'LineString') checkSegs(c, false);
      else if (t === 'MultiLineString') c.forEach((line) => checkSegs(line, false));
      else if (t === 'Polygon') c.forEach((ring) => checkSegs(ring, true));
      else if (t === 'MultiPolygon') c.forEach((poly) => poly.forEach((ring) => checkSegs(ring, true)));
    });
  });
  return best ? { latLng: best, kind: 'edge' } : null;
}
function snapLatLng(ll) {
  hideSnapDot();
  if (!snappingOn || snapPx <= 0) return { latLng: ll, kind: null };
  const tolM = snapPx * metersPerPixel();
  const hit = nearestVertexSnap(ll, tolM) || nearestEdgeSnap(ll, tolM);
  if (hit) {
    snapDot = L.circleMarker(hit.latLng, { radius: 5, color: '#ff00ff', weight: 2, fillColor: '#ff00ff', fillOpacity: 0.9 })
      .addTo(snapGroup);
  }
  return hit || { latLng: ll, kind: null };
}
function hideSnapDot() { if (snapDot) { snapGroup.removeLayer(snapDot); snapDot = null; } }

/* ---------- selection ---------- */
function getSel(feat) { return selRefs.find((r) => r.feat === feat) || null; }
function clearSel() { selRefs = []; }
function selectedFeature() { return selRefs.length === 1 ? selRefs[0] : null; }

/* ---------- tool management ---------- */
function setGisTool(tool) {
  cancelDrawing();
  gisTool = (gisTool === tool) ? null : tool;
  if (gisTool !== 'split') clearSel(); // split ke waqt selection preserve (usko cut karna hai)
  if (gisTool) setDrawMode(false);
  map.getContainer().style.cursor = gisTool ? 'crosshair' : '';
  ['gtSelect', 'gtPoint', 'gtLine', 'gtPoly', 'gtSplit'].forEach((id) => $(id).classList.remove('active'));
  const activeId = { point: 'gtPoint', line: 'gtLine', poly: 'gtPoly', split: 'gtSplit' }[gisTool] || 'gtSelect';
  $(activeId).classList.add('active');
  map.doubleClickZoom[drawPts.length || gisTool ? 'disable' : 'enable']();
  updateGisReadout();
}
function updateGisReadout(extra) {
  const el = $('gisReadout');
  const toolName = { point: 'Point draw', line: 'Line draw', poly: 'Polygon draw', split: 'Split (line draw)' }[gisTool] || 'Select';
  let s = `Tool: ${toolName}`;
  if (drawPts.length) {
    s += ` | ${drawPts.length} vertices`;
    if (gisTool === 'line' || gisTool === 'split') s += ` | ${(runningLength() / 1000).toFixed(2)} km`;
    if (gisTool === 'poly' && drawPts.length >= 3) s += ` | ${Math.round(runningArea()).toLocaleString()} m²`;
  }
  if (extra) s += ` | ${extra}`;
  if (selRefs.length) s += ` | selected: ${selRefs.length}`;
  el.textContent = s;
}
function runningLength() {
  let m = 0;
  for (let i = 1; i < drawPts.length; i++) m += distMeters(drawPts[i - 1], drawPts[i]);
  return m;
}
function runningArea() {
  try {
    return turf.area(turf.polygon([drawPts.concat([drawPts[0]]).map((ll) => [ll.lng, ll.lat])]));
  } catch (e) { return 0; }
}

/* ---------- drawing ---------- */
function handleDrawClick(e) {
  const snap = snapLatLng(e.latlng);

  // point tool — ek click me commit
  if (gisTool === 'point') {
    drawPts = [snap.latLng];
    finishDrawing();
    return;
  }

  // polygon close-on-first-vertex
  if ((gisTool === 'poly' || gisTool === 'split') && drawPts.length >= 3) {
    const first = drawPts[0];
    if (distMeters(first, snap.latLng) < Math.max(1, 8 * metersPerPixel())) { finishDrawing(); return; }
  }
  drawPts.push(snap.latLng);
  updateRubberBand(snap.latLng);
  updateGisReadout(snap.kind ? `SNAP: ${snap.kind}` : null);
}
function updateRubberBand(cursorLL) {
  if (rubberBand) { map.removeLayer(rubberBand); rubberBand = null; }
  if (!drawPts.length) return;
  const pts = drawPts.concat(cursorLL ? [cursorLL] : []);
  if (gisTool === 'poly' && pts.length >= 3) pts.push(pts[0]);
  if (pts.length >= 2) {
    rubberBand = L.polyline(pts, { color: '#ff00ff', weight: 2, dashArray: '5 5', interactive: false }).addTo(map);
  }
}
function dedupe(pts) {
  const out = [];
  pts.forEach((p) => {
    const last = out[out.length - 1];
    if (!last || last.lat !== p.lat || last.lng !== p.lng) out.push(p);
  });
  return out;
}
function nextName(store) {
  return store.charAt(0).toUpperCase() + store.slice(1, -1) + ' ' + (state.drawn[store].features.length + 1);
}
function finishDrawing() {
  const tool = gisTool;
  clearTimeout(gisClickTimer);
  drawPts = dedupe(drawPts);
  hideSnapDot();
  if (rubberBand) { map.removeLayer(rubberBand); rubberBand = null; }
  map.doubleClickZoom.enable();

  if (tool === 'line' && drawPts.length >= 2) {
    const f = { type: 'Feature', geometry: { type: 'LineString', coordinates: drawPts.map((p) => [p.lng, p.lat]) },
                properties: { name: nextName('lines') } };
    recomputeMetrics(f);
    state.drawn.lines.features.push(f);
    pushHist(); rebuildSnapCache(); render();
    status(`Line drawn — ${Math.round(f.properties.length_m)} m. Select tool se edit kar sakte ho.`);
  } else if (tool === 'poly' && drawPts.length >= 3) {
    const f = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [drawPts.concat([drawPts[0]]).map((p) => [p.lng, p.lat])] },
                properties: { name: nextName('polys') } };
    recomputeMetrics(f);
    state.drawn.polys.features.push(f);
    pushHist(); rebuildSnapCache(); render();
    status(`Polygon drawn — ${Math.round(f.properties.area_m2).toLocaleString()} m². Select tool se edit kar sakte ho.`);
  } else if (tool === 'point' && drawPts.length >= 1) {
    const f = { type: 'Feature', geometry: { type: 'Point', coordinates: [drawPts[0].lng, drawPts[0].lat] },
                properties: { name: nextName('points') } };
    state.drawn.points.features.push(f);
    pushHist(); rebuildSnapCache(); render();
    status('Point drawn.');
  } else if (tool === 'split' && drawPts.length >= 2) {
    const sel = selectedFeature();
    if (!sel) {
      toast('Select a polygon first (Select tool), then use Split.', true);
    } else {
      splitSelected(sel, drawPts);
      return; // splitSelected khud render/status sambhalega
    }
  } else {
    if (tool && tool !== 'point') toast(tool === 'split' ? 'Split line cancelled.' : 'Not enough vertices.', true);
  }
  drawPts = [];
  updateGisReadout();
}
function cancelDrawing() {
  clearTimeout(gisClickTimer);
  drawPts = [];
  hideSnapDot();
  if (rubberBand) { map.removeLayer(rubberBand); rubberBand = null; }
  map.doubleClickZoom.enable();
  updateGisReadout();
}

/* ---------- split (server shapely) — kisi bhi polygon collection pe ---------- */
async function splitSelected(selRef, latlngs) {
  const feat = selRef.feat;
  busy = true; render();
  status('Splitting polygon (Shapely, planar-exact)…');
  try {
    const j = await api('/api/gis/split', {
      polygon: feat.geometry,
      line: { type: 'LineString', coordinates: latlngs.map((p) => [p.lng, p.lat]) },
    });
    const props = { ...feat.properties };
    delete props.area_m2; delete props.perimeter_m; delete props.length_m;
    const pieces = j.features.map((f, i) => ({ type: 'Feature', geometry: f.geometry, properties: { ...props, split: i + 1 } }));
    removeFeature(selRef.coll, feat);
    const col = collectionById(selRef.coll);
    col.fc.features.push(...pieces);
    clearSel();
    pushHist(); rebuildSnapCache(); render();
    status(`Split complete — ${pieces.length} polygons created (layer: ${col.label}).`);
  } catch (err) {
    toast(err.message, true);
    status('');
  }
  drawPts = [];
  busy = false; render();
  updateGisReadout();
}

/* ---------- delete & merge (cross-collection) ---------- */
function deleteSelected() {
  if (!selRefs.length) { toast('No selection — use the Select tool first.', true); return; }
  const n = selRefs.length;
  selRefs.forEach((r) => removeFeature(r.coll, r.feat));
  clearSel();
  pushHist(); rebuildSnapCache(); render();
  status(`${n} feature(s) deleted (undo available).`);
}
function geomClass(f) {
  const t = f.geometry.type;
  if (t.indexOf('Polygon') >= 0) return 'poly';
  if (t.indexOf('Line') >= 0) return 'line';
  if (t === 'Point' || t === 'MultiPoint') return 'point';
  return 'other';
}
function turfUnionAll(feats) {
  try {
    return turf.union(turf.featureCollection(feats));
  } catch (e) {
    let acc = feats[0];
    for (let i = 1; i < feats.length; i++) acc = turf.union(acc, feats[i]);
    return acc;
  }
}
function mergeSelected() {
  if (selRefs.length < 2) { toast('Select 2+ features first (Shift+click = multi-select).', true); return; }
  const classes = new Set(selRefs.map((r) => geomClass(r.feat)));
  const sameColl = selRefs.every((r) => r.coll === selRefs[0].coll);

  if (classes.size === 1 && classes.has('poly')) {
    // polygons: true dissolve (union)
    const feats = selRefs.map((r) => r.feat);
    let merged;
    try { merged = turfUnionAll(feats); } catch (e) { toast('Merge failed: ' + e.message, true); return; }
    merged = { type: 'Feature', geometry: merged.geometry,
               properties: { ...(feats[0].properties || {}), merged: feats.length } };
    recomputeMetrics(merged);
    selRefs.forEach((r) => removeFeature(r.coll, r.feat));
    if (sameColl) collectionById(selRefs[0].coll).fc.features.push(merged);
    else state.composite.features.push(merged);
    clearSel();
    pushHist(); rebuildSnapCache(); render();
    status(`Dissolved ${feats.length} polygons into 1 (${sameColl ? 'in source layer' : 'moved to Composite'}).`);
    return;
  }

  if (classes.size === 1 && (classes.has('line') || classes.has('point'))) {
    const feats = selRefs.map((r) => r.feat);
    const isLine = classes.has('line');
    const coords = [];
    feats.forEach((f) => {
      const t = f.geometry.type;
      if (t === 'LineString' || t === 'Point') coords.push(f.geometry.coordinates);
      else coords.push(...f.geometry.coordinates);
    });
    const merged = { type: 'Feature',
                     geometry: { type: isLine ? 'MultiLineString' : 'MultiPoint', coordinates: coords },
                     properties: { ...(feats[0].properties || {}), merged: feats.length } };
    selRefs.forEach((r) => removeFeature(r.coll, r.feat));
    if (sameColl) collectionById(selRefs[0].coll).fc.features.push(merged);
    else state.composite.features.push(merged);
    clearSel();
    pushHist(); rebuildSnapCache(); render();
    status(`Merged ${feats.length} ${isLine ? 'lines' : 'points'} into one feature.`);
    return;
  }

  // mixed geometry classes: selection ko Composite map me move karo (IDs & attributes preserved)
  const n = selRefs.length;
  selRefs.forEach((r) => {
    const f = r.feat;
    removeFeature(r.coll, f);
    f.properties = { ...(f.properties || {}), src: r.coll };
    state.composite.features.push(f);
  });
  clearSel();
  pushHist(); rebuildSnapCache(); render();
  status(`Moved ${n} features into the Composite map ('src' field records the origin layer).`);
}

/* ---------- composite map builder (VISIBLE live-filtered layers → one FeatureCollection) ---------- */
function buildComposite() {
  const feats = [];
  CATEGORIES.forEach((cat) => {
    if (!$('vis-' + cat.id) || !$('vis-' + cat.id).checked) return;
    const pool = visiblePoolFor(cat); // live-filtered visible set hi compile hota hai
    if (!pool || !pool.features) return;
    filterFeatures(cat, pool.features).forEach((f) => {
      feats.push({ type: 'Feature', geometry: JSON.parse(JSON.stringify(f.geometry)),
                   properties: { ...(f.properties || {}), src: cat.id } });
    });
  });
  if ($('visDrawn').checked) {
    ['points', 'lines', 'polys'].forEach((k) => {
      state.drawn[k].features.forEach((f) => {
        feats.push({ type: 'Feature', geometry: JSON.parse(JSON.stringify(f.geometry)),
                     properties: { ...(f.properties || {}), src: 'digitized' } });
      });
    });
  }
  if (!feats.length) { toast('No visible layers with data — enable at least one category layer.', true); return; }
  state.composite = { type: 'FeatureCollection', features: feats };
  clearSel();
  pushHist(); rebuildSnapCache(); render();
  status(`Composite compiled — ${feats.length} features (src = origin layer).`);
}

/* ---------- render editable layers + vertex handles + move ---------- */
const COMPOSITE_STYLE = { color: '#e91e63', weight: 2, opacity: 0.95, fillColor: '#e91e63', fillOpacity: 0.15 };
function renderDrawn() {
  vertexHandles.clearLayers();
  const visDrawn = $('visDrawn') && $('visDrawn').checked;
  const visComposite = $('visComposite') && $('visComposite').checked;

  ['points', 'lines', 'polys'].forEach((store) => drawnGroups[store].clearLayers());
  compositeGroup.clearLayers();
  editGroup.clearLayers();

  if (visDrawn || visComposite) {
    editableCollections().forEach((col) => {
      const isDrawn = col.id.indexOf('drawn-') === 0;
      const isComposite = col.id === 'composite';
      if (!isDrawn && !isComposite) return; // base pools render() me hi editable render hote hain
      if (isDrawn && !visDrawn) return;
      if (isComposite && !visComposite) return;
      const target = isComposite ? compositeGroup : (isDrawn ? drawnGroups[col.store] : editGroup);
      const fc = col.fc;
      if (!fc.features.length) return;

      const layer = L.geoJSON(fc, {
        pane: 'drawPane',
        style: (f) => {
          if (getSel(f)) return { ...SELECTED_STYLE };
          if (isComposite) return { ...COMPOSITE_STYLE };
          if (isDrawn) return (col.store === 'polys') ? { ...DRAWN_STYLE } : { ...DRAWN_LINE_STYLE };
          // extracted layers — category accent, dashed to show they are editable
          const catId = col.id.split('-')[0];
          const cat = CATEGORIES.find((c) => c.id === catId);
          const accent = (cat && cat.accent) || '#888888';
          const isLine = geomClass(f) === 'line';
          return { color: accent, weight: 2, opacity: 0.9, dashArray: isLine ? '6 3' : null,
                   fillColor: (cat && cat.mapPoly && cat.mapPoly.fillColor) || accent, fillOpacity: 0.2 };
        },
        pointToLayer: (f, ll) => L.circleMarker(ll, {
          radius: 6, color: getSel(f) ? '#ffd600' : (isComposite ? '#e91e63' : '#00bcd4'), weight: 2.5,
          fillColor: getSel(f) ? '#ffd600' : (isComposite ? '#e91e63' : '#00bcd4'), fillOpacity: 0.8,
        }),
        interactive: true, bubblingMouseEvents: false,
      });
      layer.eachLayer((pl) => {
        const f = pl.feature;
        pl.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (gisTool) { handleDrawClick(e); return; }  // sketch mode: feature click = vertex add
          const multi = e.originalEvent && e.originalEvent.shiftKey;
          if (multi) {
            const cur = getSel(f);
            selRefs = cur ? selRefs.filter((r) => r !== cur) : selRefs.concat([{ coll: col.id, feat: f }]);
          } else {
            selRefs = [{ coll: col.id, feat: f }];
          }
          renderDrawn(); updateGisReadout();
        });
        pl.on('mousedown', (e) => {
          if (gisTool || moveState) return;
          if (selRefs.length === 1 && selRefs[0].feat === f) startMove(col.id, f, e);
        });
      });
      layer.addTo(target);
    });
  }

  // single selected feature → vertex handles (closed rings ka duplicate last vertex skip)
  const sel = selectedFeature();
  if (sel && (visDrawn || visComposite)) {
    const skipDup = (pos, arr) => {
      // ring ka closing vertex (first ka duplicate) — handle mat banao
      return arr.length > 2 && pos.i === arr.length - 1 &&
             arr[0][0] === arr[pos.i][0] && arr[0][1] === arr[pos.i][1];
    };
    coordPositions(sel.feat.geometry).forEach((pos) => {
      if (pos.isPair) return; // Point — move se adjust hota hai
      if (!pos.isPair && skipDup(pos, pos.arr)) return;
      const cur = pos.arr[pos.i];
      const h = L.marker([cur[1], cur[0]], {
        draggable: true, keyboard: false,
        icon: L.divIcon({ className: 'gis-vertex-handle', iconSize: [10, 10], iconAnchor: [5, 5] }),
      });
      h.on('drag', () => {
        pos.arr[pos.i] = [h.getLatLng().lng, h.getLatLng().lat];
        showLiveGeom(sel.feat.geometry);
      });
      h.on('dragend', () => {
        hideLiveGeom();
        recomputeMetrics(sel.feat);
        pushHist(); rebuildSnapCache(); renderDrawn(); updateGisReadout();
      });
      vertexHandles.addLayer(h);
    });
  }
}

/* ---------- move (selected feature drag) ---------- */
let moveState = null;
function startMove(collId, feat, e) {
  moveState = { coll: collId, feat, last: e.latlng, dLat: 0, dLng: 0, orig: JSON.parse(JSON.stringify(feat.geometry)) };
  map.dragging.disable();
  const onMove = (ev) => {
    if (!moveState) return;
    moveState.dLat += ev.latlng.lat - moveState.last.lat;
    moveState.dLng += ev.latlng.lng - moveState.last.lng;
    moveState.last = ev.latlng;
    showLiveGeom(shiftedGeometry(moveState.orig, moveState.dLat, moveState.dLng));
  };
  const onUp = () => {
    map.off('mousemove', onMove); map.off('mouseup', onUp);
    map.dragging.enable();
    if (moveState && (moveState.dLat || moveState.dLng)) {
      moveState.feat.geometry = shiftedGeometry(moveState.orig, moveState.dLat, moveState.dLng);
      recomputeMetrics(moveState.feat);
      pushHist(); rebuildSnapCache();
    }
    moveState = null;
    hideLiveGeom(); renderDrawn();
  };
  map.on('mousemove', onMove);
  map.on('mouseup', onUp);
}

/* ---------- keyboard ---------- */
window.addEventListener('keydown', (e) => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (e.key === 'Enter' && (gisTool === 'line' || gisTool === 'poly' || gisTool === 'split')) {
    e.preventDefault(); finishDrawing();
  } else if (e.key === 'Escape') {
    if (drawPts.length) { cancelDrawing(); updateGisReadout(); }
    else { clearSel(); setGisTool(null); renderDrawn(); }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selRefs.length) { e.preventDefault(); deleteSelected(); }
  }
});

/* ---------- map click/mousemove hooks for GIS tools ---------- */
let gisClickTimer = null;
map.on('click', (e) => {
  if (gisTool) {
    // dblclick gesture ke saath clash na ho — click ko defer karo
    clearTimeout(gisClickTimer);
    gisClickTimer = setTimeout(() => handleDrawClick(e), 260);
    return;
  }
  const now = Date.now();
  if (now - lastClickAt > 250) highlightGroup.clearLayers(); // khaali click → highlight clear
  lastClickAt = now;
});
map.on('mousemove', (e) => {
  if (drawPts.length) { updateRubberBand(e.latlng); updateGisReadout(); }
  else if (gisTool) updateGisReadout();
  else {
    const ll = e.latlng;
    $('gisReadout').textContent = `Tool: Select | ${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`;
  }
});
map.on('dblclick', (e) => {
  if (gisTool === 'line' || gisTool === 'poly' || gisTool === 'split') {
    clearTimeout(gisClickTimer);
    L.DomEvent.stopPropagation(e);
    const snap = snapLatLng(e.latlng);
    drawPts.push(snap.latLng);   // dblclick position = last vertex
    finishDrawing();
  }
});

/* ================= LOCAL PREVIEW (click a feature to inspect) ================= */
function localDataFor(cat) {
  if (!state.localData) return null;
  if (cat.id === 'water') {
    return { type: 'FeatureCollection',
             features: [...state.localData.waterPoly.features, ...state.localData.waterLine.features] };
  }
  return state.localData[cat.cacheKey] || null;
}
/* Runtime view ka data pool: local mode = poora cached dataset (checkboxes = live layer toggles,
   bina Extract ke show/hide), API mode = extracted dataset. */
function visiblePoolFor(cat) {
  if (state.source === 'local' && state.localData) {
    const fc = localDataFor(cat);
    if (fc) return fc;
  }
  return state.layers[cat.id].fc;
}
function renderPreview() {
  CATEGORIES.forEach((cat) => previewGroups[cat.id].clearLayers());
  if (!state.localData) return;
  CATEGORIES.forEach((cat) => {
    const cb = $('visPrev' + cat.id.charAt(0).toUpperCase() + cat.id.slice(1));
    if (!cb || !cb.checked) return;
    const fc = localDataFor(cat);
    if (!fc || !fc.features) return;
    const style = cat.mapLine
      ? (f) => (f.geometry.type.indexOf('Line') >= 0 ? cat.mapLine : (cat.mapPoly || { color: cat.accent }))
      : () => (cat.mapPoly || { color: cat.accent });
    const layer = L.geoJSON(fc, {
      pane: 'polyPane',
      style: (f) => ({ ...(typeof style === 'function' ? style(f) : style), interactive: true }),
      pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 3, color: cat.accent }),
      interactive: true, bubblingMouseEvents: false,
    });
    layer.eachLayer((pl) => {
      pl.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        highlightGroup.clearLayers();
        L.geoJSON(pl.feature, {
          pane: 'hlPane', interactive: false, style: () => ({ ...HIGHLIGHT_STYLE }),
          pointToLayer: (_f, ll2) => L.circleMarker(ll2, { radius: 8, color: '#ff3d00', fillOpacity: 0.6 }),
        }).addTo(highlightGroup);
        const p = pl.feature.properties || {};
        const rows = Object.entries(p).filter(([, v]) => v !== '' && v != null)
          .map(([k, v]) => `<tr><td><b>${k}</b></td><td>${String(v)}</td></tr>`).join('');
        L.popup({ maxWidth: 280 }).setLatLng(e.latlng)
          .setContent(`<div style="font-size:12px"><table>${rows}</table></div>`).openOn(map);
      });
    });
    layer.addTo(previewGroups[cat.id]);
  });
}

/* ---------------- dynamic panel build ---------------- */
function keysGridHtml(keys, cls) {
  return `<div class="keysgrid">${keys.map((k) =>
    `<label><input type="checkbox" class="${cls}" value="${k.v}" ${k.on ? 'checked' : ''}> ${k.l}</label>`).join('')}</div>`;
}
function keyRowHtml(cat, cls) {
  return `<div class="keyrow">
    <button class="mini cat-keyall" data-cls="${cls}">All</button>
    <button class="mini cat-keynone" data-cls="${cls}">None</button>
  </div>`;
}

function symRowHtml(cat) {
  const S = SYMB[cat.id];
  const isLineOnly = cat.id === 'road';
  return `
    <div class="subhead">Symbology</div>
    <div class="symrow">
      <label class="sym" title="${isLineOnly ? 'Line color' : 'Border color'}">
        <input type="color" class="sym-stroke" value="${S.stroke}">
      </label>
      <label class="sym" title="Line / border width">
        <input type="number" class="sym-weight" min="0.5" max="14" step="0.5" value="${S.weight}">
      </label>
      ${isLineOnly ? '' : `
      <label class="sym" title="Fill color">
        <input type="color" class="sym-fill" value="${S.fillColor}">
      </label>
      <label class="sym symchk" title="Toggle fill on/off (transparent polygons)">
        <input type="checkbox" class="sym-fillon" ${S.fill ? 'checked' : ''}> Fill
      </label>`}
    </div>`;
}

function buildPanel() {
  $('catBoxes').innerHTML = CATEGORIES.map((cat) => {
    let keysHtml = '';
    if (cat.keys) {
      keysHtml = keysGridHtml(cat.keys, 'keyck') + keyRowHtml(cat, `#cat-${cat.id} .keyck`);
    } else if (cat.keyGroups) {
      keysHtml = cat.keyGroups.map((grp) =>
        `<div class="keygroup-label">${grp.label}</div>${keysGridHtml(grp.keys, grp.cls)}${keyRowHtml(cat, `#cat-${cat.id} .${grp.cls}`)}`).join('');
    }
    return `
    <section class="step cat collapsed" id="cat-${cat.id}" style="border-color:${cat.accent}">
      <div class="cat-title" style="background:${cat.accent}"><span>${cat.title}</span><span class="chev">&#9662;</span></div>
      <div class="step-body">
        <div class="subhead">1 &middot; Extract</div>
        ${keysHtml}
        ${symRowHtml(cat)}
        <button class="wide primary cat-extract" style="background:${cat.accent}" disabled>${cat.extractLabel}</button>
        <div class="hint cat-extract-info"></div>
        <div class="hint">Checkboxes act as live attribute filters.</div>
        <div class="subhead">2 &middot; Buffer (optional)</div>
        <label class="fldlabel">Buffer width</label>
        <div class="row">
          <input type="number" class="buf-width" value="10" min="0.001" step="1">
          <select class="buf-unit">
            <option value="m" selected>meters (m)</option>
            <option value="mm">millimeters (mm)</option>
            <option value="cm">centimeters (cm)</option>
            <option value="km">kilometers (km)</option>
            <option value="ft">feet (ft)</option>
          </select>
        </div>
        <div class="hint">mm = real-world millimetres (0.001 m).</div>
        <button class="wide primary cat-buffer" style="background:${cat.accent}" disabled>Create Buffer</button>
        <div class="hint cat-buffer-info"></div>
        <div class="subhead">3 &middot; Dissolve (optional)</div>
        <button class="wide primary cat-dissolve" style="background:${cat.accent}" disabled>Dissolve Buffer</button>
        <div class="hint cat-dissolve-info"></div>
        <button class="mini cat-basetoggle" disabled>&#128065; ${cat.id === 'road' ? 'Line' : 'Base'}: On</button>
        <div class="hint">Toggle base layer visibility; exports unaffected.</div>
      </div>
    </section>`;
  }).join('');

  $('layerRows').innerHTML = CATEGORIES.map((cat) =>
    `<div class="layerrow"><input type="checkbox" id="vis-${cat.id}" checked><span class="swatch" style="background:${cat.accent}"></span> ${cat.title.replace(/^\S+\s/, '')}</div>`).join('');

  // wire category controls
  CATEGORIES.forEach((cat) => {
    const root = catRoot(cat);
    root.querySelector('.cat-title').onclick = () => root.classList.toggle('collapsed');
    root.querySelector('.cat-extract').onclick = () => doExtract(cat);
    root.querySelector('.cat-buffer').onclick = () => doBuffer(cat);
    root.querySelector('.cat-dissolve').onclick = () => doDissolve(cat);
    root.querySelector('.buf-unit').onchange = () => {
      root.querySelector('.buf-width').step = STEP_BY_UNIT[root.querySelector('.buf-unit').value];
    };
    root.querySelectorAll('.cat-keyall').forEach((btn) => {
      btn.onclick = () => {
        root.querySelectorAll(btn.dataset.cls).forEach((c) => { c.checked = true; });
        render(); // live filter refresh
      };
    });
    root.querySelectorAll('.cat-keynone').forEach((btn) => {
      btn.onclick = () => {
        root.querySelectorAll(btn.dataset.cls).forEach((c) => { c.checked = false; });
        render(); // live filter refresh
      };
    });
    // sub-category checkboxes = runtime layer toggles (show/hide bina Extract)
    root.querySelectorAll('.keysgrid input').forEach((c) => { c.onchange = render; });
    // base layer on/off (buffer ke baad line chhupao)
    root.querySelector('.cat-basetoggle').onclick = () => {
      baseHidden[cat.id] = !baseHidden[cat.id];
      render();
    };
    // symbology wiring — change pe map + Layers swatch dono update
    const swatchEl = document.querySelector('#vis-' + cat.id).parentElement.querySelector('.swatch');
    const symStroke = root.querySelector('.sym-stroke');
    if (symStroke) symStroke.onchange = (e) => {
      SYMB[cat.id].stroke = e.target.value;
      swatchEl.style.background = SYMB[cat.id].fill ? SYMB[cat.id].fillColor : e.target.value;
      render();
    };
    const symWeight = root.querySelector('.sym-weight');
    if (symWeight) symWeight.onchange = (e) => {
      SYMB[cat.id].weight = Math.max(0.5, Math.min(14, parseFloat(e.target.value) || 1));
      render();
    };
    const symFill = root.querySelector('.sym-fill');
    if (symFill) symFill.onchange = (e) => {
      SYMB[cat.id].fillColor = e.target.value;
      swatchEl.style.background = SYMB[cat.id].fill ? e.target.value : SYMB[cat.id].stroke;
      render();
    };
    const symFillOn = root.querySelector('.sym-fillon');
    if (symFillOn) symFillOn.onchange = (e) => {
      SYMB[cat.id].fill = e.target.checked;
      swatchEl.style.background = e.target.checked ? SYMB[cat.id].fillColor : SYMB[cat.id].stroke;
      render();
    };
    $('vis-' + cat.id).onchange = render;
  });

  // collapse static sections
  document.querySelectorAll('#panel > .step .sec-head').forEach((h) => {
    h.onclick = () => h.parentElement.classList.toggle('collapsed');
  });

  $('expCat').onchange = render;
  $('expStage').onchange = render;

  // GIS tools wiring
  $('extractAllBtn').onclick = doExtractAll;
  $('gtSelect').onclick = () => { setGisTool(null); renderDrawn(); updateGisReadout(); };
  $('gtPoint').onclick = () => { setGisTool('point'); renderDrawn(); };
  $('gtLine').onclick = () => { setGisTool('line'); renderDrawn(); };
  $('gtPoly').onclick = () => { setGisTool('poly'); renderDrawn(); };
  $('gtSplit').onclick = () => {
    const sel = selectedFeature();
    if (!sel || geomClass(sel.feat) !== 'poly') { toast('Select ONE polygon first (Select tool), then use Split.', true); return; }
    setGisTool('split'); renderDrawn();
    status('Draw the cutting line — extend it past the polygon boundary on both sides, then press Enter.');
  };
  $('gtMerge').onclick = mergeSelected;
  $('gtDelete').onclick = deleteSelected;
  $('gtFinish').onclick = finishDrawing;
  $('gtCancel').onclick = () => { cancelDrawing(); clearSel(); setGisTool(null); renderDrawn(); updateGisReadout(); };
  $('snapToggle').onchange = () => { snappingOn = $('snapToggle').checked; hideSnapDot(); };
  $('snapRange').oninput = () => {
    snapPx = +$('snapRange').value;
    $('snapVal').textContent = snapPx;
    if (snapPx <= 0) hideSnapDot();
  };

  // composite + CRS + cache wiring
  $('compositeBtn').onclick = buildComposite;
  (function fillUtmZones() {
    const sel = $('utmZone');
    for (let z = 1; z <= 60; z++) {
      const o1 = document.createElement('option');
      o1.value = String(z); o1.textContent = `Zone ${z}N`;
      const o2 = document.createElement('option');
      o2.value = `-${z}`; o2.textContent = `Zone ${z}S`;
      sel.appendChild(o1); sel.appendChild(o2);
    }
  })();
  const applyUtmOverride = () => {
    const zv = $('utmZone').value; // zone options me hemisphere encoded hai (43N / -43S)
    if (zv === 'auto') {
      state.utmOverride = null;
    } else {
      state.utmOverride = { zone: Math.abs(parseInt(zv, 10)), south: zv.startsWith('-') };
    }
    render();
  };
  $('utmZone').onchange = applyUtmOverride;
  $('cacheClearBtn').onclick = async () => {
    try {
      const j = await api('/api/local/cache-clear', {});
      await idbClear();
      refreshSavedAreas();
      toast(`Server cache cleared — ${j.removed} dataset(s) removed, browser copies cleared.`);
      status('All cached downloads cleared (server + browser).');
    } catch (err) { toast(err.message, true); }
  };
  $('savedLoadBtn').onclick = async () => {
    const id = $('savedAreas').value;
    if (!id) { toast('No saved dataset selected.', true); return; }
    const doc = await idbGet(id);
    if (!doc) { toast('Saved dataset not found.', true); return; }
    state.localData = doc.data;
    state.localId = doc.id;
    state.source = 'local';
    syncSourceUI();
    pushHist(); render();
    status(`Loaded saved dataset ${doc.id} from browser storage — extraction is instant now.`);
  };
  $('savedRemoveBtn').onclick = async () => {
    const id = $('savedAreas').value;
    if (!id) { toast('No saved dataset selected.', true); return; }
    await idbDelete(id);
    refreshSavedAreas();
    status(`Saved copy '${id}' removed from browser storage.`);
  };
}

/* ---------------- render ---------------- */
function metaText(cat, meta) {
  if (!meta) return '';
  let s = `${meta.count} ${cat.noun}`;
  if (meta.length_km > 0) s += ` • ${meta.length_km.toFixed(1)} km`;
  if (meta.area_m2 > 0) s += ` • ${Math.round(meta.area_m2).toLocaleString()} m²`;
  return s;
}

function render() {
  // selection rectangle + utm info (extentRectHidden — boundary off/on toggle)
  if (selRect) { map.removeLayer(selRect); selRect = null; }
  if (state.bbox && !extentRectHidden) {
    selRect = L.rectangle(
      L.latLngBounds(
        L.latLng(state.bbox.south, state.bbox.west),
        L.latLng(state.bbox.north, state.bbox.east)), RECT_STYLE).addTo(map);
  }
  if (state.bbox) {
    $('bboxInfo').textContent = bboxText(state.bbox);
    $('utmInfo').textContent = `CRS: ${utmLabel(state.bbox)} — all measurements are computed in this projection.`;
  } else {
    $('bboxInfo').textContent = 'No extent selected yet.';
    $('utmInfo').textContent = '';
  }
  $('fitBtn').classList.toggle('hidden', !state.bbox);
  const etb = $('extentToggleBtn');
  etb.classList.toggle('hidden', !state.bbox);
  etb.textContent = extentRectHidden ? '\u2b1c Show Extent Boundary' : '\u2b1b Hide Extent Boundary';
  $('downloadBtn').disabled = busy || !state.bbox;

  const srcText = state.source === 'local'
    ? (state.localData ? `Local mode — dataset loaded (${state.localId})` : 'Local mode — no dataset downloaded yet')
    : 'API mode — extraction will query live Overpass';
  $('localInfo').textContent = srcText;

  CATEGORIES.forEach((cat) => {
    const st = state.layers[cat.id];
    const vis = $('vis-' + cat.id).checked;
    const g = groups[cat.id];
    g.base.clearLayers(); g.buffer.clearLayers(); g.dissolved.clearLayers();

    // LIVE sub-category filtering: checkbox toggle = instant show/hide (bina Extract)
    // base layer hi editable hai — click = select, drag = move (GIS tools ka data yahi hai)
    const pool = visiblePoolFor(cat);
    if (pool && pool.features && vis && !baseHidden[cat.id]) {
      const shown = filterFeatures(cat, pool.features);
      if (shown.length) {
        const collId = cat.id + '-base';
        const layer = L.geoJSON({ type: 'FeatureCollection', features: shown }, {
          pane: cat.id === 'road' ? 'roadPane' : 'polyPane',
          style: (f) => (getSel(f) ? { ...SELECTED_STYLE } : catStyle(cat, f)),
          interactive: true, bubblingMouseEvents: false,
        });
        layer.eachLayer((pl) => {
          const f = pl.feature;
          pl.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            if (gisTool) { handleDrawClick(e); return; }
            const multi = e.originalEvent && e.originalEvent.shiftKey;
            if (multi) {
              const cur = getSel(f);
              selRefs = cur ? selRefs.filter((r) => r !== cur) : selRefs.concat([{ coll: collId, feat: f }]);
            } else {
              selRefs = [{ coll: collId, feat: f }];
            }
            render(); updateGisReadout();
          });
          pl.on('mousedown', (e) => {
            if (gisTool || moveState) return;
            if (selRefs.length === 1 && selRefs[0].feat === f) startMove(collId, f, e);
          });
        });
        layer.addTo(g.base);
      }
    }
    if (st.bufferFC && vis && $('visBuffer').checked) {
      L.geoJSON(st.bufferFC, { pane: 'bufPane', interactive: false, style: BUFFER_STYLE }).addTo(g.buffer);
    }
    if (st.dissolvedFC && vis && $('visDissolved').checked) {
      L.geoJSON(st.dissolvedFC, { pane: 'disPane', interactive: false, style: DISSOLVED_STYLE }).addTo(g.dissolved);
    }

    const root = catRoot(cat);
    root.querySelector('.cat-extract').disabled = busy || !state.bbox;
    root.querySelector('.cat-buffer').disabled = busy || !st.fc;
    root.querySelector('.cat-dissolve').disabled = busy || !st.bufferFC;
    let infoLine = metaText(cat, st.meta);
    if (pool && pool.features) {
      infoLine += ` • showing ${filterFeatures(cat, pool.features).length}/${pool.features.length} (live filter)`;
    }
    root.querySelector('.cat-extract-info').textContent = infoLine;

    // base on/off 按钮 — pool 有数据才可用
    const bt = root.querySelector('.cat-basetoggle');
    const hasBase = !!(pool && pool.features && pool.features.length);
    bt.disabled = busy || !hasBase;
    const blabel = cat.id === 'road' ? 'Line' : 'Base';
    bt.textContent = baseHidden[cat.id] ? `\u{1F441} ${blabel}: Off` : `\u{1F441} ${blabel}: On`;
    bt.style.background = baseHidden[cat.id] ? '#7f8c9b' : '';
    bt.style.color = baseHidden[cat.id] ? '#fff' : '';
    root.querySelector('.cat-buffer-info').textContent = st.bufferMeta
      ? `${st.bufferMeta.count} polygons • width ${st.bufferMeta.width} ${st.bufferMeta.unit} • ${st.bufferMeta.engine}` : '';
    root.querySelector('.cat-dissolve-info').textContent = st.dissolveMeta
      ? `${st.dissolveMeta.parts_in} parts → ${st.dissolveMeta.parts_out} merged polygon(s)` : '';
  });

  const sel = selectedExport();
  ['fmtGeojson', 'fmtShp', 'fmtSvg'].forEach((id) => { $(id).disabled = busy || !sel.fc; });
  ['fmtPdf', 'fmtPng'].forEach((id) => { $(id).disabled = busy; });

  const allExports = collectAllExports();
  $('fmtAll').disabled = busy || !allExports.length;
  $('allInfo').textContent = allExports.length
    ? `Ready (${allExports.length}): ${allExports.map((e) => e.name).join(', ')} — GeoJSON + SHP + SVG each.`
    : 'No datasets yet — run an extract first.';

  // extract all + preview + drawn + composite
  $('extractAllBtn').disabled = busy || !state.bbox;
  $('compositeBtn').disabled = busy ||
    (!CATEGORIES.some((c) => state.layers[c.id].fc) &&
     !['points', 'lines', 'polys'].some((k) => state.drawn[k].features.length));
  CATEGORIES.forEach((cat) => {
    const cb = $('visPrev' + cat.id.charAt(0).toUpperCase() + cat.id.slice(1));
    if (cb) cb.disabled = busy || !state.localData;
  });
  renderDrawn();
  renderPreview();
  ['gtMerge', 'gtDelete'].forEach((id) => { $(id).disabled = busy; });
  $('gtFinish').disabled = busy || (!gisTool || gisTool === 'point');
  $('gtCancel').disabled = busy || (!gisTool && !drawPts.length && !selRefs.length);

  updateHistBtns();
}

['visBuffer', 'visDissolved', 'visDrawn', 'visComposite',
 'visPrevRoad', 'visPrevBuilding', 'visPrevWater', 'visPrevNature']
  .forEach((id) => { const el = $(id); if (el) el.onchange = render; });

/* ---------------- plugin system (QGIS/ArcGIS style) ---------------- */
const PLUGIN_KEY = 'gis_plugins_v1';
const installedPlugins = [];  // {def, code}

const pluginCtx = {
  get map() { return map; },
  get turf() { return turf; },
  get state() { return state; },
  CATEGORIES,
  pushHist, render, status, toast, api,
  bbox: () => (state.bbox ? { ...state.bbox } : null),
  editableCollections,
  addGeoJSON(fc, style) {
    return L.geoJSON(fc, {
      pane: 'hlPane', interactive: false,
      style: () => ({ color: '#ff9800', weight: 3, fillColor: '#ff9800', fillOpacity: 0.3, ...(style || {}) }),
      pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 6, color: '#ff9800', fillOpacity: 0.8 }),
    }).addTo(map);
  },
  clearTemp() { highlightGroup.clearLayers(); },
  downloadBlob,
};

window.GISPlugin = {
  register(def) {
    if (!def || !def.id || !def.name) throw new Error('Plugin me id aur name chahiye');
    if (installedPlugins.some((p) => p.def.id === def.id)) throw new Error('Plugin "' + def.id + '" already loaded');
    def.tools = def.tools || [];
    installedPlugins.push({ def, code: def.__code || '' });
    refreshPluginUI();
    // 加载提示不出现在界面上 — 插件面板里已可见
  },
};

function runPluginCode(code, sourceName) {
  const fn = new Function('GISPlugin', 'L', code + '\n//# sourceURL=plugin-' + sourceName);
  fn(window.GISPlugin, L);
}
function persistPlugins() {
  try {
    localStorage.setItem(PLUGIN_KEY, JSON.stringify(installedPlugins.map((p) => ({ def: { ...p.def, __code: undefined }, code: p.code }))));
  } catch (e) { /* quota — ignore */ }
}
function loadPersistedPlugins() {
  try {
    const arr = JSON.parse(localStorage.getItem(PLUGIN_KEY) || '[]');
    arr.forEach((p) => {
      try { runPluginCode(p.code, p.def.id); } catch (e) { console.error('plugin restore fail:', p.def.id, e); }
    });
  } catch (e) { /* ignore */ }
}

/* built-in plugins — app ke saath shipped, har load pe auto-register */
const BUILTIN_PLUGINS = ['/plugins/multipart-split.js', '/plugins/sample-reporter.js'];
async function loadBuiltinPlugins() {
  for (const url of BUILTIN_PLUGINS) {
    try {
      const code = await fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
      runPluginCode(code, url);
    } catch (e) { console.error('builtin plugin load fail:', url, e); }
  }
  refreshPluginUI();
}

/* ---------------- local dataset persistence (IndexedDB — reload-proof) ---------------- */
const IDB_NAME = 'gis-local-data', IDB_STORE = 'areas';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(doc) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(doc);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function idbDelete(id) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbClear() {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function saveLocalDataset(data, id) {
  try {
    await idbPut({ id, data, savedAt: Date.now() });
    await refreshSavedAreas();
    status('Dataset persisted to browser storage.');
  } catch (e) { console.error('idb save fail', e); }
}
async function refreshSavedAreas() {
  let docs = [];
  try { docs = await idbGetAll(); } catch (e) { /* ignore */ }
  docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  const sel = $('savedAreas');
  if (!sel) return;
  if (!docs.length) {
    sel.innerHTML = '<option value="">No saved datasets</option>';
    return;
  }
  sel.innerHTML = docs.map((d) => {
    const c = d.data ? `${(d.data.roads || { features: [] }).features.length}r/` +
      `${(d.data.buildings || { features: [] }).features.length}b` : '?';
    const dt = d.savedAt ? new Date(d.savedAt).toLocaleString() : '';
    return `<option value="${d.id}">${d.id} (${c}) — ${dt}</option>`;
  }).join('');
}
async function restoreLatestSaved() {
  const docs = await idbGetAll().catch(() => []);
  if (!docs.length) return false;
  docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  const doc = docs[0];
  let data = null;
  try {
    // server se re-fetch — strict extent clipping ki guarantee (purana IDB copy unclipped ho sakta hai)
    const r = await fetch(`/api/local/get?id=${encodeURIComponent(doc.id)}`);
    if (r.ok) data = await r.json();
  } catch (e) { /* offline — IDB copy fallback */ }
  if (!data && doc.data && doc.data.bbox) {
    try {
      // server file gone (cache cleared) — IDB copy ko server-side clip karke lo
      data = await api("/api/gis/clip", { bbox: doc.data.bbox, geojson: doc.data });
    } catch (e) { /* last resort: raw */ }
  }
  state.localData = data || doc.data;
  state.localId = doc.id;
  state.source = 'local';
  await refreshSavedAreas();
  pushHist(); // 撤销基线 — 否则第一次 undo 会回到空状态
  return true;
}
function refreshPluginUI() {
  persistPlugins();
  const list = $('pluginList');
  list.innerHTML = installedPlugins.map((p, pi) => `
    <div class="pluginitem">
      <button class="premove" data-pi="${pi}" title="Remove plugin">&#10005;</button>
      <div class="pname">${p.def.name} <span style="font-weight:400;color:#7a8898">v${p.def.version || '1.0'}</span></div>
      <div class="pmeta">by ${p.def.author || 'unknown'} &middot; ${p.def.id}</div>
      ${p.def.description ? `<div class="pdesc">${p.def.description}</div>` : ''}
      <div class="ptools">${p.def.tools.map((t, ti) => `<button data-pi="${pi}" data-ti="${ti}">${t.label || t.id}</button>`).join('')}</div>
    </div>`).join('');
  list.querySelectorAll('.ptools button').forEach((btn) => {
    btn.onclick = () => {
      const p = installedPlugins[+btn.dataset.pi];
      const tool = p.def.tools[+btn.dataset.ti];
      try { tool.run(pluginCtx); } catch (e) { toast('Plugin error: ' + e.message, true); }
    };
  });
  list.querySelectorAll('.premove').forEach((btn) => {
    btn.onclick = () => {
      installedPlugins.splice(+btn.dataset.pi, 1);
      persistPlugins();
      refreshPluginUI();
      status('Plugin removed.');
    };
  });
}
$('pluginLoadBtn').onclick = () => $('pluginFile').click();
$('pluginFile').onchange = async () => {
  const file = $('pluginFile').files[0];
  if (!file) return;
  try {
    const code = await file.text();
    runPluginCode(code, file.name.replace(/\.js$/, ''));
  } catch (e) {
    toast('Plugin load fail: ' + e.message, true);
  }
  $('pluginFile').value = '';
};
$('pluginUrlBtn').onclick = async () => {
  const url = $('pluginUrl').value.trim();
  if (!url) { toast('Plugin ka URL daalo.', true); return; }
  try {
    const code = await fetch(url).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    runPluginCode(code, url.split('/').pop().replace(/\.js$/, '') || 'remote');
  } catch (e) {
    toast('Plugin URL load fail: ' + e.message, true);
  }
};

/* init */
buildPanel();
syncSourceUI();
pushHist();
rebuildSnapCache();
render();
(async () => {
  await loadBuiltinPlugins();
  loadPersistedPlugins();
  const restored = await restoreLatestSaved();
  if (restored) {
    render();
    status(`Restored cached dataset ${state.localId} from browser storage.`);
  }
})();
