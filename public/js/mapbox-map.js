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
    brand:  {
      particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4',
      backgroundColor: '#0E0320',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#0d021e',
        0.10, '#1e0840',
        0.28, '#4c1d95',
        0.50, '#7c3aed',
        0.70, '#a855f7',
        0.88, '#e879f9',
        1.0,  '#FDA4D4',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#3D1A5C', 0.4, '#7c3aed', 0.7, '#FDA4D4', 1.0, '#FFFFFF'],
    },
    cool:   {
      particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe',
      backgroundColor: '#0a0e1a',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#0a0e1a',
        0.10, '#0f1729',
        0.28, '#1e3a8a',
        0.50, '#2563eb',
        0.70, '#60a5fa',
        0.88, '#93c5fd',
        1.0,  '#e0f2fe',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#1e3a8a', 0.4, '#2563eb', 0.7, '#60a5fa', 1.0, '#e0f2fe'],
    },
    warm:   {
      particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a',
      backgroundColor: '#1a0f05',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#1a0f05',
        0.10, '#2d1a0a',
        0.28, '#92400e',
        0.50, '#d97706',
        0.70, '#fbbf24',
        0.88, '#fcd34d',
        1.0,  '#fef08a',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#92400e', 0.4, '#d97706', 0.7, '#fbbf24', 1.0, '#fef08a'],
    },
    iheart: {
      particleNormal: '#FF6B8A', particleFast: '#FFAABB', stateGlowHigh: '#FFAABB',
      backgroundColor: '#0d0005',
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
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#6b001a', 0.4, '#C6002B', 0.7, '#FF4D6B', 1.0, '#FFAABB'],
    },
    fox: {
      particleNormal: '#F5A524', particleFast: '#FFD580', stateGlowHigh: '#FFD580',
      backgroundColor: '#000814',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#000814',
        0.10, '#001d3d',
        0.28, '#003566',
        0.50, '#0051a3',
        0.70, '#0066cc',
        0.88, '#FFB84D',
        1.0,  '#F5A524',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#003566', 0.4, '#0066cc', 0.7, '#FFB84D', 1.0, '#FFD580'],
    },
    hearst: {
      particleNormal: '#D4AF37', particleFast: '#F5D565', stateGlowHigh: '#F5D565',
      backgroundColor: '#0a0814',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#0a0814',
        0.10, '#14102a',
        0.28, '#2a2458',
        0.50, '#5a5090',
        0.70, '#8a70c0',
        0.88, '#E8C850',
        1.0,  '#D4AF37',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#2a2458', 0.4, '#8a70c0', 0.7, '#E8C850', 1.0, '#F5D565'],
    },
    nexstar: {
      particleNormal: '#00A8FF', particleFast: '#66D9FF', stateGlowHigh: '#66D9FF',
      backgroundColor: '#001018',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#001018',
        0.10, '#00182d',
        0.28, '#003d58',
        0.50, '#0073a8',
        0.70, '#0095d9',
        0.88, '#33C4FF',
        1.0,  '#00D9FF',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#003d58', 0.4, '#0095d9', 0.7, '#33C4FF', 1.0, '#66D9FF'],
    },
    scripps: {
      particleNormal: '#FF6B35', particleFast: '#FFA070', stateGlowHigh: '#FFA070',
      backgroundColor: '#140a00',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#140a00',
        0.10, '#2d1a0a',
        0.28, '#573300',
        0.50, '#a66000',
        0.70, '#d97706',
        0.88, '#FF8855',
        1.0,  '#FF6B35',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#573300', 0.4, '#d97706', 0.7, '#FF8855', 1.0, '#FFA070'],
    },
    cox: {
      particleNormal: '#00D9FF', particleFast: '#66F0FF', stateGlowHigh: '#66F0FF',
      backgroundColor: '#001820',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#001820',
        0.10, '#002838',
        0.28, '#00567d',
        0.50, '#0095d9',
        0.70, '#00B8FF',
        0.88, '#66E8FF',
        1.0,  '#00D9FF',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#00567d', 0.4, '#00B8FF', 0.7, '#66E8FF', 1.0, '#66F0FF'],
    },
    purple: {
      particleNormal: '#A78BFA', particleFast: '#DDD6FE', stateGlowHigh: '#DDD6FE',
      backgroundColor: '#1e0840',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#1e0840',
        0.10, '#3b0764',
        0.28, '#6b21a8',
        0.50, '#9333ea',
        0.70, '#a855f7',
        0.88, '#C4B5FD',
        1.0,  '#E9D5FF',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#6b21a8', 0.4, '#9333ea', 0.7, '#C4B5FD', 1.0, '#E9D5FF'],
    },
    green: {
      particleNormal: '#4ADE80', particleFast: '#86EFAC', stateGlowHigh: '#86EFAC',
      backgroundColor: '#052e16',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#052e16',
        0.10, '#14532d',
        0.28, '#166534',
        0.50, '#16a34a',
        0.70, '#22c55e',
        0.88, '#86EFAC',
        1.0,  '#BBF7D0',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#166534', 0.4, '#22c55e', 0.7, '#86EFAC', 1.0, '#BBF7D0'],
    },
    cyan: {
      particleNormal: '#22D3EE', particleFast: '#67E8F9', stateGlowHigh: '#67E8F9',
      backgroundColor: '#083344',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#083344',
        0.10, '#0e4c5c',
        0.28, '#155e75',
        0.50, '#0891b2',
        0.70, '#06b6d4',
        0.88, '#67E8F9',
        1.0,  '#A5F3FC',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#155e75', 0.4, '#06b6d4', 0.7, '#67E8F9', 1.0, '#A5F3FC'],
    },
    magenta: {
      particleNormal: '#F472B6', particleFast: '#FBCFE8', stateGlowHigh: '#FBCFE8',
      backgroundColor: '#500724',
      choropleth: [
        'interpolate', ['linear'], ['get', 'intensity'],
        0,    '#500724',
        0.10, '#831843',
        0.28, '#be185d',
        0.50, '#db2777',
        0.70, '#ec4899',
        0.88, '#F9A8D4',
        1.0,  '#FBCFE8',
      ],
      heatmap: ['interpolate', ['linear'], ['heatmap-density'],
        0, 'transparent', 0.2, '#be185d', 0.4, '#ec4899', 0.7, '#F9A8D4', 1.0, '#FBCFE8'],
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
      this._styleLoaded    = false;
      this._pendingConfigApply = false;
      // Persisted overlay positions (from mglConfig.overlayPositions)
      this._overlayPositions = Object.assign({}, (this._cfg && this._cfg.overlayPositions) || {});
      console.log('[MapGL] Loaded overlay positions from config:', this._overlayPositions);
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
          : this._blankStyle(this._cfg.colorScheme);
        this._currentStyle = this._cfg.mapStyle;

        // Use configured viewport if available, otherwise fit to USA bounds
        const mapOptions = {
          container:          this._mapDiv,
          style:              initialStyle,
          interactive:        true,
          attributionControl: false,
        };

        if (this._cfg.initialCenter && this._cfg.initialZoom) {
          // Use saved center and zoom directly
          mapOptions.center = [this._cfg.initialCenter.lng, this._cfg.initialCenter.lat];
          mapOptions.zoom = this._cfg.initialZoom;
          mapOptions.pitch = this._cfg.initialPitch || 0;
          mapOptions.bearing = this._cfg.initialBearing || 0;
        } else {
          // Fall back to USA bounds
          mapOptions.bounds = USA_BOUNDS;
          mapOptions.fitBoundsOptions = { padding: 20 };
          mapOptions.pitch = 0;
          mapOptions.bearing = 0;
        }

        this._map = new mapboxgl.Map(mapOptions);

        // Enable map interactions only in studio mode
        const isStudio = document.body.classList.contains('studio-body');

        if (isStudio) {
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
        } else {
          // On live TV view, disable all map interactions
          this._map.dragPan.disable();
          this._map.scrollZoom.disable();
          this._map.boxZoom.disable();
          this._map.doubleClickZoom.disable();
          this._map.keyboard.disable();
          this._map.dragRotate.disable();
          this._map.touchZoomRotate.disable();
        }

        this._map.on('load', async () => {
          await this._addSources();
          this._addLayers();
          this._styleLoaded = true;
          console.log('[MapGL] Style loaded, _styleLoaded =', this._styleLoaded);

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

          // Apply any pending config changes that came in before style was loaded
          if (this._pendingConfigApply) {
            console.log('[MapGL] Applying pending config changes after style load');
            this._pendingConfigApply = false;
            this._cfg = buildMapConfig(this._config.mglConfig);
            this._applyColorScheme(this._cfg.colorScheme);
            this._applyZoomViz(this._cfg.zoomViz);
            if (this._cfg.mapStyle !== this._currentStyle) {
              this._applyMapStyle(this._cfg.mapStyle);
            }
          }
        });

        // In Studio mode, capture viewport changes and sync to config + UI
        if (document.body.classList.contains('studio-body')) {
          let captureTimeout = null;
          const captureViewport = () => {
            clearTimeout(captureTimeout);
            // Debounce to avoid excessive updates during continuous movement
            captureTimeout = setTimeout(() => {
              const center = this._map.getCenter();
              const zoom = this._map.getZoom();
              const pitch = this._map.getPitch();
              const bearing = this._map.getBearing();

              // Update widget config
              if (!this._config.mglConfig) this._config.mglConfig = {};
              this._config.mglConfig.initialCenter = { lat: center.lat, lng: center.lng };
              this._config.mglConfig.initialZoom = zoom;
              this._config.mglConfig.initialPitch = pitch;
              this._config.mglConfig.initialBearing = bearing;

              // Update Studio UI inputs
              const latEl = document.getElementById('prop-mgl-center-lat');
              const lngEl = document.getElementById('prop-mgl-center-lng');
              const zoomEl = document.getElementById('prop-mgl-zoom');
              const zoomValEl = document.getElementById('prop-mgl-zoom-val');
              const pitchEl = document.getElementById('prop-mgl-pitch');
              const bearingEl = document.getElementById('prop-mgl-bearing');

              if (latEl) latEl.value = center.lat.toFixed(2);
              if (lngEl) lngEl.value = center.lng.toFixed(2);
              if (zoomEl) {
                zoomEl.value = zoom.toFixed(1);
                if (zoomValEl) zoomValEl.textContent = zoom.toFixed(1);
              }
              if (pitchEl) pitchEl.value = pitch.toFixed(0);
              if (bearingEl) bearingEl.value = bearing.toFixed(0);

              // Mark dashboard as dirty in Studio
              if (window.Studio) window.Studio.markDirty();
            }, 500);
          };

          this._map.on('moveend', captureViewport);
          this._map.on('zoomend', captureViewport);
          this._map.on('pitchend', captureViewport);
          this._map.on('rotateend', captureViewport);
        }

        // Viewport changes are now auto-captured in Studio mode (see event listeners above).
        // Values are debounced to avoid excessive updates during continuous movement.

        // Auto-recover from GPU/WebGL context loss (e.g. after long uptime)
        this._map.on('webglcontextlost', () => {
          console.warn('[MapboxUSAMap] WebGL context lost — reloading page to recover');
          setTimeout(() => location.reload(), 2000);
        });
      } catch (err) {
        console.error('[MapboxUSAMap] init failed:', err);
      }
    }

    _blankStyle(schemeName) {
      const scheme = getColorScheme(schemeName || this._cfg.colorScheme || 'brand');
      return {
        version: 8,
        glyphs:  'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        sources: {},
        layers:  [{ id: 'background', type: 'background', paint: { 'background-color': scheme.backgroundColor || '#0E0320' } }],
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
              intensity: intensity || 0,  // Ensure never null/NaN
              impressions: raw || 0,      // Ensure never null/NaN
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
            ir:      ((h.impressions || 0) / maxHot) || 0,  // Ensure never null/NaN
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
            properties: { ir: ((h.impressions || 0) / maxZ5) || 0 },  // Ensure never null/NaN
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
      // If initialZoom is configured, respect it and don't auto-fit bounds
      const hasConfiguredView = this._cfg.initialZoom !== null && this._cfg.initialZoom !== undefined;
      if (!hasConfiguredView && boundsKey !== this._lastBounds) {
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
        const ir = Math.sqrt((hs.impressions || 0) / maxHot) || 0;  // Ensure never null/NaN
        // Store for particle alignment — particles pick from this same set
        this._corridorPaths.push({ dc, tgt: hs, ir });
        features.push({
          type: 'Feature',
          properties: {
            lw: +(0.5 + ir * 1.5).toFixed(3) || 0.5,   // exact canvas: 0.5 + impRatio*1.5 (0.5→2px)
            lo: +(0.04 + ir * 0.12).toFixed(3) || 0.04,  // exact canvas: 0.04 + impRatio*0.12
            ir: +ir.toFixed(3) || 0,
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
                  pt,
                  sz: ss || 0,
                  dc: p.dc.id,
                  ir: +(ir * (1 - seg / trailSegs)).toFixed(3) || 0,
                  fa: fa || 0,
                  ga: ga || 0,
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
        if (this._overlayPositions && this._overlayPositions[key]) {
          console.log(`[MapGL] Skipping auto-position for ${key} - has saved position:`, this._overlayPositions[key]);
          return;
        }

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
        console.log(`[MapGL] Auto-positioned ${key} at ${x}px, ${y}px`);
      });
    }

    _applyOverlayPosition(el, key) {
      const pos = this._overlayPositions && this._overlayPositions[key];
      if (!pos) {
        console.log(`[MapGL] No saved position for ${key}`);
        return;
      }

      const cr = this._wrap.getBoundingClientRect();
      console.log(`[MapGL] Applying position for ${key}:`, pos, `Container:`, cr.width, 'x', cr.height);

      // Convert percentage-based positions back to pixels for current resolution
      if (pos.top && pos.top.endsWith('%')) {
        const topPercent = parseFloat(pos.top);
        if (!isNaN(topPercent)) {
          const topPx = (topPercent / 100 * cr.height);
          el.style.top = topPx + 'px';
          console.log(`[MapGL] Set ${key} top: ${topPercent}% → ${topPx}px`);
        } else {
          console.warn(`[MapGL] Invalid top percentage for ${key}:`, pos.top);
          delete this._overlayPositions[key].top; // Clean up bad data
        }
      } else if (pos.top) {
        el.style.top = pos.top;
        console.log(`[MapGL] Set ${key} top: ${pos.top} (pixel value)`);
      }

      if (pos.left && pos.left.endsWith('%')) {
        const leftPercent = parseFloat(pos.left);
        if (!isNaN(leftPercent)) {
          const leftPx = (leftPercent / 100 * cr.width);
          el.style.left = leftPx + 'px';
          console.log(`[MapGL] Set ${key} left: ${leftPercent}% → ${leftPx}px`);
        } else {
          console.warn(`[MapGL] Invalid left percentage for ${key}:`, pos.left);
          delete this._overlayPositions[key].left; // Clean up bad data
        }
      } else if (pos.left) {
        el.style.left = pos.left;
        console.log(`[MapGL] Set ${key} left: ${pos.left} (pixel value)`);
      }

      el.style.right  = 'auto';
      el.style.bottom = 'auto';

      // Convert percentage-based sizes back to pixels for current resolution
      if (pos.width && pos.width.endsWith('%')) {
        const cr = this._wrap.getBoundingClientRect();
        const widthPercent = parseFloat(pos.width);
        if (!isNaN(widthPercent) && widthPercent > 0) {
          const widthPx = (widthPercent / 100 * cr.width) + 'px';
          el.style.width = widthPx;
          this._applyOverlayScale(el, key, widthPx);
        } else {
          console.warn(`[MapGL] Invalid width percentage for ${key}:`, pos.width);
          delete this._overlayPositions[key].width;
        }
      } else if (pos.width) {
        el.style.width = pos.width;
        this._applyOverlayScale(el, key, pos.width);
      } else if (key === 'leaderboard' && !el.style.width) {
        el.style.width = '340px';
      } else if (key === 'totalOverlay' && !el.style.width) {
        el.style.width = '350px';
      }

      if (pos.height && pos.height.endsWith('%')) {
        const cr = this._wrap.getBoundingClientRect();
        const heightPercent = parseFloat(pos.height);
        if (!isNaN(heightPercent) && heightPercent > 0) {
          el.style.height = (heightPercent / 100 * cr.height) + 'px';
        } else {
          console.warn(`[MapGL] Invalid height percentage for ${key}:`, pos.height);
          delete this._overlayPositions[key].height;
        }
      } else if (pos.height) {
        el.style.height = pos.height;
      }
    }

    _saveOverlayPosition(key, el) {
      if (!this._overlayPositions) this._overlayPositions = {};
      if (!this._overlayPositions[key]) this._overlayPositions[key] = {};

      // Save positions as percentages for resolution independence
      const cr = this._wrap.getBoundingClientRect();

      // Validate container has dimensions
      if (!cr.width || !cr.height) {
        console.warn(`[MapGL] Cannot save position for ${key} - container has no dimensions`, cr);
        return;
      }

      const topPx = parseFloat(el.style.top);
      const leftPx = parseFloat(el.style.left);

      // Only save if we have valid numeric positions
      if (isNaN(topPx) || isNaN(leftPx)) {
        console.warn(`[MapGL] Cannot save position for ${key} - invalid position values`, el.style.top, el.style.left);
        return;
      }

      // Merge position into existing object to preserve width/height
      this._overlayPositions[key].top = ((topPx / cr.height) * 100).toFixed(2) + '%';
      this._overlayPositions[key].left = ((leftPx / cr.width) * 100).toFixed(2) + '%';

      console.log(`[MapGL] Saved position for ${key}:`, this._overlayPositions[key], `(from ${topPx}px, ${leftPx}px in ${cr.width}x${cr.height} container)`);
    }

    _updateAlignmentGuides(currentKey, x, y, width, height) {
      if (!this._alignmentGuides) return;

      const SNAP_THRESHOLD = 10; // px - show guide if within this distance
      let alignedHorizontally = false;
      let alignedVertically = false;
      let alignY = null;
      let alignX = null;

      // Check alignment with other regional panels
      const regions = ['west', 'central', 'east'];
      regions.forEach(key => {
        if (key === currentKey) return; // Skip self
        const panel = this._regionPanels?.[key]?.panel;
        if (!panel || !panel.style.left || !panel.style.top) return;

        const otherX = parseFloat(panel.style.left);
        const otherY = parseFloat(panel.style.top);

        // Check vertical alignment (same top position)
        if (!isNaN(otherY) && Math.abs(y - otherY) < SNAP_THRESHOLD) {
          alignedHorizontally = true;
          alignY = y;
        }

        // Check horizontal alignment (same left position)
        if (!isNaN(otherX) && Math.abs(x - otherX) < SNAP_THRESHOLD) {
          alignedVertically = true;
          alignX = x;
        }
      });

      // Show/hide horizontal guide
      if (alignedHorizontally && alignY !== null) {
        this._alignmentGuides.horizontal.style.top = alignY + 'px';
        this._alignmentGuides.horizontal.classList.add('visible');
      } else {
        this._alignmentGuides.horizontal.classList.remove('visible');
      }

      // Show/hide vertical guide
      if (alignedVertically && alignX !== null) {
        this._alignmentGuides.vertical.style.left = alignX + 'px';
        this._alignmentGuides.vertical.classList.add('visible');
      } else {
        this._alignmentGuides.vertical.classList.remove('visible');
      }
    }

    _hideAlignmentGuides() {
      if (!this._alignmentGuides) return;
      this._alignmentGuides.horizontal.classList.remove('visible');
      this._alignmentGuides.vertical.classList.remove('visible');
    }

    _saveOverlaySize(key, el) {
      if (!this._overlayPositions) this._overlayPositions = {};
      if (!this._overlayPositions[key]) this._overlayPositions[key] = {};
      const pos = this._overlayPositions[key];

      // Save sizes as percentages for resolution independence
      const cr = this._wrap.getBoundingClientRect();

      if (el.style.width) {
        const widthPx = parseFloat(el.style.width);
        if (!isNaN(widthPx) && widthPx > 0) {
          pos.width = ((widthPx / cr.width) * 100).toFixed(2) + '%';
        } else {
          delete pos.width;
        }
      } else {
        delete pos.width;
      }

      if (el.style.height) {
        const heightPx = parseFloat(el.style.height);
        if (!isNaN(heightPx) && heightPx > 0) {
          pos.height = ((heightPx / cr.height) * 100).toFixed(2) + '%';
        } else {
          delete pos.height;
        }
      } else {
        delete pos.height;
      }
    }

    _addResizeHandles(el, key) {
      if (!document.body.classList.contains('studio-body')) return;
      // Resize handle element — purely visual; interaction is handled by _makeInteractive
      const handle = document.createElement('div');
      handle.className = 'mgl-resize-se';
      handle.style.pointerEvents = 'none'; // parent overlay handles all events
      el.appendChild(handle);
    }

    // Inject a "Match Size" button on region panels in studio mode
    // Clicking it syncs all region panel sizes to match this one
    _addMatchSizeBtn(el, key) {
      if (!document.body.classList.contains('studio-body')) return;
      if (key !== 'west' && key !== 'central' && key !== 'east') return;
      const self = this;
      const btn = document.createElement('button');
      btn.className   = 'mgl-overlay-match-btn';
      btn.type        = 'button';
      btn.textContent = '⊞'; // ⊞ (uniform size icon)
      btn.title       = 'Match all region panel sizes to this one';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        const w = el.style.width;
        const h = el.style.height;
        // Apply to all region panels
        ['west', 'central', 'east'].forEach(regionKey => {
          const panel = self._regionPanels[regionKey]?.panel;
          if (panel && regionKey !== key) {
            panel.style.width = w;
            panel.style.height = h;
            self._applyOverlayScale(panel, regionKey, w);
            self._saveOverlaySize(regionKey, panel);
          }
        });
        // Fire event to persist
        self._wrap.dispatchEvent(new CustomEvent('mgl-overlay-moved', {
          bubbles: true,
          detail: { positions: Object.assign({}, self._overlayPositions) },
        }));
      });
      el.appendChild(btn);
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
      return { leaderboard: 340, totalOverlay: 350, west: 160, central: 160, east: 160, clientLogo: 120 };
    }

    _applyOverlayScale(el, key, widthPx) {
      if (!widthPx) return;
      const nat = this._overlayNaturalWidths()[key];
      if (!nat) return;
      const nw = parseFloat(widthPx);
      if (isNaN(nw) || nw <= 0) return;
      const scale = Math.max(0.3, Math.min(3.0, nw / nat));

      if (key === 'totalOverlay') {
        const inner = el.querySelector('.mgl-total-overlay-inner');
        const v = el.querySelector('.mgl-total-value');
        const l = el.querySelector('.mgl-total-label');
        const s = el.querySelector('.mgl-total-sub');
        if (v) v.style.fontSize = Math.round(100 * scale) + 'px';
        if (l) l.style.fontSize = Math.round(20 * scale) + 'px';
        if (s) s.style.fontSize = Math.round(20 * scale) + 'px';
        // Scale gap between elements (on inner flex container)
        if (inner) inner.style.gap = Math.round(2 * scale) + 'px';
      } else if (key === 'leaderboard') {
        this._lbScale = Math.max(0.4, Math.min(2.5, scale));
        const t = el.querySelector('.mgl-lb-title');
        const h = el.querySelector('.mgl-lb-header-total');
        if (t) {
          t.style.fontSize = Math.round(17 * this._lbScale) + 'px';
          t.style.padding = `0 ${Math.round(8 * this._lbScale)}px ${Math.round(8 * this._lbScale)}px`;
        }
        if (h) {
          h.style.fontSize = Math.round(17 * this._lbScale) + 'px';
          h.style.padding = `0 ${Math.round(8 * this._lbScale)}px ${Math.round(8 * this._lbScale)}px`;
        }
        // Scale gap between elements
        el.style.gap = Math.round(8 * this._lbScale) + 'px';
        // Scale totals banner if it exists
        if (this._lbTotals) {
          this._lbTotals.style.fontSize = Math.round(18 * this._lbScale) + 'px';
          this._lbTotals.style.paddingTop = Math.round(4 * this._lbScale) + 'px';
        }
        // Re-render rows at new scale if data is available
        if (this._data && this._data.states) {
          this._renderLeaderboard(this._data.states, 1, this._data.totals || {});
        }
      } else if (key === 'west' || key === 'central' || key === 'east') {
        const imp  = el.querySelector('.mgl-region-impressions');
        const name = el.querySelector('.mgl-region-name');
        const meta = el.querySelector('.mgl-region-meta');
        if (imp)  imp.style.fontSize  = Math.round(40 * scale) + 'px';
        if (name) {
          name.style.fontSize = Math.round(16 * scale) + 'px';
          name.style.marginBottom = Math.round(6 * scale) + 'px';
        }
        if (meta) {
          meta.style.fontSize = Math.round(13 * scale) + 'px';
          meta.style.marginTop = Math.round(8 * scale) + 'px';
          meta.style.gap = Math.round(12 * scale) + 'px';
        }

        // Scale padding, border, border-radius for region panels
        el.style.padding = `${Math.round(14 * scale)}px ${Math.round(18 * scale)}px`;
        el.style.borderWidth = Math.max(1, Math.round(1 * scale)) + 'px';
        el.style.borderRadius = Math.round(10 * scale) + 'px';

        // Scale the gradient bar at top
        el.style.setProperty('--top-bar-height', Math.round(4 * scale) + 'px');
      } else if (key === 'clientLogo') {
        // Scale padding and border-radius for logo container
        el.style.padding = `${Math.round(4 * scale)}px ${Math.round(6 * scale)}px`;
        el.style.borderRadius = Math.round(6 * scale) + 'px';
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

          // Show alignment guides when aligned with other overlays
          self._updateAlignmentGuides(key, nx, ny, er.width, er.height);
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
          // Apply text scaling during resize so text doesn't spill out
          self._applyOverlayScale(el, key, nw + 'px');
        }
      });

      el.addEventListener('pointerup', function (e) {
        el.releasePointerCapture(e.pointerId);
        // Hide snap grid guide and alignment guides
        if (self._snapGridEl) self._snapGridEl.classList.remove('visible');
        self._hideAlignmentGuides();
        if (mode === 'drag') {
          el.style.cursor = 'grab';
          self._saveOverlayPosition(key, el);
        } else {
          el.style.cursor = 'grab';
          self._applyOverlayScale(el, key, el.style.width); // scale text only on release
          self._saveOverlayPosition(key, el); // Save position in case element moved
          self._saveOverlaySize(key, el);      // Save new width and height
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
              const ir    = ((h.impressions || 0) / maxHot) || 0;  // Ensure never null/NaN
              const baseR = 3 + ir * 14;
              return {
                type: 'Feature',
                properties: {
                  pr: (baseR + phase * 22) || 0,
                  po: ((1 - phase) * 0.38 * ir) || 0,
                  ir: ir || 0
                },
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
            properties: {
              pr: (8 + phase * 28) || 0,
              po: ((1 - phase) * 0.65) || 0
            },
            geometry: { type: 'Point', coordinates: [dc.lon, dc.lat] },
          };
        });
        this._map.getSource('datacenter-pulse')?.setData({ type: 'FeatureCollection', features: dcFeatures });
      }, 150);
    }

    _applyColorScheme(schemeName) {
      console.log('[MapGL] _applyColorScheme called with:', schemeName);
      if (!this._map || !this._styleLoaded) {
        console.log('[MapGL] Map or style not loaded in _applyColorScheme');
        return;
      }
      const s = getColorScheme(schemeName);
      console.log('[MapGL] Got color scheme:', s);

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

      if (this._map.getLayer('hotspot-labels')) {
        // Convert hex to rgba (Mapbox doesn't accept 8-digit hex for text-color)
        const hexToRgba = (hex, alpha) => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        this._map.setPaintProperty('hotspot-labels', 'text-color', hexToRgba(s.particleNormal, 0.67));
      }

      if (this._map.getLayer('states-fill')) {
        this._map.setPaintProperty('states-fill', 'fill-color', s.choropleth || CHOROPLETH);
      }

      if (this._map.getLayer('delivery-heatmap')) {
        this._map.setPaintProperty('delivery-heatmap', 'heatmap-color', s.heatmap || [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'transparent', 0.2, '#3D1A5C', 0.4, '#7c3aed', 0.7, '#FDA4D4', 1.0, '#FFFFFF']);
      }

      // Update background color for brand-style maps
      if (this._map.getLayer('background')) {
        this._map.setPaintProperty('background', 'background-color', s.backgroundColor || '#0E0320');
      }

      // Apply theme colors to overlays
      this._applyOverlayColors(schemeName);
    }

    _applyOverlayColors(schemeName) {
      // Get theme colors if Themes system is available
      let theme = null;
      if (window.Themes && window.Themes.getTheme) {
        theme = window.Themes.getTheme(schemeName);
      }

      if (!theme) return; // No theme available, use CSS defaults

      const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };

      // Apply theme colors to region panels
      Object.values(this._regionPanels || {}).forEach(({ panel }) => {
        if (panel) {
          panel.style.setProperty('--overlay-bg', hexToRgba(theme.bgCard, 0.90));
          panel.style.setProperty('--overlay-border', hexToRgba(theme.accent, 0.5));
          panel.style.setProperty('--overlay-text', theme.text1);
          panel.style.setProperty('--overlay-text-dim', hexToRgba(theme.text2, 0.75));
          panel.style.setProperty('--overlay-accent', theme.accent);
        }
      });

      // Apply to leaderboard
      if (this._lbEl) {
        this._lbEl.style.setProperty('--overlay-bg', hexToRgba(theme.bgCard, 0.85));
        this._lbEl.style.setProperty('--overlay-border', hexToRgba(theme.accent, 0.2));
        this._lbEl.style.setProperty('--overlay-text', theme.text1);
        this._lbEl.style.setProperty('--overlay-text-dim', hexToRgba(theme.text2, 0.6));
        this._lbEl.style.setProperty('--overlay-accent', hexToRgba(theme.accent, 0.7));
      }

      // Apply to total overlay
      const totalOverlay = this._wrap?.querySelector('.mgl-total-overlay');
      if (totalOverlay) {
        totalOverlay.style.setProperty('--overlay-bg', theme.bgCard);
        totalOverlay.style.setProperty('--overlay-border', theme.accent);
        totalOverlay.style.setProperty('--overlay-text', theme.text1);
        totalOverlay.style.setProperty('--overlay-text-dim', hexToRgba(theme.text2, 0.6));
        totalOverlay.style.setProperty('--overlay-accent', hexToRgba(theme.accent, 0.7));
      }

      // Apply to client logo overlay
      const clientLogo = this._wrap?.querySelector('.mgl-client-logo');
      if (clientLogo) {
        clientLogo.style.setProperty('--overlay-border', theme.accent);
      }
    }

    _applyZoomViz(mode) {
      if (!this._map || !this._styleLoaded) return;
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
          properties: {
            ir: ((h.impressions || 0) / maxHot) || 0,  // Ensure never null/NaN
            city: cityName,
            imp_fmt: cityName ? fmtImp(h.impressions || 0) : '',
            rank: i
          },
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
        : this._blankStyle(this._cfg.colorScheme);

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

        // ── Alignment guide lines ────────────────────────────────────────────
        this._alignmentGuides = {
          horizontal: document.createElement('div'),
          vertical: document.createElement('div')
        };
        this._alignmentGuides.horizontal.className = 'mgl-alignment-guide horizontal';
        this._alignmentGuides.vertical.className = 'mgl-alignment-guide vertical';
        this._wrap.appendChild(this._alignmentGuides.horizontal);
        this._wrap.appendChild(this._alignmentGuides.vertical);
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
        this._addMatchSizeBtn(panel, key);
        this._addOverlayHideBtn(panel, cfgFlag);
        this._wrap.appendChild(panel);
        // Defer positioning until container has dimensions
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this._applyOverlayPosition(panel, key);
          });
        });
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
      // Defer positioning until container has dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._applyOverlayPosition(lb, 'leaderboard');
        });
      });
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
        // Defer positioning until container has dimensions
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this._applyOverlayPosition(logoWrap, 'clientLogo');
          });
        });
        this._makeDraggable(logoWrap, 'clientLogo');
        this._addResizeHandles(logoWrap, 'clientLogo');
      }

      // Bottom-left impressions total overlay
      const overlay = document.createElement('div');
      overlay.className = 'mgl-total-overlay';

      // Respect showTotalOverlay flag
      if (this._cfg.showTotalOverlay === false) overlay.style.display = 'none';

      // Inner wrapper to clip content while allowing resize handle to extend outside
      const inner = document.createElement('div');
      inner.className = 'mgl-total-overlay-inner';

      const lbl = document.createElement('div');
      lbl.className   = 'mgl-total-label';
      lbl.textContent = '\u2B23 LIVE DELIVERY';

      this._totalValueEl = document.createElement('div');
      this._totalValueEl.className   = 'mgl-total-value';
      this._totalValueEl.textContent = '\u2014';

      const sub = document.createElement('div');
      sub.className   = 'mgl-total-sub';
      sub.textContent = 'impressions right now';

      inner.appendChild(lbl);
      inner.appendChild(this._totalValueEl);
      inner.appendChild(sub);
      overlay.appendChild(inner);
      this._addOverlayHideBtn(overlay, 'showTotalOverlay');
      this._wrap.appendChild(overlay);
      // Defer positioning until container has dimensions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._applyOverlayPosition(overlay, 'totalOverlay');
        });
      });
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
        // Apply leaderboard scale to header text if box has been resized
        if (this._lbScale && this._lbScale !== 1) {
          th.style.fontSize = Math.round(13 * this._lbScale) + 'px';
          th.style.padding = `${Math.round(5 * this._lbScale)}px ${Math.round(8 * this._lbScale)}px`;
        }
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

        // Apply leaderboard scale to row text and spacing if box has been resized
        if (this._lbScale && this._lbScale !== 1) {
          const fs = Math.round(18 * this._lbScale) + 'px';
          const pad = `${Math.round(7 * this._lbScale)}px ${Math.round(8 * this._lbScale)}px`;
          tdRank.style.fontSize  = fs;
          tdRank.style.padding   = pad;
          tdState.style.fontSize = fs;
          tdState.style.padding  = pad;
          tdImp.style.fontSize   = fs;
          tdImp.style.padding    = pad;
          // Scale border thickness
          tr.style.borderLeftWidth = Math.max(2, Math.round(3 * this._lbScale)) + 'px';
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

        // Apply scale to percentage cell
        if (this._lbScale && this._lbScale !== 1) {
          tdPct.style.fontSize = Math.round(15 * this._lbScale) + 'px';
          tdPct.style.padding = `${Math.round(7 * this._lbScale)}px ${Math.round(8 * this._lbScale)}px`;
          barWrap.style.height = Math.round(4 * this._lbScale) + 'px';
          barWrap.style.borderRadius = Math.round(2 * this._lbScale) + 'px';
          barWrap.style.marginBottom = Math.round(3 * this._lbScale) + 'px';
        }

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
      // Studio-only: apply config changes immediately without waiting for data update
      applyConfigChanges: () => {
        console.log('[MapGL] applyConfigChanges called');
        console.log('[MapGL] Map loaded?', !!instance._map, 'Style loaded?', instance._styleLoaded);
        console.log('[MapGL] instance._config.mglConfig:', instance._config.mglConfig);
        if (!instance._map || !instance._styleLoaded) {
          console.log('[MapGL] Style not loaded yet, marking pending');
          instance._pendingConfigApply = true;
          return;
        }
        instance._cfg = buildMapConfig(instance._config.mglConfig);
        console.log('[MapGL] Built config, colorScheme:', instance._cfg.colorScheme);
        instance._applyColorScheme(instance._cfg.colorScheme);
        instance._applyZoomViz(instance._cfg.zoomViz);
        if (instance._cfg.mapStyle !== instance._currentStyle) {
          instance._applyMapStyle(instance._cfg.mapStyle);
        }
      },
    };
  }

  return { mapboxUsaMap };
})();
