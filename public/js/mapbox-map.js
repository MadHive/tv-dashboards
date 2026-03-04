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
    northeast: [[-81, 36], [-66, 48]],
    southeast: [[-89, 24], [-75, 37]],
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
      this._pulseId    = null;
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

        this._map = new mapboxgl.Map({
          container:          this._wrap,
          style:              this._blankStyle(),
          bounds:             USA_BOUNDS,
          fitBoundsOptions:   { padding: 20 },
          interactive:        false,
          attributionControl: false,
        });

        this._map.on('load', () => {
          this._addSources();
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

    _addSources() {
      const US = window.US_STATES;
      if (!US) return;

      const stateFeatures = US.states.map(s => ({
        type: 'Feature',
        id:   s.id,
        properties: { id: s.id, intensity: 0, impressions: 0 },
        geometry:   { type: 'Polygon', coordinates: [s.path] },
      }));

      this._map.addSource('us-states', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: stateFeatures },
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
    }

    _empty() { return { type: 'FeatureCollection', features: [] }; }

    _addLayers() {
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
          'circle-color':   ['case', ['==', ['get', 'pt'], 'fast'], '#FDA4D4', '#67E8F9'],
          'circle-opacity': 0.10,
          'circle-blur':    0.9,
        },
      });

      this._map.addLayer({
        id: 'arc-particles', type: 'circle', source: 'arc-particles',
        paint: {
          'circle-radius':  ['get', 'sz'],
          'circle-color':   ['case', ['==', ['get', 'pt'], 'fast'], '#FDA4D4', '#67E8F9'],
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

      if (US) {
        const stateFeatures = US.states.map(s => {
          const st = states[s.id] || { impressions: 0 };
          return {
            type: 'Feature', id: s.id,
            properties: { id: s.id, intensity: st.impressions / maxImp, impressions: st.impressions },
            geometry:   { type: 'Polygon', coordinates: [s.path] },
          };
        });
        this._map.getSource('us-states')?.setData({ type: 'FeatureCollection', features: stateFeatures });
      }

      const hotFeatures = hotspots
        .filter(h => h.lat && h.lon)
        .map(h => ({
          type: 'Feature',
          properties: { ir: (h.impressions || 0) / maxHot },
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        }));
      this._map.getSource('hotspots')?.setData({ type: 'FeatureCollection', features: hotFeatures });

      this._buildCorridors(hotspots.slice(0, 30), maxHot);
      this._initParticles(hotspots.slice(0, 50));
      if (!this._animId) this._startAnimation();
      if (!this._pulseId) this._startPulse();

      const bounds = REGION_BOUNDS[data.region] || USA_BOUNDS;
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
      const targets = hotspots.length ? hotspots : [{ lon: -98, lat: 39 }];
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
              properties: { pt, sz },
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
      this._wrap.appendChild(lb);
    }

    _renderLeaderboard(states, maxImp, totals) {
      if (!this._lbScrollEl) return;

      const sorted = Object.entries(states)
        .filter(([, s]) => s.impressions > 0)
        .sort(([, a], [, b]) => b.impressions - a.impressions)
        .slice(0, 20);

      this._lbScrollEl.textContent = '';

      sorted.forEach(([id, s], i) => {
        const row = document.createElement('div');
        row.className = 'mgl-lb-row';

        const rank = document.createElement('span');
        rank.className = 'mgl-lb-rank';
        rank.textContent = i + 1;

        const state = document.createElement('span');
        state.className = 'mgl-lb-state';
        state.textContent = id;

        const barWrap = document.createElement('div');
        barWrap.className = 'mgl-lb-bar-wrap';
        const bar = document.createElement('div');
        bar.className = 'mgl-lb-bar';
        bar.style.width = Math.round((s.impressions / maxImp) * 100) + '%';
        barWrap.appendChild(bar);

        const val = document.createElement('span');
        val.className = 'mgl-lb-val';
        const n = s.impressions;
        val.textContent = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
                        : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K'
                        : String(n);

        row.appendChild(rank);
        row.appendChild(state);
        row.appendChild(barWrap);
        row.appendChild(val);
        this._lbScrollEl.appendChild(row);
      });

      if (totals && this._lbTotals) {
        const imp = totals.impressions || 0;
        const fmt = imp >= 1e9 ? (imp / 1e9).toFixed(1) + 'B'
                  : imp >= 1e6 ? (imp / 1e6).toFixed(1) + 'M'
                  : (imp / 1e3).toFixed(0) + 'K';
        this._lbTotals.textContent = fmt + ' total impressions';
      }
    }

    destroy() {
      if (this._animId) cancelAnimationFrame(this._animId);
      this._animId = null;
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
