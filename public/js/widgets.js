// ===========================================================================
// Widget renderers — each returns { update(data) }
// ===========================================================================

window.Widgets = (function () {
  'use strict';

  const C = window.Charts;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fmtNum(n) {
    if (n == null || n === '') return '—';
    if (typeof n === 'string') return n;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 10000)   return (n / 1000).toFixed(1) + 'K';
    if (Number.isInteger(n))    return n.toLocaleString();
    return String(n);
  }

  function trendArrow(t) {
    if (t === 'up')   return '\u25B2';
    if (t === 'down') return '\u25BC';
    return '\u25B8';
  }

  // ===========================================================================
  // BIG NUMBER
  // ===========================================================================
  function bigNumber(container, config) {
    const wrap    = el('div', 'big-number-wrap');
    const row     = el('div', 'big-number-row');
    const valEl   = el('span', 'big-number-value', '—');
    const unitEl  = el('span', 'big-number-unit', config.unit || '');
    const trendEl = el('span', 'big-number-trend stable', '\u25B8');
    row.append(valEl, unitEl, trendEl);
    wrap.appendChild(row);

    let sparkCanvas = null;
    if (config.sparkline) {
      sparkCanvas = el('canvas', 'big-number-sparkline');
      wrap.appendChild(sparkCanvas);
    }

    container.appendChild(wrap);

    return {
      update(data) {
        if (!data) return;
        valEl.textContent = fmtNum(data.value);
        if (data.suffix) unitEl.textContent = data.suffix;
        if (data.trend) {
          trendEl.textContent = trendArrow(data.trend);
          trendEl.className = 'big-number-trend ' + data.trend;
        }
        if (sparkCanvas && data.sparkline) {
          const color = config.thresholds
            ? C.thresholdColor(data.value, config.thresholds, config.invert)
            : '#00E5FF';
          C.sparkline(sparkCanvas, data.sparkline, color);
        }
      },
    };
  }

  // ===========================================================================
  // STAT CARD
  // ===========================================================================
  function statCard(container, config) {
    const wrap    = el('div', 'stat-card-wrap');
    const row     = el('div', 'big-number-row');
    const valEl   = el('span', 'stat-card-value', '—');
    const sufEl   = el('span', 'stat-card-suffix', config.unit || '');
    const trendEl = el('span', 'stat-card-trend stable', '');
    const detEl   = el('div', 'stat-card-detail');
    row.append(valEl, sufEl, trendEl);
    wrap.append(row, detEl);
    container.appendChild(wrap);

    return {
      update(data) {
        if (!data) return;
        if (typeof data.value === 'string') {
          valEl.textContent = data.value;
          // Scale font based on string length — short strings (49/49) get big text,
          // longer strings (12.4 TB) still get readable size
          const len = data.value.length;
          if (len <= 5) valEl.style.fontSize = '62px';
          else if (len <= 8) valEl.style.fontSize = '52px';
          else valEl.style.fontSize = '42px';
          if (data.status) {
            const clr = data.status === 'healthy' ? '#00E676' : '#FFB300';
            valEl.style.color = clr;
          }
        } else {
          valEl.textContent = fmtNum(data.value);
          if (config.thresholds) {
            valEl.style.color = C.thresholdColor(data.value, config.thresholds, config.invert);
          }
        }
        if (data.suffix) sufEl.textContent = data.suffix;
        if (data.trend) {
          trendEl.textContent = trendArrow(data.trend);
          trendEl.className = 'stat-card-trend ' + data.trend;
        }
        if (data.detail) detEl.textContent = data.detail;
      },
    };
  }

  // ===========================================================================
  // GAUGE
  // ===========================================================================
  function gaugeWidget(container, config) {
    const canvas = el('canvas', 'gauge-canvas');
    const naLabel = el('div', 'gauge-na');
    naLabel.textContent = '—';
    naLabel.style.display = 'none';
    container.appendChild(canvas);
    container.appendChild(naLabel);

    return {
      update(data) {
        if (!data) return;
        if (data.value == null) {
          canvas.style.display = 'none';
          naLabel.style.display = 'flex';
          return;
        }
        canvas.style.display = '';
        naLabel.style.display = 'none';
        C.gauge(
          canvas,
          data.value,
          config.min || 0,
          config.max || 100,
          config.thresholds,
          config.unit,
          config.invert,
        );
      },
    };
  }

  // ===========================================================================
  // GAUGE ROW (multiple small gauges)
  // ===========================================================================
  function gaugeRow(container, config) {
    const wrap = el('div', 'gauge-row-wrap');
    container.appendChild(wrap);
    let canvases = [];

    return {
      update(data) {
        if (!data || !data.gauges) return;

        // rebuild if count changed
        if (canvases.length !== data.gauges.length) {
          wrap.innerHTML = '';
          canvases = [];
          data.gauges.forEach(g => {
            const mini = el('div', 'mini-gauge');
            const cv   = el('canvas');
            cv.style.width  = '100%';
            cv.style.height = '70px';
            const lbl = el('div', 'mini-gauge-label', g.label);
            mini.append(cv, lbl);
            wrap.appendChild(mini);
            canvases.push(cv);
          });
        }

        data.gauges.forEach((g, i) => {
          C.gauge(
            canvases[i],
            g.value,
            config.min || 0,
            config.max || 100,
            config.thresholds,
            '',
            config.invert,
          );
        });
      },
    };
  }

  // ===========================================================================
  // BAR CHART (horizontal)
  // ===========================================================================
  function barChart(container, config) {
    const wrap = el('div', 'bar-chart-wrap');
    container.appendChild(wrap);
    let rows = [];

    return {
      update(data) {
        if (!data || !data.bars) return;
        const maxVal = Math.max(...data.bars.map(b => b.value));

        // rebuild rows if count changed
        if (rows.length !== data.bars.length) {
          wrap.innerHTML = '';
          rows = data.bars.map(b => {
            const row   = el('div', 'bar-row');
            const label = el('span', 'bar-label', b.label);
            const track = el('div', 'bar-track');
            const fill  = el('div', 'bar-fill');
            const value = el('span', 'bar-value');
            track.appendChild(fill);
            row.append(label, track, value);
            wrap.appendChild(row);
            return { fill, value };
          });
        }

        data.bars.forEach((b, i) => {
          const pct = (b.value / maxVal) * 100;
          rows[i].fill.style.width = pct + '%';
          rows[i].fill.style.background = b.color || '#00E5FF';
          rows[i].value.textContent = fmtNum(b.value);
        });
      },
    };
  }

  // ===========================================================================
  // PROGRESS BAR
  // ===========================================================================
  function progressBar(container, config) {
    const wrap  = el('div', 'progress-wrap');
    const valEl = el('div', 'progress-value', '—');
    const track = el('div', 'progress-track');
    const fill  = el('div', 'progress-fill');
    const label = el('div', 'progress-label');
    track.appendChild(fill);
    wrap.append(valEl, track, label);
    container.appendChild(wrap);

    return {
      update(data) {
        if (!data) return;
        valEl.textContent = data.value + '%';
        fill.style.width = Math.min(100, data.value) + '%';
        if (data.label) label.textContent = data.label;
      },
    };
  }

  // ===========================================================================
  // STATUS GRID
  // ===========================================================================
  function statusGrid(container, config) {
    const wrap = el('div', 'status-grid-wrap');
    container.appendChild(wrap);
    let cards = {};

    return {
      update(data) {
        if (!data || !data.services) return;

        // rebuild if needed
        if (Object.keys(cards).length !== data.services.length) {
          wrap.innerHTML = '';
          cards = {};
          data.services.forEach(svc => {
            const card = el('div', 'status-card ' + svc.status);

            const header = el('div', 'status-card-header');
            const name   = el('span', 'status-card-name', svc.name);
            const dot    = el('span', 'status-dot ' + svc.status);
            header.append(name, dot);

            const metrics = el('div', 'status-metrics');
            const rr  = metricLine('req/s',  fmtNum(svc.requestRate));
            const er  = metricLine('err%',   svc.errorRate.toFixed(2) + '%');
            const lat = metricLine('p50',    svc.latency + 'ms');
            const dep = metricLine('deploy', svc.lastDeploy);
            metrics.append(rr.el, er.el, lat.el, dep.el);

            card.append(header, metrics);
            wrap.appendChild(card);
            cards[svc.name] = { card, dot, rr, er, lat, dep };
          });
        } else {
          // update in place
          data.services.forEach(svc => {
            const c = cards[svc.name];
            if (!c) return;
            c.card.className = 'status-card ' + svc.status;
            c.dot.className  = 'status-dot '  + svc.status;
            c.rr.val.textContent  = fmtNum(svc.requestRate);
            c.er.val.textContent  = svc.errorRate.toFixed(2) + '%';
            c.lat.val.textContent = svc.latency + 'ms';
          });
        }
      },
    };
  }

  function metricLine(label, value) {
    const e   = el('div', 'status-metric');
    const lbl = el('span', 'status-metric-label', label);
    const val = el('span', 'status-metric-value', value);
    e.append(lbl, val);
    return { el: e, val };
  }

  // ===========================================================================
  // ALERT LIST
  // ===========================================================================
  function alertList(container, config) {
    const wrap = el('div', 'alert-list-wrap');
    container.appendChild(wrap);

    return {
      update(data) {
        if (!data || !data.alerts) return;
        wrap.innerHTML = '';
        data.alerts.forEach(a => {
          const item = el('div', 'alert-item ' + a.severity);
          const sev  = el('span', 'alert-sev', a.severity);
          const svc  = el('span', 'alert-svc', a.service);
          const msg  = el('span', 'alert-msg', a.message);
          const time = el('span', 'alert-time', a.time);
          item.append(sev, svc, msg, time);
          wrap.appendChild(item);
        });
      },
    };
  }

  // ===========================================================================
  // SERVICE HEATMAP — compact visual grid of all services
  // ===========================================================================
  function serviceHeatmap(container, config) {
    const wrap = el('div', 'heatmap-wrap');
    container.appendChild(wrap);
    let tiles = {};

    return {
      update(data) {
        if (!data || !data.services) return;

        if (Object.keys(tiles).length !== data.services.length) {
          wrap.innerHTML = '';
          tiles = {};
          data.services.forEach(svc => {
            const tile = el('div', 'heatmap-tile ' + svc.status);

            const name = el('div', 'heatmap-name', svc.name);
            const stats = el('div', 'heatmap-stats');
            const rr = el('span', 'heatmap-stat', fmtNum(svc.requestRate) + '/s');
            const lat = el('span', 'heatmap-stat heatmap-lat', svc.latency + 'ms');
            stats.append(rr, lat);

            const dot = el('div', 'heatmap-dot ' + svc.status);
            tile.append(dot, name, stats);
            wrap.appendChild(tile);
            tiles[svc.name] = { tile, dot, rr, lat };
          });
        } else {
          data.services.forEach(svc => {
            const t = tiles[svc.name];
            if (!t) return;
            t.tile.className = 'heatmap-tile ' + svc.status;
            t.dot.className = 'heatmap-dot ' + svc.status;
            t.rr.textContent = fmtNum(svc.requestRate) + '/s';
            t.lat.textContent = svc.latency + 'ms';
          });
        }
      },
    };
  }

  // ===========================================================================
  // PIPELINE FLOW
  // ===========================================================================
  function pipelineFlow(container, config) {
    const canvas = el('canvas', 'pipeline-canvas');
    container.appendChild(canvas);

    return {
      update(data) {
        if (!data || !data.stages) return;
        C.pipeline(canvas, data.stages, data.summary);
      },
    };
  }

  // ===========================================================================
  // USA MAP
  // ===========================================================================
  function usaMapWidget(container, config) {
    const canvas = el('canvas', 'usa-map-canvas');
    container.appendChild(canvas);

    return {
      update(data) {
        if (!data) return;
        C.usaMap(canvas, data);
      },
    };
  }

  // ===========================================================================
  // SECURITY SCORECARD — full-page VulnTrack overview
  // ===========================================================================
  function securityScorecard(container, config) {
    const canvas = el('canvas', 'security-canvas');
    container.appendChild(canvas);

    return {
      update(data) {
        if (!data) return;
        C.securityScorecard(canvas, data);
      },
    };
  }

  // ===========================================================================
  // Factory
  // ===========================================================================
  function create(type, container, config) {
    switch (type) {
      case 'big-number':     return bigNumber(container, config);
      case 'stat-card':      return statCard(container, config);
      case 'gauge':          return gaugeWidget(container, config);
      case 'gauge-row':      return gaugeRow(container, config);
      case 'bar-chart':      return barChart(container, config);
      case 'progress-bar':   return progressBar(container, config);
      case 'status-grid':    return statusGrid(container, config);
      case 'alert-list':     return alertList(container, config);
      case 'service-heatmap': return serviceHeatmap(container, config);
      case 'pipeline-flow':  return pipelineFlow(container, config);
      case 'usa-map':        return usaMapWidget(container, config);
      case 'security-scorecard': return securityScorecard(container, config);
      default:
        console.warn('[widgets] unknown type:', type);
        container.textContent = 'Unknown widget: ' + type;
        return { update() {} };
    }
  }

  return { create };
})();
