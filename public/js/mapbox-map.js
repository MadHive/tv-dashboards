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

  var REGION_BOUNDS = {
    northeast:  [[-81,  36], [-66, 48]],
    southeast:  [[-89,  24], [-75, 37]],
    northwest:  [[-125, 41], [-104, 49]],
    southwest:  [[-125, 31], [-104, 41]],
  };
  var USA_BOUNDS = [[-125, 24], [-66, 50]];

  // ── Config defaults + color schemes ──────────────────────────────────────

  var SCHEME_COLORS = {
    brand: { particleNormal: '#67E8F9', particleFast: '#FDA4D4', stateGlowHigh: '#FDA4D4' },
    cool:  { particleNormal: '#60A5FA', particleFast: '#FFFFFF', stateGlowHigh: '#e0f2fe' },
    warm:  { particleNormal: '#fbbf24', particleFast: '#FF6B35', stateGlowHigh: '#fef08a' },
  };

  function buildMapConfig(userConfig) {
    return {
      particleCount:   120,
      particleSpeed:   1.0,
      colorScheme:     'brand',
      showLeaderboard: true,
      mapStyle:        'mapbox',
      zoomViz:         'dots',
      ...(userConfig || {}),
    };
  }

  function getColorScheme(name) {
    return SCHEME_COLORS[name] || SCHEME_COLORS.brand;
  }

  var CHOROPLETH = [
    'interpolate', ['linear'], ['get', 'intensity'],
    0,    '#1a0840',
    0.15, '#3D1A5C',
    0.35, '#5b2a8f',
    0.60, '#7c3aed',
    0.85, '#b87aff',
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
      this._lbScrollEl = null;
      this._lbTotals   = null;

      this._wrap = document.createElement('div');
      this._wrap.className = 'mgl-container';
      container.appendChild(this._wrap);

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
          container:          this._wrap,
          style:              initialStyle,
          bounds:             USA_BOUNDS,
          fitBoundsOptions:   { padding: 20 },
          interactive:        false,
          attributionControl: false,
        });

        this._map.on('load', async () => {
          await this._addSources();
          this._addLayers();
          if (this._data) this._applyData(this._data);
        });
      } catch (err) {
        console.error('[MapboxUSAMap] init failed:', err);
      }
    }

    _blankStyle() {
      return {
        version: 8,
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

      // Boundary sources
      this._map.addSource('us-counties', {
        type: 'geojson',
        data: '/data/us-counties.json',
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
          'fill-opacity': 0.85,
          'fill-color-transition': { duration: 800 },
        },
      });

      this._map.addLayer({
        id: 'states-outline', type: 'line', source: 'us-states',
        paint: { 'line-color': '#6B5690', 'line-width': 0.8, 'line-opacity': 0.45 },
      });

      this._map.addLayer({
        id: 'states-glow', type: 'line', source: 'us-states',
        filter: ['>', ['get', 'intensity'], 0.45],
        paint: {
          'line-color':   ['interpolate', ['linear'], ['get', 'intensity'],
            0.45, '#7c3aed', 0.75, '#b87aff', 1.0, '#FDA4D4'],
          'line-width':   14,
          'line-blur':    10,
          'line-opacity': ['interpolate', ['linear'], ['get', 'intensity'],
            0.45, 0.1, 1.0, 0.45],
          'line-color-transition': { duration: 800 },
        },
      });

      this._map.addLayer({
        id: 'arc-corridors', type: 'line', source: 'arc-corridors',
        paint: {
          'line-color':   '#67E8F9',
          'line-width':   ['get', 'lw'],
          'line-opacity': ['get', 'lo'],
        },
      });

      this._map.addLayer({
        id: 'arc-particles-glow', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['*', ['get', 'sz'], 3.5],
          'circle-color': [
            'match', ['get', 'dc'],
            'us-west1',    '#67E8F9',
            'us-central1', '#b87aff',
            'us-east4',    '#FDA4D4',
            '#67E8F9',
          ],
          'circle-opacity': 0.10,
          'circle-blur':    0.9,
        },
      });

      this._map.addLayer({
        id: 'arc-particles', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['get', 'sz'],
          'circle-color': [
            'match', ['get', 'dc'],
            'us-west1',    '#67E8F9',   // West  — cyan
            'us-central1', '#b87aff',   // Central — violet
            'us-east4',    '#FDA4D4',   // East  — pink
            '#67E8F9',                   // fallback
          ],
          'circle-opacity': 0.9,
          'circle-blur':    0.2,
        },
      });

      this._map.addLayer({
        id: 'hotspots-glow', type: 'circle', source: 'hotspots',
        paint: {
          'circle-radius':  ['interpolate', ['linear'], ['get', 'ir'], 0, 8,  1, 40],
          'circle-color':   ['case', ['>', ['get', 'ir'], 0.4], '#FDA4D4', '#67E8F9'],
          'circle-opacity': ['interpolate', ['linear'], ['get', 'ir'], 0, 0.06, 1, 0.22],
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

      // City name labels on top 30 high-impression hotspots
      this._map.addLayer({
        id:     'hotspot-labels',
        type:   'symbol',
        source: 'hotspots',
        filter: ['<', ['get', 'rank'], 30],
        layout: {
          'text-field':         ['get', 'city'],
          'text-size':          9,
          'text-font':          ['DIN Pro Regular', 'Arial Unicode MS Regular'],
          'text-offset':        [0, 1.4],
          'text-anchor':        'top',
          'text-allow-overlap': false,
          'text-optional':      true,
        },
        paint: {
          'text-color':     'rgba(255,255,255,0.6)',
          'text-halo-color': 'rgba(14,3,32,0.5)',
          'text-halo-width': 1,
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
          return {
            ...f,
            properties: { ...f.properties, id: sid, intensity: st.impressions / maxImp, impressions: st.impressions },
          };
        });
        this._map.getSource('us-states')?.setData({ type: 'FeatureCollection', features: stateFeatures });
      }

      const hotFeatures = hotspots
        .filter(h => h.lat && h.lon)
        .map((h, i) => ({
          type: 'Feature',
          properties: {
            ir:   (h.impressions || 0) / maxHot,
            city: h.city || h.zip3 || '',
            rank: i,
          },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        }));
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

      this._buildCorridors(hotspots.slice(0, 30), maxHot);
      this._initParticles(hotspots.slice(0, 50));
      if (!this._animId) this._startAnimation();
      if (!this._pulseId) this._startPulse();

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
      this._map.fitBounds(bounds, { padding: 20, duration: 800 });

      this._renderLeaderboard(states, maxImp, data.totals);
    }

    _buildCorridors(hotspots, maxHot) {
      const features = [];
      hotspots.forEach(hs => {
        if (!hs.lat || !hs.lon) return;
        const dc = DATA_CENTERS.reduce((nearest, d) => {
          const dist = Math.hypot(hs.lon - d.lon, hs.lat - d.lat);
          return dist < Math.hypot(hs.lon - nearest.lon, hs.lat - nearest.lat) ? d : nearest;
        });
        const mx  = (dc.lon + hs.lon) / 2;
        const my  = (dc.lat + hs.lat) / 2 + Math.abs(dc.lat - hs.lat) * 0.3 + 2;
        const pts = [];
        for (let t = 0; t <= 1; t += 0.05) {
          const it = 1 - t;
          pts.push([
            it * it * dc.lon + 2 * it * t * mx + t * t * hs.lon,
            it * it * dc.lat + 2 * it * t * my + t * t * hs.lat,
          ]);
        }
        const ir = Math.sqrt((hs.impressions || 0) / maxHot);
        features.push({
          type: 'Feature',
          properties: { lw: 0.5 + ir * 1.5, lo: 0.04 + ir * 0.12 },
          geometry: { type: 'LineString', coordinates: pts },
        });
      });
      this._map.getSource('arc-corridors')?.setData({ type: 'FeatureCollection', features });
    }

    _initParticles(hotspots) {
      // Filter to continental US bounds — prevents particles targeting Hawaii/Alaska/Puerto Rico
      const conus = hotspots.filter(h =>
        h.lon && h.lat &&
        h.lon > -125 && h.lon < -66 &&
        h.lat >   24 && h.lat <  50
      );
      const targets = conus.length ? conus : [{ lon: -98, lat: 39 }];
      this._particles = Array.from({ length: this._cfg.particleCount }, () => {
        const dc  = DATA_CENTERS[Math.floor(Math.random() * DATA_CENTERS.length)];
        const tgt = targets[Math.floor(Math.random() * targets.length)];
        return {
          t:     Math.random(),
          speed: 0.003 + Math.random() * 0.006,
          dc, tgt,
          pt:    Math.random() > 0.7 ? 'fast' : 'normal',
          sz:    1.5 + Math.random() * 2,
        };
      });
    }

    _startAnimation() {
      const tick = () => {
        const isVisible = !!this._wrap?.closest?.('.dashboard-page.active');
        const delay = isVisible ? 16 : 500;

        if (this._map?.getSource('arc-particles')) {
          const features = this._particles.map(p => {
            p.t += p.speed * (p.pt === 'fast' ? 1.5 : 1) * this._cfg.particleSpeed;
            if (p.t > 1) {
              p.t = 0;
              const targets = this._data?.hotspots || [];
              if (targets.length) {
                p.tgt = targets[Math.floor(Math.random() * Math.min(50, targets.length))];
              }
            }
            const { dc, tgt, t, sz, pt } = p;
            const mx  = (dc.lon + tgt.lon) / 2;
            const my  = (dc.lat + tgt.lat) / 2 + Math.abs(dc.lat - tgt.lat) * 0.3 + 2;
            const it  = 1 - t;
            const lon = it * it * dc.lon + 2 * it * t * mx + t * t * tgt.lon;
            const lat = it * it * dc.lat + 2 * it * t * my + t * t * tgt.lat;
            return {
              type: 'Feature',
              properties: { pt, sz, dc: p.dc.id },
              geometry: { type: 'Point', coordinates: [lon, lat] },
            };
          });

          this._map.getSource('arc-particles').setData({
            type: 'FeatureCollection', features,
          });
        }

        setTimeout(() => {
          this._animId = requestAnimationFrame(tick);
        }, delay);
      };

      this._animId = requestAnimationFrame(tick);
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
        const z3Features = this._data.hotspots.filter(h => h.lat && h.lon).map((h, i) => ({
          type: 'Feature',
          properties: { ir: (h.impressions || 0) / maxHot, city: h.city || h.zip3 || '', rank: i },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        }));
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

    _buildLeaderboardDOM() {
      const lb = document.createElement('div');
      lb.className = 'mgl-leaderboard';

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
      this._wrap.appendChild(lb);

      // Leaderboard header total (above title)
      this._lbHeaderTotal = document.createElement('div');
      this._lbHeaderTotal.className   = 'mgl-lb-header-total';
      this._lbHeaderTotal.textContent = '\u2014';
      lb.insertBefore(this._lbHeaderTotal, lb.firstChild);

      // Bottom-left impressions total overlay
      const overlay = document.createElement('div');
      overlay.className = 'mgl-total-overlay';

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
      this._wrap.appendChild(overlay);
    }

    _renderLeaderboard(states, maxImp, totals) {
      if (!this._lbScrollEl) return;

      const sorted = Object.entries(states)
        .filter(([, s]) => s.impressions > 0)
        .sort(([, a], [, b]) => b.impressions - a.impressions)
        .slice(0, 20);

      const totalImp = sorted.reduce((sum, [, s]) => sum + (s.impressions || 0), 0) || 1;

      const fmt = (n) =>
        n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
        n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
        n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));

      // Build table
      this._lbScrollEl.textContent = '';
      const table = document.createElement('table');
      table.className = 'mgl-lb-table';

      // Header
      const thead = document.createElement('thead');
      const hrow  = document.createElement('tr');
      ['#', 'ST', 'Impr', '%'].forEach((label, i) => {
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

        const tr = document.createElement('tr');

        const tdRank = document.createElement('td');
        tdRank.className   = 'mgl-lb-rank-cell';
        tdRank.textContent = i + 1;

        const tdState = document.createElement('td');
        tdState.className   = 'mgl-lb-state-cell';
        tdState.textContent = stateId;

        const tdImp = document.createElement('td');
        tdImp.className   = 'mgl-lb-imp-cell';
        tdImp.textContent = fmt(s.impressions);

        const tdPct = document.createElement('td');
        tdPct.className   = 'mgl-lb-pct-cell';
        tdPct.textContent = pct + '%';

        tr.appendChild(tdRank);
        tr.appendChild(tdState);
        tr.appendChild(tdImp);
        tr.appendChild(tdPct);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      this._lbScrollEl.appendChild(table);

      // Animated total overlay + leaderboard header
      const imp = (totals && totals.impressions) ? totals.impressions : 0;
      this._animateTotal(imp);

      if (this._lbHeaderTotal) {
        this._lbHeaderTotal.textContent = fmt(imp) + ' total impressions';
      }
    }

    _animateTotal(targetTotal) {
      if (!this._totalValueEl) return;
      // Cancel any in-progress animation before starting a new one
      if (this._totalAnimId) { cancelAnimationFrame(this._totalAnimId); this._totalAnimId = null; }
      const start    = this._displayedTotal;
      const end      = targetTotal;
      const duration = 800;
      const t0       = performance.now();

      const fmt = (n) =>
        n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
        n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
        n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));

      const tick = (now) => {
        const elapsed  = now - t0;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current  = Math.round(start + (end - start) * eased);
        if (this._totalValueEl) this._totalValueEl.textContent = fmt(current);
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
