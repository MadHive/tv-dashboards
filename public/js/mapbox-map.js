/* ===========================================================================
   MapboxUSAMap — GPU-accelerated USA delivery map via Mapbox GL JS
   Widget type: usa-map-gl
   Data shape: identical to usa-map — { states, hotspots, totals, regions, region }
   =========================================================================== */

window.MapboxUSAMap = (function () {
  'use strict';

  var DATA_CENTERS = [
    { id: 'us-west1',    label: 'WEST',    lon: -121.2, lat: 45.6 },
    { id: 'us-central1', label: 'CENTRAL', lon: -95.9,  lat: 41.3 },
    { id: 'us-east4',    label: 'EAST',    lon: -77.5,  lat: 39.0 },
  ];

  // ZIP3 prefix → major metro name (for city labels on hotspots)
  var ZIP3_CITY = {
    '100':'New York','101':'New York','102':'New York','103':'New York',
    '070':'Newark','071':'Newark','072':'Newark','073':'Newark',
    '606':'Chicago','607':'Chicago','608':'Chicago','609':'Chicago',
    '900':'Los Angeles','901':'Los Angeles','902':'Los Angeles','903':'Los Angeles',
    '904':'Los Angeles','905':'Los Angeles','906':'Los Angeles','907':'Los Angeles',
    '770':'Houston','771':'Houston','772':'Houston','773':'Houston',
    '850':'Phoenix','851':'Phoenix','852':'Phoenix','853':'Phoenix',
    '191':'Philadelphia','190':'Philadelphia','193':'Philadelphia',
    '750':'Dallas','751':'Dallas','752':'Dallas','753':'Dallas',
    '921':'San Diego','920':'San Diego','922':'San Diego',
    '303':'Atlanta','300':'Atlanta','301':'Atlanta','302':'Atlanta',
    '200':'Washington DC','201':'Washington DC','202':'DC','203':'DC','204':'DC',
    '021':'Boston','022':'Boston','023':'Boston','024':'Boston',
    '481':'Detroit','482':'Detroit','483':'Detroit','484':'Detroit',
    '980':'Seattle','981':'Seattle','982':'Seattle','983':'Seattle',
    '941':'San Francisco','940':'San Jose','942':'Oakland','943':'Bay Area',
    '331':'Miami','330':'Miami','332':'Miami','333':'Miami','334':'Miami',
    '800':'Denver','801':'Denver','802':'Denver','803':'Denver',
    '891':'Las Vegas','889':'Las Vegas','890':'Las Vegas','892':'Las Vegas',
    '551':'Minneapolis','554':'Minneapolis','555':'Minneapolis','560':'Minneapolis',
    '971':'Portland','972':'Portland','973':'Portland',
    '631':'St. Louis','630':'St. Louis','632':'St. Louis',
    '152':'Pittsburgh','150':'Pittsburgh','151':'Pittsburgh',
    '441':'Cleveland','440':'Cleveland','442':'Cleveland',
    '461':'Indianapolis','460':'Indianapolis','462':'Indianapolis',
    '430':'Columbus','431':'Columbus','432':'Columbus',
    '370':'Nashville','371':'Nashville','372':'Nashville',
    '380':'Memphis','381':'Memphis','382':'Memphis',
    '760':'Fort Worth','761':'Fort Worth','762':'Fort Worth',
    '738':'Oklahoma City','730':'Oklahoma City','731':'OKC',
    '402':'Louisville','400':'Louisville','401':'Louisville',
    '640':'Kansas City','641':'Kansas City','642':'Kansas City',
    '700':'New Orleans','701':'New Orleans','702':'New Orleans',
    '531':'Milwaukee','530':'Milwaukee','532':'Milwaukee',
    '671':'Wichita','670':'Wichita','672':'Wichita',
  };

  var REGION_BOUNDS = {
    // DC visible on left, delivery region fills the frame
    northeast:  [[-90, 33], [-62, 50]],    // East DC (VA) left; New England fills right
    southeast:  [[-94, 19], [-68, 42]],    // East DC (VA) top-left; FL/GA/SC fills frame
    northwest:  [[-130, 38], [-100, 52]],  // West DC (OR) left; PNW fills right
    southwest:  [[-130, 26], [-100, 44]],  // West DC (OR) left; CA/NV/AZ fills right
  };
  var USA_BOUNDS = [[-125, 24], [-66, 50]];

  // ── Config defaults + color schemes ──────────────────────────────────────

  var SCHEME_COLORS = {
    brand:  { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4', choropleth: null },
    cool:   { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe', choropleth: null },
    warm:   { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a', choropleth: null },
    iheart: {
      particleNormal: '#FF6B8A', particleFast: '#FFAABB', stateGlowHigh: '#FFAABB',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#0d0005',
        0.10, '#2d000e',
        0.28, '#6b001a',
        0.50, '#C6002B',
        0.70, '#E30C3A',
        0.88, '#FF4D6B',
        1.0,  '#FF8FA3',
      ],
    },
  };

  function buildMapConfig(userConfig) {
    return {
      particleCount:      100,
      particleSpeed:      1.0,
      colorScheme:        'brand',
      showLeaderboard:    true,
      showRegionWest:     true,
      showRegionCentral:  true,
      showRegionEast:     true,
      showTotalOverlay:   true,
      showClientLogo:     true,
      mapStyle:           'mapbox',
      zoomViz:            'dots',
      clientLogo:         null,
      initialZoom:        null,
      initialCenter:      null,
      initialPitch:       null,
      initialBearing:     null,
      logoFit:            'cover',
      ...(userConfig || {}),
    };
  }

  function getColorScheme(name) {
    return SCHEME_COLORS[name] || SCHEME_COLORS.brand;
  }

  // Single canonical number formatter used by all overlays.
  // Keeps leaderboard, region panels, and total overlay visually consistent.
  // Thresholds:  ≥1B → "1.2B"  ≥1M → "4.5M"  ≥1K → "12K"  else integer
  function fmtImp(n) {
    if (n == null || isNaN(n)) return '—';
    n = Math.round(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  var CHOROPLETH = [
    'interpolate', ['linear'], ['get', 'intensity'],
    0,    '#0d021e',
    0.10, '#1e0840',
    0.28, '#4c1d95',
    0.50, '#7c3aed',
    0.70, '#a855f7',
    0.88, '#e879f9',
    1.0,  '#FDA4D4',
  ];

  class MapboxUSAMap {
    constructor(container, config) {
      this._container  = container;
      this._config     = config || {};
      this._cfg        = buildMapConfig((config || {}).mglConfig);
      this._map        = null;
      this._data       = null;
      this._particles  = [];
      this._animId     = null;
      this._pulseId      = null;
      this._currentStyle = 'brand';
      this._totalValueEl  = null;
      this._lbHeaderTotal = null;
      this._displayedTotal = 0;
      this._totalAnimId    = null;
      this._dcMarkers       = [];
      this._regionPanels    = {};
      this._lbScrollEl     = null;
      this._lbTotals       = null;
      this._visObs         = null;
      this._corridorPaths  = [];
      this._lastBounds     = null;
      // Persisted overlay positions (from mglConfig.overlayPositions)
      this._overlayPositions = Object.assign({}, (this._cfg && this._cfg.overlayPositions) || {});
      // Custom annotations (markers, text labels) added in Studio
      this._annotations = (this._cfg && this._cfg.annotations) || [];
      this._annotationMarkers = [];

      this._wrap = document.createElement('div');
      this._wrap.className = 'mgl-container';
      container.appendChild(this._wrap);

      // Create dedicated map div that Mapbox GL owns (must be empty when passed to Map constructor)
      this._mapDiv = document.createElement('div');
      this._mapDiv.style.cssText = 'position:absolute;inset:0;';
      this._wrap.appendChild(this._mapDiv);

      // Overlays go on top of the map div as siblings
      this._buildOverlayDOM();
      this._buildLeaderboardDOM();
      this._initMap();
    }

    async _initMap() {
      try {
        const res   = await fetch('/api/config/mapbox-token');
        const data  = await res.json();
        const token = data.token;
        if (!token) { console.error('[MapboxUSAMap] No access token'); return; }

        mapboxgl.accessToken = token;

        // Start with the configured style directly to avoid a setStyle() call on first data update
        const initialStyle = (this._cfg.mapStyle === 'mapbox')
          ? 'mapbox://styles/mapbox/dark-v11'
          : this._blankStyle();
        this._currentStyle = this._cfg.mapStyle;

        this._map = new mapboxgl.Map({
          container:          this._mapDiv,
          style:              initialStyle,
          bounds:             USA_BOUNDS,
          fitBoundsOptions:   { padding: 20 },
          interactive:        true,
          attributionControl: false,
          pitch:              0,
          bearing:            0,
        });

        // Add navigation controls (zoom, rotation, pitch)
        this._map.addControl(new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true
        }), 'top-right');

        // Enable all interaction handlers explicitly
        this._map.dragPan.enable();
        this._map.scrollZoom.enable();
        this._map.boxZoom.enable();
        this._map.doubleClickZoom.enable();
        this._map.keyboard.enable();
        this._map.dragRotate.enable();
        this._map.touchZoomRotate.enable();

        this._map.on('load', async () => {
          await this._addSources();
          this._addLayers();
          // Attach GCP icon markers (elements created in _buildOverlayDOM)
          this._dcMarkers.forEach(item => {
            if (!item.marker) {
              item.marker = new mapboxgl.Marker({ element: item.el, anchor: 'center' })
                .setLngLat([item.dc.lon, item.dc.lat])
                .addTo(this._map);
            }
          });
          if (this._data) this._applyData(this._data);
          // Apply configured initial center + zoom (overrides default USA fitBounds)
          if (this._cfg.initialCenter && this._cfg.initialCenter.lng !== undefined) {
            this._map.setCenter([this._cfg.initialCenter.lng, this._cfg.initialCenter.lat]);
          }
          if (this._cfg.initialZoom) {
            this._map.setZoom(this._cfg.initialZoom);
          }
          if (this._cfg.initialPitch !== null && this._cfg.initialPitch !== undefined) {
            this._map.setPitch(this._cfg.initialPitch);
          }
          if (this._cfg.initialBearing !== null && this._cfg.initialBearing !== undefined) {
            this._map.setBearing(this._cfg.initialBearing);
          }
        });

        // Note: viewport changes are NOT auto-captured from map events in studio mode.
        // Reason: fitBounds fires moveend on init which would overwrite user-set values.
        // Instead, use the Lat/Lng/Pitch/Bearing inputs in the Map GL Config panel.

        // Auto-recover from GPU/WebGL context loss (e.g. after long uptime)
        this._map.on('webglcontextlost', () => {
          console.warn('[MapboxUSAMap] WebGL context lost — reloading page to recover');
          setTimeout(() => location.reload(), 2000);
        });
      } catch (err) {
        console.error('[MapboxUSAMap] init failed:', err);
      }
    }

    _blankStyle() {
      return {
        version: 8,
        glyphs:  'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {},
        layers:  [{ id: 'background', type: 'background', paint: { 'background-color': '#0E0320' } }],
      };
    }

    async _addSources() {
      const US = window.US_STATES;

      // Load high-quality state GeoJSON (93+ points per state vs 10-18 in US_STATES)
      let hqStateData = { type: 'FeatureCollection', features: [] };
      try {
        const hqRes = await fetch('/data/us-states-hq.json');
        hqStateData = await hqRes.json();
        this._stateGeoFeatures = hqStateData.features;
      } catch (_) {
        // Fallback: use crude US_STATES paths
        if (US) {
          this._stateGeoFeatures = US.states.map(s => ({
            type: 'Feature',
            properties: { id: s.id, intensity: 0, impressions: 0 },
            geometry:   { type: 'Polygon', coordinates: [s.path] },
          }));
          hqStateData = { type: 'FeatureCollection', features: this._stateGeoFeatures };
        }
      }

      this._map.addSource('us-states', {
        type: 'geojson',
        data: hqStateData,
      });

      this._map.addSource('hotspots',      { type: 'geojson', data: this._empty() });
      this._map.addSource('arc-corridors', { type: 'geojson', data: this._empty() });
      this._map.addSource('arc-particles', { type: 'geojson', data: this._empty() });

      this._map.addSource('datacenters', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: DATA_CENTERS.map(dc => ({
            type: 'Feature',
            properties: { label: dc.label },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          })),
        },
      });

      // Animated pulse ring sources
      this._map.addSource('hotspots-pulse',   { type: 'geojson', data: this._empty() });
      this._map.addSource('datacenter-pulse', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: DATA_CENTERS.map((dc, i) => ({
            type: 'Feature',
            properties: { phase: i / DATA_CENTERS.length },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          })),
        },
      });

      // State center points for label layer
    }

    _empty() { return { type: 'FeatureCollection', features: [] }; }

    _addLayers() {
      // County boundary lines — beneath everything

      this._map.addLayer({
        id: 'states-fill', type: 'fill', source: 'us-states',
        paint: {
          'fill-color':   CHOROPLETH,
          'fill-opacity': 0.92,
          'fill-color-transition': { duration: 800 },
        },
      });

      this._map.addLayer({
        id: 'states-outline', type: 'line', source: 'us-states',
        paint: { 'line-color': '#7c3aed', 'line-width': 1, 'line-opacity': 0.5 },
      });

      // Soft edge glow on delivery states — matches canvas shadowBlur style
      this._map.addLayer({
        id: 'states-glow', type: 'line', source: 'us-states',
        filter: ['>', ['get', 'intensity'], 0.25],
        paint: {
          'line-color':   ['interpolate', ['linear'], ['get', 'intensity'],
            0.25, '#5b2a8f', 0.6, '#b87aff', 1.0, '#FDA4D4'],
          'line-width':   8,
          'line-blur':    10,
          'line-opacity': ['interpolate', ['linear'], ['get', 'intensity'],
            0.25, 0.08, 1.0, 0.30],
          'line-color-transition': { duration: 800 },
        },
      });

      this._map.addLayer({
        id: 'arc-corridors', type: 'line', source: 'arc-corridors',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': [
            'interpolate', ['linear'], ['get', 'ir'],
            0,   ['match', ['get', 'dc'], 'us-west1', '#1a6a80', 'us-central1', '#4a2070', '#7a3050'],
            0.5, ['match', ['get', 'dc'], 'us-west1', '#67E8F9', 'us-central1', '#b87aff', '#FDA4D4'],
            1.0, '#FFFFFF',
          ],
          'line-width':   ['get', 'lw'],
          'line-opacity': ['get', 'lo'],
          'line-blur':    0,
        },
      });

      // Glow: canvas "8*size radius at 0.1*alpha" — driven by ga property
      this._map.addLayer({
        id: 'arc-particles-glow', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['*', ['get', 'sz'], 3.2],
          'circle-color': [
            'match', ['get', 'dc'],
            'us-west1',    '#67E8F9',
            'us-central1', '#b87aff',
            '#FDA4D4',
          ],
          'circle-opacity': ['get', 'ga'],
          'circle-blur':    0.8,
        },
      });

      // Main dot + trail — driven by fa (fade alpha from canvas formula)
      this._map.addLayer({
        id: 'arc-particles', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['get', 'sz'],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'ir'],
            0,   ['match', ['get', 'dc'], 'us-west1', '#67E8F9', 'us-central1', '#b87aff', '#FDA4D4'],
            0.6, ['match', ['get', 'dc'], 'us-west1', '#a8f0ff', 'us-central1', '#d4a8ff', '#ffd0e8'],
            1.0, '#FFFFFF',
          ],
          'circle-opacity': ['get', 'fa'],
          'circle-blur':    0.05,
        },
      });

      this._map.addLayer({
        id: 'hotspots-glow', type: 'circle', source: 'hotspots',
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['get', 'ir'], 0, 10, 1, 50],
          'circle-color':   ['interpolate', ['linear'], ['get', 'ir'], 0, '#67E8F9', 0.5, '#b87aff', 1, '#FDA4D4'],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'ir'], 0, 0.05, 1, 0.20],
          'circle-blur':    1.0,
        },
      });

      // Delivery heatmap — GPU smooth heat blobs (active when zoomViz: heatmap)
      this._map.addLayer({
        id:     'delivery-heatmap',
        type:   'heatmap',
        source: 'hotspots',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight':    ['interpolate', ['linear'], ['get', 'ir'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 3],
          'heatmap-color':     ['interpolate', ['linear'], ['heatmap-density'],
            0,   'transparent',
            0.2, '#3D1A5C',
            0.4, '#7c3aed',
            0.7, '#FDA4D4',
            1.0, '#FFFFFF'],
          'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 3, 25, 8, 55],
          'heatmap-opacity':   0.85,
        },
      });

      this._map.addLayer({
        id: 'hotspots-core', type: 'circle', source: 'hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'ir'], 0, 3, 1, 14],
          'circle-color':  [
            'interpolate', ['linear'], ['get', 'ir'],
            0,    '#67E8F9',
            0.40, '#FDA4D4',
            0.85, '#FFFFFF',
          ],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'ir'], 0, 0.55, 1, 0.95],
        },
      });

      // City name + impressions on top delivery hotspots — clearly shows destination + volume
      this._map.addLayer({
        id:     'hotspot-labels',
        type:   'symbol',
        source: 'hotspots',
        filter: ['all', ['<', ['get', 'rank'], 25], ['!=', ['get', 'city'], '']],
        layout: {
          'text-field': ['format',
            ['get', 'city'],   { 'font-scale': 1.0 },
            '\n',              {},
            ['get', 'imp_fmt'],{ 'font-scale': 0.78, 'text-color': '#FDA4D4' },
          ],
          'text-size':          ['interpolate', ['linear'], ['get', 'ir'], 0, 14, 1, 20],
          'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-offset':        [0, 1.3],
          'text-anchor':        'top',
          'text-allow-overlap': false,
          'text-optional':      true,
          'text-max-width':     8,
          'text-line-height':   1.3,
        },
        paint: {
          'text-color':      ['interpolate', ['linear'], ['get', 'ir'], 0, 'rgba(255,255,255,0.65)', 0.5, '#e0d0ff', 1, '#FDA4D4'],
          'text-halo-color': 'rgba(14,3,32,0.92)',
          'text-halo-width': 2,
        },
      });

      this._map.addLayer({
        id: 'hotspots-pulse-ring', type: 'circle', source: 'hotspots-pulse',
        paint: {
          'circle-radius':         ['get', 'pr'],
          'circle-color':          'transparent',
          'circle-stroke-width':   1.5,
          'circle-stroke-color':   ['case', ['>', ['get', 'ir'], 0.4], '#FDA4D4', '#67E8F9'],
          'circle-stroke-opacity': ['get', 'po'],
          'circle-blur':           0.3,
        },
      });

      this._map.addLayer({
        id: 'datacenter-marks', type: 'circle', source: 'datacenters',
        paint: {
          'circle-radius':       7,
          'circle-color':        '#FFFFFF',
          'circle-opacity':      0.92,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#67E8F9',
        },
      });

      this._map.addLayer({
        id: 'datacenter-pulse-ring', type: 'circle', source: 'datacenter-pulse',
        paint: {
          'circle-radius':         ['get', 'pr'],
          'circle-color':          'transparent',
          'circle-stroke-width':   2,
          'circle-stroke-color':   '#67E8F9',
          'circle-stroke-opacity': ['get', 'po'],
          'circle-blur':           0.2,
        },
      });

      // Hide Mapbox base settlement labels — our hotspot-labels layer replaces them
      // and is positioned at the same coordinates as the hotspot dots (no mismatch)
      ['settlement-major-label', 'settlement-minor-label', 'settlement-subdivision-label',
       'place-city-label', 'place-town-label', 'place-village-label'].forEach(id => {
        if (this._map.getLayer(id))
          this._map.setLayoutProperty(id, 'visibility', 'none');
      });

      // State labels with impression totals — matches old canvas map display
      this._map.addLayer({
        id: 'state-labels', type: 'symbol', source: 'us-states',
        filter: ['>', ['get', 'impressions'], 0],
        layout: {
          'text-field': ['format',
            ['get', 'id'],      { 'font-scale': 1.0 },
            '\n',               {},
            ['get', 'imp_fmt'], { 'font-scale': 0.75, 'text-color': '#FDA4D4' },
          ],
          'text-size':          ['interpolate', ['linear'], ['zoom'], 3, 13, 5, 19],
          'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-letter-spacing': 0.08,
          'text-allow-overlap': false,
          'text-optional':      true,
          'text-line-height':   1.2,
        },
        paint: {
          'text-color':      ['interpolate', ['linear'], ['get', 'intensity'], 0, 'rgba(255,255,255,0.45)', 1, 'rgba(255,255,255,0.9)'],
          'text-halo-color': 'rgba(14,3,32,0.9)',
          'text-halo-width': 2,
        },
      });
    }

    update(data) {
      this._data = data;
      if (this._map && this._map.isStyleLoaded()) this._applyData(data);
    }

    _applyData(data) {
      const US       = window.US_STATES;
      const states   = data.states   || {};
      const hotspots = data.hotspots || [];
      const maxImp   = Object.values(states).reduce((m, s) => Math.max(m, s.impressions || 0), 1);
      const maxHot   = hotspots.length ? (hotspots[0].impressions || 1) : 1;
      // Update state choropleth using cached HQ geometry
      if (this._stateGeoFeatures) {
        const stateFeatures = this._stateGeoFeatures.map(f => {
          const sid = f.properties && f.properties.id;
          const st  = (sid && states[sid]) || { impressions: 0 };
          const raw = st.impressions || 0;
          // Power scale 0.4: states with 10% of top delivery still show ~40% colour
          const intensity = maxImp > 0 ? Math.pow(raw / maxImp, 0.4) : 0;
          return {
            ...f,
            properties: {
              ...f.properties,
              id: sid,
              intensity,
              impressions: raw,
              imp_fmt: raw > 0 ? fmtImp(raw) : '',
            },
          };
        });
        this._map.getSource('us-states')?.setData({ type: 'FeatureCollection', features: stateFeatures });
      }

      const hotFeatures = hotspots
        .filter(h => h.lat && h.lon)
        .map((h, i) => {
          const cityName = ZIP3_CITY[h.zip3] || h.city || '';
          return {
          type: 'Feature',
          properties: {
            ir:      (h.impressions || 0) / maxHot,
            city:    cityName,
            imp_fmt: cityName ? fmtImp(h.impressions || 0) : '',
            rank:    i,
          },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
          };
        });
      this._map.getSource('hotspots')?.setData({ type: 'FeatureCollection', features: hotFeatures });

      // Cache zip5 heatmap data when available — used in heatmap mode for higher precision
      const hotspotsZ5 = data.hotspots_z5 || [];
      if (hotspotsZ5.length > 0) {
        const maxZ5 = hotspotsZ5[0].impressions || 1;
        this._heatmapSource = hotspotsZ5
          .filter(h => h.lat && h.lon)
          .map(h => ({
            type: 'Feature',
            properties: { ir: (h.impressions || 0) / maxZ5 },
            geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
          }));
      }

      // Re-read mglConfig in case Studio changed it, then apply
      this._cfg = buildMapConfig(this._config.mglConfig);
      this._applyColorScheme(this._cfg.colorScheme);
      this._applyZoomViz(this._cfg.zoomViz);
      if (this._cfg.mapStyle !== this._currentStyle) {
        this._applyMapStyle(this._cfg.mapStyle);
      }
      if (this._lbEl) {
        this._lbEl.style.display = this._cfg.showLeaderboard ? '' : 'none';
      }

      const region = data.region || this._config.mapConfig?.region;
      const bounds = REGION_BOUNDS[region] || USA_BOUNDS;

      // For regional views, clip arcs/particles to hotspots near the viewport
      // so traces and their animated trails are always visible together.
      // Use a generous buffer so approaching arcs enter from the DC side.
      const arcHotspots = region ? hotspots.filter(h => {
        if (!h.lat || !h.lon) return false;
        const pad = 10; // degrees — keeps DCs that sit just outside the region
        return h.lon >= bounds[0][0] - pad && h.lon <= bounds[1][0] + pad &&
               h.lat >= bounds[0][1] - pad && h.lat <= bounds[1][1] + pad;
      }) : hotspots;

      this._buildCorridors(arcHotspots.slice(0, 50), maxHot);
      this._initParticles(arcHotspots.slice(0, 50));
      if (!this._visObs) this._watchVisibility();

      // Only start animation if this map's page is currently active
      const _activePage = this._wrap?.closest?.('.dashboard-page');
      if (!_activePage || _activePage.classList.contains('active')) {
        if (!this._animId) this._startAnimation();
        if (!this._pulseId) this._startPulse();
      }

      // Only re-fit bounds when they change — avoids constant 800ms re-animation on every refresh
      const boundsKey = JSON.stringify(bounds);
      if (boundsKey !== this._lastBounds) {
        this._lastBounds = boundsKey;
        this._map.once('moveend', () => this._positionRegionPanels());
        // Offset padding: leaderboard (340px) on right, total overlay (~110px) on left bottom
        const lbVisible = this._cfg.showLeaderboard !== false;
        this._map.fitBounds(bounds, {
          padding: { top: 24, right: lbVisible ? 368 : 24, bottom: 60, left: 24 },
          duration: 800,
        });
      } else {
        this._positionRegionPanels();
      }

      this._renderLeaderboard(states, maxImp, data.totals);
    }

    _buildCorridors(hotspots, maxHot) {
      this._corridorPaths = [];
      const features = [];
      hotspots.forEach(hs => {
        if (!hs.lat || !hs.lon) return;
        const dc = DATA_CENTERS.reduce((nearest, d) => {
          const dist = Math.hypot(hs.lon - d.lon, hs.lat - d.lat);
          return dist < Math.hypot(hs.lon - nearest.lon, hs.lat - nearest.lat) ? d : nearest;
        });
        const mx  = (dc.lon + hs.lon) / 2;
        const my  = (dc.lat + hs.lat) / 2 + Math.abs(dc.lat - hs.lat) * 0.15 + 0.5;
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const it = 1 - t;
          pts.push([
            it * it * dc.lon + 2 * it * t * mx + t * t * hs.lon,
            it * it * dc.lat + 2 * it * t * my + t * t * hs.lat,
          ]);
        }
        pts[pts.length - 1] = [hs.lon, hs.lat]; // guarantee arc terminates exactly at hotspot
        const ir = Math.sqrt((hs.impressions || 0) / maxHot);
        // Store for particle alignment — particles pick from this same set
        this._corridorPaths.push({ dc, tgt: hs, ir });
        features.push({
          type: 'Feature',
          properties: {
            lw: +(0.5 + ir * 1.5).toFixed(3),   // exact canvas: 0.5 + impRatio*1.5 (0.5→2px)
            lo: +(0.04 + ir * 0.12).toFixed(3),  // exact canvas: 0.04 + impRatio*0.12
            ir: +ir.toFixed(3),
            dc: dc.id,
          },
          geometry: { type: 'LineString', coordinates: pts },
        });
      });
      this._map.getSource('arc-corridors')?.setData({ type: 'FeatureCollection', features });
    }

    _initParticles(_hotspots) {
      // Particles travel on the exact same DC→hotspot paths as the corridor lines.
      // _buildCorridors() must be called first to populate this._corridorPaths.
      const paths = this._corridorPaths;
      if (!paths || !paths.length) { this._particles = []; return; }

      this._particles = Array.from({ length: this._cfg.particleCount }, () => {
        const path   = paths[Math.floor(Math.random() * paths.length)];
        const weight = path.ir; // already sqrt-scaled (0–1)
        return {
          t:     Math.random() * 0.9,          // stagger start positions
          speed: 0.003 + weight * 0.006,       // canvas: 0.003 + random*0.006
          dc:    path.dc,
          tgt:   path.tgt,
          ir:    weight,
          pt:    Math.random() > 0.7 ? 'fast' : 'normal',
          sz:    2 + weight * 5,               // 2–7px matches canvas 2.5*size (size=1–3)
        };
      });
    }

    _startAnimation() {
      if (this._animId) return; // already running

      // Trail parameters match canvas charts.js exactly:
      //   trailLength 8 (fast) or 12 (normal), step 0.015 in t-space
      //   alpha:  0.5 - seg*0.04  (same formula as canvas)
      //   size:   (1 - seg*0.06) * sz  (canvas: (2.5 - trail*0.15) * p.size)
      //   ease-out cubic on position: eased = 1 - (1-t)^3
      //   fade in first 10%, fade out last 15% of arc

      const tick = () => {
        if (this._map?.getSource('arc-particles')) {
          const features = [];

          this._particles.forEach(p => {
            p.t += p.speed * (p.pt === 'fast' ? 1.5 : 1) * this._cfg.particleSpeed;
            if (p.t > 1) {
              p.t = -Math.random() * 0.15; // brief pause before next arc (canvas pattern)
              const paths = this._corridorPaths;
              if (paths && paths.length) {
                const path = paths[Math.floor(Math.random() * paths.length)];
                p.dc    = path.dc;
                p.tgt   = path.tgt;
                p.ir    = path.ir;
                p.sz    = 2 + path.ir * 5;   // 2–7px — matches canvas 2.5*size range
                p.speed = 0.003 + path.ir * 0.006;
                p.pt    = Math.random() > 0.7 ? 'fast' : 'normal';
              }
            }
            if (p.t < 0) return; // pause phase — no rendering

            const { dc, tgt, sz, pt } = p;
            const ir   = p.ir || 0;
            const raw  = p.t;
            const mx   = (dc.lon + tgt.lon) / 2;
            const my   = (dc.lat + tgt.lat) / 2 + Math.abs(dc.lat - tgt.lat) * 0.15 + 0.5;
            // Canvas fade: fade in 0→0.1, full 0.1→0.85, fade out 0.85→1
            const fadeAlpha = raw < 0.1 ? raw / 0.1 : (raw > 0.85 ? (1 - raw) / 0.15 : 1);
            const trailSegs = pt === 'fast' ? 8 : 12;

            for (let seg = 0; seg <= trailSegs; seg++) {
              const tt = Math.max(0, raw - seg * 0.015);
              if (seg > 0 && tt === 0) break;

              // Ease-out cubic — matches canvas `eased = 1 - Math.pow(1-t, 3)`
              const easedT = 1 - Math.pow(1 - tt, 3);
              const it     = 1 - easedT;
              const lon    = it * it * dc.lon + 2 * it * easedT * mx + easedT * easedT * tgt.lon;
              const lat    = it * it * dc.lat + 2 * it * easedT * my + easedT * easedT * tgt.lat;

              // Canvas formula: alpha = (0.5 - seg*0.04) * fadeAlpha
              const fa = +(Math.max(0.01, (0.5 - seg * 0.04) * fadeAlpha)).toFixed(3);
              // Canvas formula: size = (2.5 - seg*0.15) * p.size → scaled to sz
              const ss = +(Math.max(0.4, (1 - seg * 0.06) * sz)).toFixed(2);
              // Glow alpha = 0.1 * fadeAlpha (canvas: 8*size radius at 0.1*alpha)
              const ga = +(0.1 * fadeAlpha * (1 - seg / trailSegs)).toFixed(3);

              features.push({
                type: 'Feature',
                properties: {
                  pt, sz: ss, dc: p.dc.id,
                  ir: +(ir * (1 - seg / trailSegs)).toFixed(3),
                  fa, ga,
                },
                geometry: { type: 'Point', coordinates: [lon, lat] },
              });
            }
          });

          this._map.getSource('arc-particles').setData({
            type: 'FeatureCollection', features,
          });
        }

        this._animId = requestAnimationFrame(tick);
      };

      this._animId = requestAnimationFrame(tick);
    }

    // Dynamically align WEST/CENTRAL/EAST panels to their DC icon positions on screen.
    _positionRegionPanels() {
      if (!this._map || !this._regionPanels) return;
      const dcKeyMap = { 'us-west1': 'west', 'us-central1': 'central', 'us-east4': 'east' };
      const cw = this._wrap.offsetWidth;
      const ch = this._wrap.offsetHeight;
      const lbW  = 340 + 12; // leaderboard width + right gap
      const PW   = 160;      // approx panel width
      const PH   = 115;      // approx panel height

      DATA_CENTERS.forEach(dc => {
        const key   = dcKeyMap[dc.id];
        const entry = this._regionPanels[key];
        if (!entry?.panel) return;
        if (this._overlayPositions && this._overlayPositions[key]) return;

        const px = this._map.project([dc.lon, dc.lat]);

        // Hide panels for DCs that are off-screen (regional maps only show some DCs)
        if (px.x < -40 || px.x > cw + 40 || px.y < -40 || px.y > ch + 40) {
          entry.panel.style.display = 'none';
          return;
        }
        entry.panel.style.display = '';

        let x = Math.round(px.x - PW / 2);
        let y = Math.round(px.y - PH - 52); // sit above the DC marker

        // Clamp horizontally: keep within map, don't overlap leaderboard
        x = Math.max(8, Math.min(cw - lbW - PW - 8, x));
        // Clamp vertically
        y = Math.max(8, Math.min(ch - PH - 8, y));

        entry.panel.style.left   = x + 'px';
        entry.panel.style.top    = y + 'px';
        entry.panel.style.right  = 'auto';
        entry.panel.style.bottom = 'auto';
        entry.panel.style.transform = '';
      });
    }

    _applyOverlayPosition(el, key) {
      const pos = this._overlayPositions && this._overlayPositions[key];
      if (!pos) return;
      el.style.top    = pos.top;
      el.style.left   = pos.left;
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
      if (key === 'leaderboard' && !el.style.width) {
        el.style.width = '340px';
      }
      if (pos.width)  {
        el.style.width  = pos.width;
        this._applyOverlayScale(el, key, pos.width);
      }
      if (pos.height) el.style.height = pos.height;
    }

    _saveOverlayPosition(key, el) {
      if (!this._overlayPositions) this._overlayPositions = {};
      this._overlayPositions[key] = { top: el.style.top, left: el.style.left };
    }

    _saveOverlaySize(key, el) {
      if (!this._overlayPositions) this._overlayPositions = {};
      if (!this._overlayPositions[key]) this._overlayPositions[key] = {};
      const pos = this._overlayPositions[key];
      if (el.style.width)  pos.width  = el.style.width;
      else                 delete pos.width;
      if (el.style.height) pos.height = el.style.height;
      else                 delete pos.height;
    }

    _addResizeHandles(el, key) {
      if (!document.body.classList.contains('studio-body')) return;
      // Resize handle element — purely visual; interaction is handled by _makeInteractive
      const handle = document.createElement('div');
      handle.className = 'mgl-resize-se';
      handle.style.pointerEvents = 'none'; // parent overlay handles all events
      el.appendChild(handle);
    }

    // Inject a small ✕ hide button on each overlay in studio mode.
    // Clicking it hides that overlay and fires an mgl-overlay-hidden event
    // so studio-canvas.js can persist the flag to wc.mglConfig.
    _addOverlayHideBtn(el, cfgFlag) {
      if (!document.body.classList.contains('studio-body')) return;
      const self = this;
      const btn = document.createElement('button');
      btn.className   = 'mgl-overlay-hide-btn';
      btn.type        = 'button';
      btn.textContent = '\u2715'; // ✕
      btn.title       = 'Hide this overlay (restore via Map GL Config panel)';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        el.style.display = 'none';
        // Persist the flag so it survives a save/reload cycle
        self._wrap.dispatchEvent(new CustomEvent('mgl-overlay-hidden', {
          bubbles: true,
          detail:  { flag: cfgFlag, value: false },
        }));
      });
      el.appendChild(btn);
    }

    // Natural widths for each overlay type (used to compute scale factor)
    _overlayNaturalWidths() {
      return { leaderboard: 340, totalOverlay: 220, west: 160, central: 160, east: 160, clientLogo: 120 };
    }

    _applyOverlayScale(el, key, widthPx) {
      if (!widthPx) return;
      const nat = this._overlayNaturalWidths()[key];
      if (!nat) return;
      const nw = parseFloat(widthPx);
      if (isNaN(nw) || nw <= 0) return;
      const scale = Math.max(0.3, Math.min(3.0, nw / nat));

      if (key === 'totalOverlay') {
        const v = el.querySelector('.mgl-total-value');
        const l = el.querySelector('.mgl-total-label');
        const s = el.querySelector('.mgl-total-sub');
        if (v) v.style.fontSize = Math.round(72 * scale) + 'px';
        if (l) l.style.fontSize = Math.round(12 * scale) + 'px';
        if (s) s.style.fontSize = Math.round(13 * scale) + 'px';
      } else if (key === 'leaderboard') {
        this._lbScale = Math.max(0.4, Math.min(2.5, scale));
        const t = el.querySelector('.mgl-lb-title');
        const h = el.querySelector('.mgl-lb-header-total');
        if (t) t.style.fontSize = Math.round(17 * this._lbScale) + 'px';
        if (h) h.style.fontSize = Math.round(17 * this._lbScale) + 'px';
        // Re-render rows at new scale if data is available
        if (this._data && this._data.states) {
          this._renderLeaderboard(this._data.states, 1, this._data.totals || {});
        }
      } else if (key === 'west' || key === 'central' || key === 'east') {
        const imp  = el.querySelector('.mgl-region-impressions');
        const name = el.querySelector('.mgl-region-name');
        const meta = el.querySelector('.mgl-region-meta');
        if (imp)  imp.style.fontSize  = Math.round(40 * scale) + 'px';
        if (name) name.style.fontSize = Math.round(16 * scale) + 'px';
        if (meta) meta.style.fontSize = Math.round(13 * scale) + 'px';
      }
    }

    _makeDraggable(el, key) {
      if (!document.body.classList.contains('studio-body')) return;
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'grab';

      const RESIZE_ZONE = 48; // px from bottom-right corner treated as resize zone
      const GRID        = 20; // px — snap overlays to this grid while dragging
      const self = this;
      let mode = null; // 'drag' | 'resize'
      let startX = 0, startY = 0, startW = 0, startH = 0;

      function snapGrid(v) { return Math.round(v / GRID) * GRID; }

      el.addEventListener('pointerdown', function (e) {
        // Don't interfere with studio control bar (drag handle, delete button)
        if (e.target.closest('.studio-widget-bar')) return;

        e.preventDefault();
        // Stop the click from bubbling to the map widget card and selecting the whole widget
        e.stopPropagation();
        const er = el.getBoundingClientRect();
        // Determine mode from click position
        mode = (e.clientX > er.right - RESIZE_ZONE && e.clientY > er.bottom - RESIZE_ZONE)
          ? 'resize' : 'drag';

        el.setPointerCapture(e.pointerId); // single capture on the overlay always

        // Show snap grid guide during drag
        if (self._snapGridEl) self._snapGridEl.classList.add('visible');

        if (mode === 'drag') {
          el.style.cursor = 'grabbing';
          const cr = self._wrap.getBoundingClientRect();
          el.style.top    = (er.top  - cr.top)  + 'px';
          el.style.left   = (er.left - cr.left) + 'px';
          el.style.right  = 'auto';
          el.style.bottom = 'auto';
          if (key === 'leaderboard') el.style.width = er.width + 'px';
          startX = e.clientX - el.offsetLeft;
          startY = e.clientY - el.offsetTop;
        } else {
          el.style.cursor = 'se-resize';
          startW = el.offsetWidth;
          startH = el.offsetHeight;
          startX = e.clientX;
          startY = e.clientY;
        }
      });

      el.addEventListener('pointermove', function (e) {
        if (e.buttons === 0 || !mode) return;
        if (mode === 'drag') {
          const cr = self._wrap.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          let nx = snapGrid(e.clientX - startX);
          let ny = snapGrid(e.clientY - startY);
          nx = Math.max(0, Math.min(nx, cr.width  - er.width));
          ny = Math.max(0, Math.min(ny, cr.height - er.height));
          el.style.left = nx + 'px';
          el.style.top  = ny + 'px';
        } else {
          const cr = self._wrap.getBoundingClientRect();
          const er = el.getBoundingClientRect();
          let nw = startW + (e.clientX - startX);
          let nh = startH + (e.clientY - startY);
          nw = Math.max(80, nw);
          nh = Math.max(40, nh);
          nw = Math.min(nw, cr.width  - (er.left - cr.left));
          nh = Math.min(nh, cr.height - (er.top  - cr.top));
          el.style.width  = nw + 'px';
          el.style.height = nh + 'px';
        }
      });

      el.addEventListener('pointerup', function (e) {
        el.releasePointerCapture(e.pointerId);
        // Hide snap grid guide
        if (self._snapGridEl) self._snapGridEl.classList.remove('visible');
        if (mode === 'drag') {
          el.style.cursor = 'grab';
          self._saveOverlayPosition(key, el);
        } else {
          el.style.cursor = 'grab';
          self._applyOverlayScale(el, key, el.style.width); // scale text only on release
          self._saveOverlaySize(key, el);
        }
        mode = null;
        self._wrap.dispatchEvent(new CustomEvent('mgl-overlay-moved', {
          bubbles: true,
          detail: { positions: Object.assign({}, self._overlayPositions) },
        }));
      });
    }

    // Stop animation when page leaves view; restart when it returns.
    _watchVisibility() {
      if (this._visObs) return;
      const page = this._wrap?.closest?.('.dashboard-page');
      if (!page) {
        setTimeout(() => this._watchVisibility(), 200);
        return;
      }
      this._visObs = new MutationObserver(() => {
        const active = page.classList.contains('active');
        if (active) {
          if (this._map) this._map.resize();
          if (!this._animId) this._startAnimation();
          if (!this._pulseId) this._startPulse();
        } else {
          if (this._animId)  { cancelAnimationFrame(this._animId); this._animId = null; }
          if (this._pulseId) { clearInterval(this._pulseId); this._pulseId = null; }
        }
      });
      this._visObs.observe(page, { attributes: true, attributeFilter: ['class'] });
    }

    _startPulse() {
      let tick = 0;
      this._pulseId = setInterval(() => {
        if (!this._map) return;
        tick += 1;
        const t = tick / 7;

        // Hotspot pulse rings — top 20
        if (this._data?.hotspots?.length) {
          const maxHot = this._data.hotspots[0]?.impressions || 1;
          const features = this._data.hotspots
            .filter(h => h.lat && h.lon)
            .slice(0, 20)
            .map((h, i) => {
              const phase = (t * 0.8 + i * 0.31) % 1;
              const ir    = (h.impressions || 0) / maxHot;
              const baseR = 3 + ir * 14;
              return {
                type: 'Feature',
                properties: { pr: baseR + phase * 22, po: (1 - phase) * 0.38 * ir, ir },
                geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
              };
            });
          this._map.getSource('hotspots-pulse')?.setData({ type: 'FeatureCollection', features });
        }

        // Data center pulse rings
        const dcFeatures = DATA_CENTERS.map((dc, i) => {
          const phase = (t * 0.55 + i * 0.33) % 1;
          return {
            type: 'Feature',
            properties: { pr: 8 + phase * 28, po: (1 - phase) * 0.65 },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          };
        });
        this._map.getSource('datacenter-pulse')?.setData({ type: 'FeatureCollection', features: dcFeatures });
      }, 150);
    }

    _applyColorScheme(schemeName) {
      if (!this._map?.isStyleLoaded()) return;
      const s = getColorScheme(schemeName);

      this._map.setPaintProperty('arc-particles',
        'circle-color', ['case', ['==', ['get', 'pt'], 'fast'], s.particleFast, s.particleNormal]);
      if (this._map.getLayer('arc-particles-glow')) {
        this._map.setPaintProperty('arc-particles-glow',
          'circle-color', ['case', ['==', ['get', 'pt'], 'fast'], s.particleFast, s.particleNormal]);
      }
      if (this._map.getLayer('hotspots-pulse-ring')) {
        this._map.setPaintProperty('hotspots-pulse-ring',
          'circle-stroke-color', ['case', ['>', ['get', 'ir'], 0.4], s.particleFast, s.particleNormal]);
      }
      if (this._map.getLayer('states-glow')) {
        this._map.setPaintProperty('states-glow', 'line-color',
          ['interpolate', ['linear'], ['get', 'intensity'],
            0.45, '#7c3aed', 0.75, '#b87aff', 1.0, s.stateGlowHigh]);
      }

      if (this._map.getLayer('hotspot-labels'))
        this._map.setPaintProperty('hotspot-labels', 'text-color', s.particleNormal + 'aa');

      if (this._map.getLayer('states-fill')) {
        this._map.setPaintProperty('states-fill', 'fill-color', s.choropleth || CHOROPLETH);
      }
    }

    _applyZoomViz(mode) {
      if (!this._map?.isStyleLoaded()) return;
      const isHeatmap = mode === 'heatmap';
      const vis = (show) => show ? 'visible' : 'none';

      if (this._map.getLayer('delivery-heatmap'))
        this._map.setLayoutProperty('delivery-heatmap',    'visibility', vis(isHeatmap));
      if (this._map.getLayer('hotspots-glow'))
        this._map.setLayoutProperty('hotspots-glow',       'visibility', vis(!isHeatmap));
      if (this._map.getLayer('hotspots-core'))
        this._map.setLayoutProperty('hotspots-core',       'visibility', vis(!isHeatmap));
      if (this._map.getLayer('hotspots-pulse-ring'))
        this._map.setLayoutProperty('hotspots-pulse-ring', 'visibility', vis(!isHeatmap));

      // Swap hotspot source data: zip5 for heatmap (precision), zip3 for dots (readability)
      if (isHeatmap && this._heatmapSource?.length > 0) {
        this._map.getSource('hotspots')?.setData({
          type: 'FeatureCollection', features: this._heatmapSource,
        });
      } else if (!isHeatmap && this._data?.hotspots?.length > 0) {
        const maxHot = this._data.hotspots[0]?.impressions || 1;
        const z3Features = this._data.hotspots.filter(h => h.lat && h.lon).map((h, i) => {
          const cityName = ZIP3_CITY[h.zip3] || h.city || '';
          return {
          type: 'Feature',
          properties: { ir: (h.impressions || 0) / maxHot, city: cityName, imp_fmt: cityName ? fmtImp(h.impressions || 0) : '', rank: i },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
          }; });
        this._map.getSource('hotspots')?.setData({ type: 'FeatureCollection', features: z3Features });
      }
    }

    _applyMapStyle(styleName) {
      if (!this._map) return;
      if (this._currentStyle === styleName) return;
      this._currentStyle = styleName;

      const newStyle = styleName === 'mapbox'
        ? 'mapbox://styles/mapbox/dark-v11'
        : this._blankStyle();

      this._map.setStyle(newStyle);

      this._map.once('style.load', async () => {
        await this._addSources();
        this._addLayers();
        if (this._data) this._applyData(this._data);

        // Suppress road/label clutter in Mapbox style
        if (styleName === 'mapbox') {
          // Hide roads & transit clutter but KEEP state/place/country labels and admin lines
          const hide = [
            'road-street', 'road-street-low', 'road-minor', 'road-minor-low',
            'road-primary', 'road-secondary', 'road-tertiary',
            'road-motorway', 'road-motorway-link', 'road-trunk', 'road-trunk-link',
            'road-rail', 'road-service', 'road-ferry',
            'transit-label', 'poi-label',
          ];
          hide.forEach(id => {
            if (this._map.getLayer(id))
              this._map.setLayoutProperty(id, 'visibility', 'none');
          });
          // Ensure admin + label layers are visible
          ['admin-state-line-2', 'admin-state-line-1', 'state-label',
           'country-label', 'settlement-major-label', 'settlement-minor-label'].forEach(id => {
            if (this._map.getLayer(id))
              this._map.setLayoutProperty(id, 'visibility', 'visible');
          });
        }
      });
    }

    _buildOverlayDOM() {
      // ── Snap-grid guide (studio-mode only, shown during overlay drag) ────────
      if (document.body.classList.contains('studio-body')) {
        this._snapGridEl = document.createElement('div');
        this._snapGridEl.className = 'mgl-snap-grid';
        this._wrap.appendChild(this._snapGridEl);
      }

      // ── GCP data center icon markers ────────────────────────────────────────
      DATA_CENTERS.forEach(dc => {
        const el = document.createElement('img');
        el.className = 'mgl-dc-marker';
        el.src   = '/img/gcp-icon.png';
        el.title = dc.label + ' — ' + dc.id;
        this._dcMarkers = this._dcMarkers || [];
        this._dcMarkers.push({ dc, el, marker: null });
      });

      // ── Regional data panels (WEST / CENTRAL / EAST) ────────────────────────
      this._regionPanels = {};
      [
        { key: 'west',    label: 'WEST',    cfgFlag: 'showRegionWest'    },
        { key: 'central', label: 'CENTRAL', cfgFlag: 'showRegionCentral' },
        { key: 'east',    label: 'EAST',    cfgFlag: 'showRegionEast'    },
      ].forEach(({ key, label, cfgFlag }) => {
        const panel = document.createElement('div');
        panel.className = 'mgl-region-panel';
        panel.style.position = 'absolute';

        // Hide if the config flag is false
        if (this._cfg[cfgFlag] === false) panel.style.display = 'none';

        const nameEl = document.createElement('div');
        nameEl.className   = 'mgl-region-name';
        nameEl.textContent = label;

        const impEl = document.createElement('div');
        impEl.className   = 'mgl-region-impressions';
        impEl.textContent = '—';

        const metaEl = document.createElement('div');
        metaEl.className = 'mgl-region-meta';
        const bidsEl = document.createElement('span');
        bidsEl.className = 'mgl-region-bids';
        const svcEl  = document.createElement('span');
        svcEl.className  = 'mgl-region-svc';
        metaEl.appendChild(bidsEl);
        metaEl.appendChild(svcEl);

        panel.appendChild(nameEl);
        panel.appendChild(impEl);
        panel.appendChild(metaEl);
        this._addOverlayHideBtn(panel, cfgFlag);
        this._wrap.appendChild(panel);
        this._applyOverlayPosition(panel, key);
        this._makeDraggable(panel, key);
        this._addResizeHandles(panel, key);

        this._regionPanels[key] = { panel, impEl, bidsEl, svcEl };
      });

      // ── Leaderboard ─────────────────────────────────────────────────────────
    }

    _buildLeaderboardDOM() {
      const lb = document.createElement('div');
      lb.className = 'mgl-leaderboard';

      // Respect showLeaderboard flag
      if (this._cfg.showLeaderboard === false) lb.style.display = 'none';

      const title = document.createElement('div');
      title.className = 'mgl-lb-title';
      title.textContent = 'TOP MARKETS';

      const rowsWrap = document.createElement('div');
      rowsWrap.className = 'mgl-lb-rows';

      this._lbScrollEl = document.createElement('div');
      this._lbScrollEl.className = 'mgl-lb-scroll';
      rowsWrap.appendChild(this._lbScrollEl);

      this._lbTotals = document.createElement('div');
      this._lbTotals.className = 'mgl-lb-totals';

      lb.appendChild(title);
      lb.appendChild(rowsWrap);
      lb.appendChild(this._lbTotals);
      this._lbEl = lb;
      this._addOverlayHideBtn(lb, 'showLeaderboard');
      this._wrap.appendChild(lb);
      this._applyOverlayPosition(lb, 'leaderboard');
      this._makeDraggable(lb, 'leaderboard');
      this._addResizeHandles(lb, 'leaderboard');

      // Leaderboard header total (above title)
      this._lbHeaderTotal = document.createElement('div');
      this._lbHeaderTotal.className   = 'mgl-lb-header-total';
      this._lbHeaderTotal.textContent = '\u2014';
      lb.insertBefore(this._lbHeaderTotal, lb.firstChild);

      // Client logo overlay (top-left corner)
      if (this._cfg.clientLogo) {
        const logoWrap = document.createElement('div');
        logoWrap.className = 'mgl-client-logo';

        // Respect showClientLogo flag
        if (this._cfg.showClientLogo === false) logoWrap.style.display = 'none';

        const logoImg = document.createElement('img');
        logoImg.src = this._cfg.clientLogo;
        logoImg.alt = '';
        logoImg.onerror = () => logoWrap.remove();
        logoWrap.style.setProperty('--logo-fit', this._cfg.logoFit || 'cover');
        logoWrap.appendChild(logoImg);
        this._addOverlayHideBtn(logoWrap, 'showClientLogo');
        this._wrap.appendChild(logoWrap);
        this._applyOverlayPosition(logoWrap, 'clientLogo');
        this._makeDraggable(logoWrap, 'clientLogo');
        this._addResizeHandles(logoWrap, 'clientLogo');
      }

      // Bottom-left impressions total overlay
      const overlay = document.createElement('div');
      overlay.className = 'mgl-total-overlay';

      // Respect showTotalOverlay flag
      if (this._cfg.showTotalOverlay === false) overlay.style.display = 'none';

      const lbl = document.createElement('div');
      lbl.className   = 'mgl-total-label';
      lbl.textContent = '\u2B23 LIVE DELIVERY';

      this._totalValueEl = document.createElement('div');
      this._totalValueEl.className   = 'mgl-total-value';
      this._totalValueEl.textContent = '\u2014';

      const sub = document.createElement('div');
      sub.className   = 'mgl-total-sub';
      sub.textContent = 'impressions right now';

      overlay.appendChild(lbl);
      overlay.appendChild(this._totalValueEl);
      overlay.appendChild(sub);
      this._addOverlayHideBtn(overlay, 'showTotalOverlay');
      this._wrap.appendChild(overlay);
      this._applyOverlayPosition(overlay, 'totalOverlay');
      this._makeDraggable(overlay, 'totalOverlay');
      this._addResizeHandles(overlay, 'totalOverlay');
    }

    _renderLeaderboard(states, maxImp, totals) {
      if (!this._lbScrollEl) return;

      const sorted = Object.entries(states)
        .filter(([, s]) => s.impressions > 0)
        .sort(([, a], [, b]) => b.impressions - a.impressions)
        .slice(0, 20);

      const totalImp = sorted.reduce((sum, [, s]) => sum + (s.impressions || 0), 0) || 1;

      // Use the shared fmtImp() for consistent number display across all overlays

      // Colour ramp: rank 1 = pink, fades to violet for lower ranks
      const rankColor = (i) => {
        const t = i / Math.max(sorted.length - 1, 1);
        // Pink (#FDA4D4) → violet (#7c3aed)
        const r = Math.round(253 - t * (253 - 124));
        const g = Math.round(164 - t * (164 - 58));
        const b = Math.round(212 - t * (212 - 237));
        return `rgb(${r},${g},${b})`;
      };

      // Rebuild rows — preserve existing tbody if present to allow CSS transitions
      this._lbScrollEl.textContent = '';
      const table = document.createElement('table');
      table.className = 'mgl-lb-table';

      // Header
      const thead = document.createElement('thead');
      const hrow  = document.createElement('tr');
      ['#', 'ST', 'IMPRESSIONS', '%'].forEach(label => {
        const th = document.createElement('th');
        th.textContent = label;
        hrow.appendChild(th);
      });
      thead.appendChild(hrow);
      table.appendChild(thead);

      // Body
      const tbody = document.createElement('tbody');
      sorted.forEach(([stateId, s], i) => {
        const pct   = ((s.impressions / totalImp) * 100).toFixed(1);
        const color = rankColor(i);

        const tr = document.createElement('tr');
        // Left accent stripe by rank colour
        tr.style.borderLeft = `3px solid ${color}`;

        const tdRank = document.createElement('td');
        tdRank.className   = 'mgl-lb-rank-cell';
        tdRank.textContent = i + 1;
        tdRank.style.color = color;

        const tdState = document.createElement('td');
        tdState.className   = 'mgl-lb-state-cell';
        tdState.textContent = stateId;
        tdState.style.color = color;

        const tdImp = document.createElement('td');
        tdImp.className   = 'mgl-lb-imp-cell';
        tdImp.textContent = fmtImp(s.impressions);

        // Apply leaderboard scale to row text if box has been resized
        if (this._lbScale && this._lbScale !== 1) {
          const fs = Math.round(18 * this._lbScale) + 'px';
          tdRank.style.fontSize  = fs;
          tdState.style.fontSize = fs;
          tdImp.style.fontSize   = fs;
        }

        // Percentage cell with inline mini-bar
        const tdPct = document.createElement('td');
        tdPct.className = 'mgl-lb-pct-cell';
        const barWrap = document.createElement('div');
        barWrap.className = 'mgl-lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'mgl-lb-bar';
        bar.style.width = pct + '%';
        bar.style.background = `linear-gradient(90deg, ${color}88, ${color})`;
        barWrap.appendChild(bar);
        const pctSpan = document.createElement('span');
        pctSpan.textContent = pct + '%';
        pctSpan.style.color = color;
        tdPct.appendChild(barWrap);
        tdPct.appendChild(pctSpan);

        tr.appendChild(tdRank);
        tr.appendChild(tdState);
        tr.appendChild(tdImp);
        tr.appendChild(tdPct);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      this._lbScrollEl.appendChild(table);

      // Update regional panels (WEST/CENTRAL/EAST data)
      const regions = this._data?.regions || {};
      const fmtR = (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(Math.round(n||0));
      Object.entries(this._regionPanels || {}).forEach(([key, { impEl, bidsEl, svcEl }]) => {
        const reg = regions[key] || {};
        impEl.textContent  = reg.impressions ? fmtR(reg.impressions) : '—';
        bidsEl.textContent = reg.bids ? fmtR(reg.bids) + ' bids' : '';
        svcEl.textContent  = reg.campaigns ? reg.campaigns + ' svc' : '';
      });

      // Animated total overlay + leaderboard header
      const imp = (totals && totals.impressions) ? totals.impressions : 0;
      this._animateTotal(imp);

      if (this._lbHeaderTotal) {
        this._lbHeaderTotal.textContent = fmtImp(imp) + ' total impressions';
      }
    }

    _animateTotal(targetTotal) {
      if (!this._totalValueEl) return;
      // Cancel any in-progress animation before starting a new one
      if (this._totalAnimId) { cancelAnimationFrame(this._totalAnimId); this._totalAnimId = null; }
      const start    = this._displayedTotal;
      const end      = targetTotal;
      // Skip animation if value hasn't changed meaningfully (< 0.5% delta)
      // or if this is the first render (start=0 → just set immediately, no dramatic count-up)
      const delta = Math.abs(end - start);
      const threshold = Math.max(end * 0.005, 1000);
      if (delta < threshold || start === 0) {
        this._totalValueEl.textContent = fmtImp(end);
        this._displayedTotal = end;
        return;
      }
      const duration = 800;
      const t0       = performance.now();

      const tick = (now) => {
        const elapsed  = now - t0;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current  = Math.round(start + (end - start) * eased);
        if (this._totalValueEl) this._totalValueEl.textContent = fmtImp(current);
        if (progress < 1) {
          this._totalAnimId = requestAnimationFrame(tick);
        } else {
          this._totalAnimId    = null;
          this._displayedTotal = end;
        }
      };
      this._totalAnimId = requestAnimationFrame(tick);
    }

    destroy() {
      if (this._animId)      cancelAnimationFrame(this._animId);
      if (this._totalAnimId) cancelAnimationFrame(this._totalAnimId);
      this._animId      = null;
      this._totalAnimId = null;
      if (this._pulseId) { clearInterval(this._pulseId); this._pulseId = null; }
      if (this._visObs)  { this._visObs.disconnect(); this._visObs = null; }
      if (this._map) { this._map.remove(); this._map = null; }
    }
  }

  function mapboxUsaMap(container, config) {
    const instance = new MapboxUSAMap(container, config);
    return {
      update:  (data) => instance.update(data),
      destroy: ()     => instance.destroy(),
    };
  }

  return { MapboxUSAMap, mapboxUsaMap };
})();
