// ===========================================================================
// Canvas-based chart renderers — MadHive brand colors
// Sparklines, gauges, bar charts, pipeline flow, USA map
// V2: Visual overhaul with info-dense map & rich pipeline
// ===========================================================================

window.Charts = (function () {
  'use strict';

  // ── MadHive brand palette for canvas ──
  const BRAND = {
    pink:     '#FDA4D4',
    hotPink:  '#FF9BD3',
    deep:     '#200847',
    violet:   '#3D1A5C',
    surface:  '#1A0B38',
    border:   '#2E1860',
    text1:    '#F3F2EB',
    text2:    '#B8A8D0',
    text3:    '#6B5690',
    green:    '#4ADE80',
    amber:    '#FBBF24',
    red:      '#FB7185',
    cyan:     '#67E8F9',
  };

  // ── DPI-aware canvas setup ──
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function thresholdColor(value, thresholds, invert) {
    if (!thresholds) return BRAND.pink;
    const { warning, critical } = thresholds;
    if (invert) {
      if (value <= critical) return BRAND.red;
      if (value <= warning)  return BRAND.amber;
      return BRAND.green;
    }
    if (value >= critical) return BRAND.red;
    if (value >= warning)  return BRAND.amber;
    return BRAND.green;
  }

  // ===========================================================================
  // SPARKLINE
  // ===========================================================================
  function sparkline(canvas, data, color) {
    if (!data || data.length < 2) return;
    const { ctx, w, h } = setup(canvas);
    const c = color || BRAND.pink;
    const pad = 4;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    function xOf(i) { return pad + (i / (data.length - 1)) * (w - pad * 2); }
    function yOf(v) { return h - pad - ((v - min) / range) * (h - pad * 2); }

    ctx.clearRect(0, 0, w, h);

    // gradient fill
    ctx.beginPath();
    ctx.moveTo(xOf(0), h);
    data.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
    ctx.lineTo(xOf(data.length - 1), h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexToRgba(c, 0.30));
    grad.addColorStop(1, hexToRgba(c, 0));
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    data.forEach((v, i) => {
      if (i === 0) ctx.moveTo(xOf(i), yOf(v));
      else ctx.lineTo(xOf(i), yOf(v));
    });
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // last-point glow
    const lx = xOf(data.length - 1);
    const ly = yOf(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx, ly, 9, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(c, 0.25);
    ctx.fill();
  }

  // ===========================================================================
  // GAUGE — semicircular arc, bigger text
  // ===========================================================================
  function gauge(canvas, value, min, max, thresholds, unit, invert) {
    const { ctx, w, h } = setup(canvas);
    const cx = w / 2;
    const cy = h * 0.62;
    const radius = Math.min(w * 0.42, h * 0.48);
    const lineW = Math.max(10, radius * 0.18);

    const startAngle = Math.PI * 0.78;
    const endAngle   = Math.PI * 0.22;
    const totalArc   = (Math.PI * 2) - (startAngle - endAngle);

    ctx.clearRect(0, 0, w, h);

    // bg arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, Math.PI * 2 + endAngle);
    ctx.strokeStyle = BRAND.border;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.stroke();

    // value arc
    const ratio = Math.min(1, Math.max(0, (value - min) / ((max - min) || 1)));
    const valAngle = startAngle + ratio * totalArc;
    const c = thresholdColor(value, thresholds, invert);

    ctx.save();
    ctx.shadowColor = c;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valAngle);
    ctx.strokeStyle = c;
    ctx.lineWidth = lineW * 0.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valAngle);
    ctx.strokeStyle = c;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(20, radius * 0.55);
    ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = BRAND.text1;

    const display = value >= 100 ? Math.round(value) : (Number.isInteger(value) ? value : value.toFixed(1));
    ctx.fillText(display, cx, cy - 2);

    if (unit) {
      ctx.font = `500 ${Math.max(12, radius * 0.22)}px 'DM Sans', sans-serif`;
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(unit, cx, cy + fontSize * 0.55);
    }
  }

  // ===========================================================================
  // PIPELINE FLOW V2 — 6 stages, sparklines, sub-metrics, health rings,
  // throughput-proportional lines, summary header, cumulative flow
  // ===========================================================================
  let pipelineParticles = [];
  let pipelineAnimId = null;
  let pipelineCumulativeHistory = []; // [{tick, stages: [throughput...]}]

  function pipeline(canvas, stages, summary) {
    if (!stages || stages.length === 0) return;
    const { ctx, w, h } = setup(canvas);

    canvas._pipeStages = stages;
    canvas._pipeSummary = summary;
    canvas._pipeW = w;
    canvas._pipeH = h;

    // Track cumulative history
    if (!canvas._cumulativeHistory) canvas._cumulativeHistory = [];
    canvas._cumulativeHistory.push(stages.map(s => s.throughput));
    if (canvas._cumulativeHistory.length > 30) canvas._cumulativeHistory.shift();

    if (pipelineParticles.length === 0 && stages.length > 1) {
      for (let i = 0; i < stages.length - 1; i++) {
        for (let p = 0; p < 6; p++) {
          pipelineParticles.push({
            seg: i,
            t: Math.random(),
            speed: 0.002 + Math.random() * 0.004,
          });
        }
      }
    }

    if (!pipelineAnimId) {
      function animate() {
        drawPipeline(canvas);
        pipelineAnimId = requestAnimationFrame(animate);
      }
      animate();
    }
  }

  function drawMiniSparkInNode(ctx, data, x, y, w, h, color) {
    if (!data || data.length < 2) return;
    var mn = Math.min.apply(null, data);
    var mx = Math.max.apply(null, data);
    var range = mx - mn || 1;

    ctx.beginPath();
    data.forEach(function (v, i) {
      var px = x + (i / (data.length - 1)) * w;
      var py = y + h - ((v - mn) / range) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // fill under
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.1);
    ctx.fill();
  }

  function drawHealthRing(ctx, cx, cy, radius, health, color) {
    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Health arc
    var angle = (health / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawPipeline(canvas) {
    var stages = canvas._pipeStages;
    var summary = canvas._pipeSummary;
    if (!stages) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas._pipeW;
    var h = canvas._pipeH;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var n = stages.length;
    var headerH = 90;
    var flowH = 100; // cumulative flow area
    var availH = h - headerH - flowH - 10;
    var nodeW = Math.min(300, (w - 40) / n * 0.72);
    var nodeH = Math.min(400, availH * 0.92);
    var cy = headerH + availH * 0.50;
    var spacing = (w - 20) / n;
    var startX = 10 + spacing / 2;

    // Find max throughput for proportional lines
    var maxThroughput = 0;
    stages.forEach(function (s) { if (s.throughput > maxThroughput) maxThroughput = s.throughput; });
    if (maxThroughput === 0) maxThroughput = 1;

    var positions = stages.map(function (_, i) {
      return { x: startX + i * spacing, y: cy };
    });

    // ── Summary header ──
    if (summary) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('END-TO-END DATA FLOW', w * 0.5, 6);

      ctx.font = "700 44px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      var throughputStr = formatNum(summary.throughput) + ' events/s';
      var latencyStr = summary.totalLatency + 'ms total latency';
      ctx.fillText(throughputStr + '   \u00B7   ' + latencyStr, w * 0.5, 34);
    }

    // ── Throughput-proportional connections ──
    for (var i = 0; i < n - 1; i++) {
      var ax = positions[i].x + nodeW / 2;
      var bx = positions[i + 1].x - nodeW / 2;
      var throughputRatio = stages[i].throughput / maxThroughput;
      var lineWidth = 2 + throughputRatio * 6;

      // Connection line with glow
      ctx.save();
      ctx.shadowColor = BRAND.pink;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(ax, cy);
      ctx.lineTo(bx, cy);
      ctx.strokeStyle = hexToRgba(BRAND.border, 0.4 + throughputRatio * 0.4);
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.restore();
    }

    // ── Particles with data volume indicators ──
    pipelineParticles.forEach(function (p) {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;

      var idx = p.seg;
      if (idx >= n - 1) return;
      var ax = positions[idx].x + nodeW / 2;
      var bx = positions[idx + 1].x - nodeW / 2;
      var px = ax + (bx - ax) * p.t;
      var stageColor = stages[idx].status === 'healthy' ? BRAND.pink : BRAND.amber;

      ctx.beginPath();
      ctx.arc(px, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = stageColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, cy, 10, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(stageColor, 0.15);
      ctx.fill();

      // Floating data volume label on some particles
      if (p.t > 0.3 && p.t < 0.7 && idx < n - 1) {
        var vol = stages[idx].dataVolume;
        if (vol && p.speed > 0.004) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.font = "500 13px 'IBM Plex Mono', monospace";
          ctx.fillStyle = hexToRgba(BRAND.text2, 0.7);
          ctx.fillText(vol + ' GB', px, cy - 16);
        }
      }
    });

    // ── Nodes ──
    stages.forEach(function (stage, i) {
      var x = positions[i].x - nodeW / 2;
      var y = cy - nodeH / 2;
      var healthColor = stage.health >= 95 ? BRAND.green : (stage.health >= 80 ? BRAND.amber : BRAND.red);

      // Node bg
      ctx.fillStyle = BRAND.surface;
      ctx.strokeStyle = stage.status === 'healthy' ? BRAND.border : BRAND.amber;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, y, nodeW, nodeH, 8);
      ctx.fill();
      ctx.stroke();

      // Top accent
      var accentGrad = ctx.createLinearGradient(x, y, x + nodeW, y);
      accentGrad.addColorStop(0, BRAND.pink);
      accentGrad.addColorStop(1, BRAND.hotPink);
      ctx.fillStyle = stage.status === 'healthy' ? accentGrad : BRAND.amber;
      roundRectTop(ctx, x, y, nodeW, 4, 8);
      ctx.fill();

      // Stage name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "700 24px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(stage.name, positions[i].x, y + 14);

      // Health ring (replaces simple dot)
      var ringCx = positions[i].x - nodeW * 0.30;
      var ringCy = y + 56;
      drawHealthRing(ctx, ringCx, ringCy, 13, stage.health || 98, healthColor);

      // Health text
      ctx.textAlign = 'left';
      ctx.font = "700 18px 'DM Sans', sans-serif";
      ctx.fillStyle = healthColor;
      ctx.fillText((stage.health || 98) + '%', ringCx + 18, ringCy - 9);

      // Throughput — BIG
      ctx.textAlign = 'center';
      ctx.font = "700 48px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(formatNum(stage.throughput), positions[i].x, y + 80);

      ctx.font = "500 16px 'DM Sans', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('events/s', positions[i].x, y + 130);

      // Sub-metrics: latency + data volume
      ctx.font = "600 18px 'IBM Plex Mono', monospace";
      ctx.textAlign = 'left';
      ctx.fillStyle = BRAND.cyan;
      ctx.fillText(stage.latency + 'ms', x + 14, y + nodeH - 72);

      ctx.textAlign = 'right';
      ctx.fillStyle = BRAND.text2;
      if (stage.dataVolume) {
        ctx.fillText(stage.dataVolume + ' GB', x + nodeW - 14, y + nodeH - 72);
      }

      // Error rate
      if (stage.errorRate !== undefined) {
        ctx.textAlign = 'center';
        ctx.font = "500 16px 'IBM Plex Mono', monospace";
        ctx.fillStyle = stage.errorRate > 0.02 ? BRAND.amber : BRAND.text3;
        ctx.fillText('err ' + (stage.errorRate * 100).toFixed(1) + '%', positions[i].x, y + nodeH - 48);
      }

      // Mini sparkline
      if (stage.sparkline && stage.sparkline.length > 2) {
        var sparkX = x + 12;
        var sparkY = y + nodeH - 34;
        var sparkW = nodeW - 24;
        var sparkH = 28;
        drawMiniSparkInNode(ctx, stage.sparkline, sparkX, sparkY, sparkW, sparkH, hexToRgba(BRAND.pink, 0.6));
      }
    });

    // ── Cumulative flow visualization (bottom) ──
    var cumHist = canvas._cumulativeHistory;
    if (cumHist && cumHist.length > 2) {
      var flowY = h - flowH;
      var flowW = w - 60;
      var flowX = 30;

      // Semi-transparent background
      ctx.fillStyle = hexToRgba(BRAND.surface, 0.5);
      roundRect(ctx, flowX, flowY, flowW, flowH - 4, 6);
      ctx.fill();

      // Stacked area chart
      var stageColors = [BRAND.pink, BRAND.hotPink, BRAND.cyan, BRAND.green, BRAND.amber, '#B388FF'];
      var maxCum = 0;
      cumHist.forEach(function (snap) {
        var sum = snap.reduce(function (a, b) { return a + b; }, 0);
        if (sum > maxCum) maxCum = sum;
      });
      if (maxCum === 0) maxCum = 1;

      var barW = (flowW - 20) / cumHist.length;

      // Draw stacked from bottom
      for (var si = n - 1; si >= 0; si--) {
        ctx.beginPath();
        cumHist.forEach(function (snap, ti) {
          var cumVal = 0;
          for (var k = 0; k <= si; k++) cumVal += (snap[k] || 0);
          var barX = flowX + 10 + ti * barW;
          var barH = (cumVal / maxCum) * (flowH - 16);
          var barY = flowY + flowH - 6 - barH;
          if (ti === 0) ctx.moveTo(barX, barY);
          else ctx.lineTo(barX, barY);
        });
        // Close path along bottom
        ctx.lineTo(flowX + 10 + (cumHist.length - 1) * barW, flowY + flowH - 6);
        ctx.lineTo(flowX + 10, flowY + flowH - 6);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(stageColors[si % stageColors.length], 0.15);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(stageColors[si % stageColors.length], 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = "600 13px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('CUMULATIVE THROUGHPUT', flowX + 14, flowY + 6);
    }
  }

  // ── shape helpers ──
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  // ===========================================================================
  // USA MAP V2 — Dramatically more info-dense and visually striking
  // Bubbles, callouts, leaderboard, grid, metro markers, directional arcs,
  // regional borders, animated counters, richer panels
  // ===========================================================================
  let mapAnimId = null;
  let mapSparkHistory = {};
  let mapParticles = [];
  let mapPrevTotals = {};  // for animated counter
  let mapDataEvents = [];  // time-decaying visual events { stateId, value, born, type }

  // GCP Data Center locations — delivery arc origins (real infrastructure)
  const DATA_CENTERS = [
    { id: 'us-west1',    label: 'WEST',    lon: -121.2, lat: 45.6 },   // The Dalles, Oregon
    { id: 'us-central1', label: 'CENTRAL', lon: -95.9,  lat: 41.3 },   // Council Bluffs, Iowa
    { id: 'us-east4',    label: 'EAST',    lon: -77.5,  lat: 39.0 },   // Ashburn, Virginia
  ];

  function usaMap(canvas, data) {
    if (!data || !data.states) return;
    var US = window.US_STATES;
    if (!US) return;

    // Accumulate sparkline history per state + emit data events on changes
    var eventNow = Date.now();
    Object.entries(data.states).forEach(function (e) {
      var id = e[0], val = e[1].impressions;
      if (!mapSparkHistory[id]) mapSparkHistory[id] = [];
      var prevVal = mapSparkHistory[id].length > 0 ? mapSparkHistory[id][mapSparkHistory[id].length - 1] : 0;
      mapSparkHistory[id].push(val);
      if (mapSparkHistory[id].length > 20) mapSparkHistory[id].shift();

      // Emit visual event when data changes significantly
      var delta = val - prevVal;
      if (Math.abs(delta) > prevVal * 0.01 && val > 0) {
        mapDataEvents.push({
          stateId: id,
          value: delta > 0 ? '+' + formatNum(delta) : formatNum(delta),
          born: eventNow,
          type: delta > 0 ? 'up' : 'down',
        });
      }
    });

    // Expire old events (keep for 6 seconds)
    mapDataEvents = mapDataEvents.filter(function (ev) {
      return eventNow - ev.born < 6000;
    });

    canvas._mapData = data;

    // Init directional arc particles (from data centers outward to states)
    // Stagger initial `t` widely and vary speeds for organic feel
    if (mapParticles.length === 0) {
      for (var p = 0; p < 50; p++) {
        mapParticles.push({
          dc: Math.floor(Math.random() * DATA_CENTERS.length),
          target: Math.floor(Math.random() * 10),
          t: Math.random(),                        // well-distributed initial phase
          speed: 0.002 + Math.random() * 0.004,    // slower, more varied
          delay: Math.random() * 120,               // frame delay before first appearance
          age: 0,
        });
      }
    }

    if (!mapAnimId) {
      function animate() {
        drawMap(canvas);
        mapAnimId = requestAnimationFrame(animate);
      }
      animate();
    }
  }

  function mapStatePath(ctx, state, US, mapX, mapY, mapW, mapH) {
    ctx.beginPath();
    state.path.forEach(function (pt, i) {
      var xy = US.project(pt[0], pt[1]);
      var px = mapX + xy[0] * mapW;
      var py = mapY + xy[1] * mapH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  function activityColor(intensity) {
    var r, g, b;
    if (intensity < 0.15) {
      var t = intensity / 0.15;
      r = Math.round(26 + t * 35);  g = Math.round(6 + t * 12);  b = Math.round(56 + t * 30);
    } else if (intensity < 0.35) {
      var t2 = (intensity - 0.15) / 0.2;
      r = Math.round(61 + t2 * 80);  g = Math.round(18 + t2 * 15);  b = Math.round(86 + t2 * 40);
    } else if (intensity < 0.6) {
      var t3 = (intensity - 0.35) / 0.25;
      r = Math.round(141 + t3 * 80);  g = Math.round(33 + t3 * 60);  b = Math.round(126 + t3 * 50);
    } else if (intensity < 0.85) {
      var t4 = (intensity - 0.6) / 0.25;
      r = Math.round(221 + t4 * 32);  g = Math.round(93 + t4 * 71);  b = Math.round(176 + t4 * 36);
    } else {
      var t5 = (intensity - 0.85) / 0.15;
      r = Math.round(253 + t5 * 2);  g = Math.round(164 - t5 * 9);  b = Math.round(212 - t5 * 1);
    }
    return { r: r, g: g, b: b, css: 'rgb(' + r + ',' + g + ',' + b + ')' };
  }

  function drawMiniSparkline(ctx, data, x, y, w, h, color) {
    if (!data || data.length < 2) return;
    var min = Math.min.apply(null, data);
    var max = Math.max.apply(null, data);
    var range = max - min || 1;

    ctx.beginPath();
    data.forEach(function (v, i) {
      var px = x + (i / (data.length - 1)) * w;
      var py = y + h - ((v - min) / range) * h;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.12);
    ctx.fill();
  }

  function drawMap(canvas) {
    var data = canvas._mapData;
    if (!data) return;
    var US = window.US_STATES;
    if (!US) return;

    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var stateData = data.states || {};
    var totals = data.totals || {};
    var regions = data.regions || {};
    var now = Date.now();

    // Find max impressions & bids for scaling
    var maxImp = 0;
    var maxBids = 0;
    Object.values(stateData).forEach(function (s) {
      if (s.impressions > maxImp) maxImp = s.impressions;
      if (s.bids > maxBids) maxBids = s.bids;
    });
    if (maxImp === 0) maxImp = 1;
    if (maxBids === 0) maxBids = 1;

    // Map layout — shifted left to make room for leaderboard
    var leaderboardW = 200;
    var mapW = (w - leaderboardW - 20) * 0.68;
    var mapH = h * 0.68;
    var mapX = 10 + (w - leaderboardW - 20) * 0.16;
    var mapY = h * 0.14;

    // ── Subtle radial glow ──
    var grad = ctx.createRadialGradient(mapX + mapW * 0.5, mapY + mapH * 0.5, 0, mapX + mapW * 0.5, mapY + mapH * 0.5, mapW * 0.55);
    grad.addColorStop(0, hexToRgba(BRAND.violet, 0.15));
    grad.addColorStop(0.6, hexToRgba(BRAND.violet, 0.05));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ── Grid overlay (latitude/longitude) ──
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.12);
    ctx.lineWidth = 0.5;
    // Latitude lines (25°N to 49°N, every 5°)
    for (var lat = 25; lat <= 50; lat += 5) {
      ctx.beginPath();
      for (var glon = -125; glon <= -66; glon += 2) {
        var gxy = US.project(glon, lat);
        var gpx = mapX + gxy[0] * mapW;
        var gpy = mapY + gxy[1] * mapH;
        if (glon === -125) ctx.moveTo(gpx, gpy);
        else ctx.lineTo(gpx, gpy);
      }
      ctx.stroke();
    }
    // Longitude lines (-120 to -70, every 10°)
    for (var lon = -120; lon >= -70; lon += 10) {
      ctx.beginPath();
      for (var glat = 24; glat <= 50; glat += 1) {
        var gxy2 = US.project(lon, glat);
        var gpx2 = mapX + gxy2[0] * mapW;
        var gpy2 = mapY + gxy2[1] * mapH;
        if (glat === 24) ctx.moveTo(gpx2, gpy2);
        else ctx.lineTo(gpx2, gpy2);
      }
      ctx.stroke();
    }

    // ── Draw state polygons ──
    US.states.forEach(function (state) {
      if (!state.path || state.path.length < 3) return;
      var activity = stateData[state.id] || { impressions: 0 };
      var intensity = activity.impressions / maxImp;
      var col = activityColor(intensity);

      mapStatePath(ctx, state, US, mapX, mapY, mapW, mapH);
      ctx.fillStyle = col.css;
      ctx.fill();

      ctx.strokeStyle = hexToRgba('#6B5690', 0.3 + intensity * 0.3);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (intensity > 0.6) {
        ctx.save();
        ctx.shadowColor = BRAND.hotPink;
        ctx.shadowBlur = 8 + intensity * 12;
        mapStatePath(ctx, state, US, mapX, mapY, mapW, mapH);
        ctx.strokeStyle = hexToRgba(BRAND.pink, 0.15);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
    });

    // ── Regional border outlines (dotted) ──
    var regionBoundaryLons = [-104, -85]; // approximate west/central and central/east boundaries
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = hexToRgba(BRAND.pink, 0.2);
    ctx.lineWidth = 1.5;
    regionBoundaryLons.forEach(function (blon) {
      ctx.beginPath();
      for (var blat = 25; blat <= 49; blat += 0.5) {
        var bxy = US.project(blon, blat);
        var bpx = mapX + bxy[0] * mapW;
        var bpy = mapY + bxy[1] * mapH;
        if (blat === 25) ctx.moveTo(bpx, bpy);
        else ctx.lineTo(bpx, bpy);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // ── Zip-level delivery hotspots (from BigQuery) — enhanced 4K visualization ──
    var hotspots = data.hotspots || [];
    var hotspotPositions = [];
    if (hotspots.length > 0) {
      var maxHotImp = hotspots[0].impressions || 1;

      // Layer 1: Broad heat-map glow (large soft radials)
      hotspots.forEach(function (h) {
        if (!h.lat || !h.lon) return;
        var xy = US.project(h.lon, h.lat);
        var hpx = mapX + xy[0] * mapW;
        var hpy = mapY + xy[1] * mapH;
        if (hpx < mapX - 10 || hpx > mapX + mapW + 10 || hpy < mapY - 10 || hpy > mapY + mapH + 10) return;

        var intensity = h.impressions / maxHotImp;
        var glowR = 10 + intensity * 40;

        var glow = ctx.createRadialGradient(hpx, hpy, 0, hpx, hpy, glowR);
        if (intensity > 0.4) {
          glow.addColorStop(0, hexToRgba(BRAND.hotPink, 0.3 * intensity));
          glow.addColorStop(0.3, hexToRgba(BRAND.pink, 0.15 * intensity));
          glow.addColorStop(0.7, hexToRgba(BRAND.pink, 0.03));
          glow.addColorStop(1, 'transparent');
        } else {
          glow.addColorStop(0, hexToRgba(BRAND.cyan, 0.2 * intensity));
          glow.addColorStop(0.4, hexToRgba(BRAND.cyan, 0.06));
          glow.addColorStop(1, 'transparent');
        }
        ctx.fillStyle = glow;
        ctx.fillRect(hpx - glowR, hpy - glowR, glowR * 2, glowR * 2);
      });

      // Layer 2: Core dots with pulse rings on top 30
      hotspots.forEach(function (h, hi) {
        if (!h.lat || !h.lon) return;
        var xy = US.project(h.lon, h.lat);
        var hpx = mapX + xy[0] * mapW;
        var hpy = mapY + xy[1] * mapH;
        if (hpx < mapX - 10 || hpx > mapX + mapW + 10 || hpy < mapY - 10 || hpy > mapY + mapH + 10) return;

        var intensity = h.impressions / maxHotImp;
        var dotR = 3 + intensity * 10;

        // Color: cyan → pink → white-hot
        var r, g, b;
        if (intensity < 0.15) {
          r = 103; g = 232; b = 249;
        } else if (intensity < 0.4) {
          var ct = (intensity - 0.15) / 0.25;
          r = Math.round(103 + ct * 150); g = Math.round(232 - ct * 68); b = Math.round(249 - ct * 37);
        } else if (intensity < 0.75) {
          var ct2 = (intensity - 0.4) / 0.35;
          r = 253; g = Math.round(164 - ct2 * 40); b = Math.round(212 - ct2 * 20);
        } else {
          r = 255; g = 210; b = 235;
        }

        // Double pulse rings on top 30
        if (hi < 30) {
          var p1 = ((now / (2000 + hi * 150)) + hi * 0.3) % 1;
          ctx.beginPath();
          ctx.arc(hpx, hpy, dotR + 2 + p1 * 18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + ((1 - p1) * 0.3) + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          var p2 = ((now / (2000 + hi * 150)) + hi * 0.3 + 0.5) % 1;
          ctx.beginPath();
          ctx.arc(hpx, hpy, dotR + 2 + p2 * 18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + ((1 - p2) * 0.15) + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Outer glow ring
        ctx.beginPath();
        ctx.arc(hpx, hpy, dotR + 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.08 + intensity * 0.1) + ')';
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(hpx, hpy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.55 + intensity * 0.4) + ')';
        ctx.fill();

        // White-hot center
        if (intensity > 0.1) {
          ctx.beginPath();
          ctx.arc(hpx, hpy, Math.max(1.5, dotR * 0.35), 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + intensity * 0.5) + ')';
          ctx.fill();
        }

        hotspotPositions.push({
          x: hpx, y: hpy, imp: h.impressions, zip3: h.zip3,
          state: h.state, city: h.city, intensity: intensity, idx: hi,
          r: r, g: g, b: b,
        });
      });

      // Layer 3: City labels for top 20 hotspots (with anti-overlap)
      var labelledCount = 0;
      var labelPositions = [];
      hotspotPositions.forEach(function (hp) {
        if (labelledCount >= 20 || hp.intensity < 0.05) return;

        var overlaps = false;
        labelPositions.forEach(function (lp) {
          if (Math.abs(hp.x - lp.x) < 70 && Math.abs(hp.y - lp.y) < 22) overlaps = true;
        });
        if (overlaps) return;

        labelPositions.push({ x: hp.x, y: hp.y });
        labelledCount++;

        // Use city name if available, otherwise zip3 + state
        var cityName = hp.city || (hp.zip3 + ' ' + (hp.state || ''));
        // Truncate long city names
        if (cityName.length > 14) cityName = cityName.substring(0, 13) + '.';
        var impText = formatNum(hp.imp);
        var isTop = hp.idx < 8;

        // Background pill with gradient border
        var pillW = isTop ? 90 : 72;
        var pillH = isTop ? 26 : 20;
        var pillX = hp.x + (isTop ? 12 : 9);
        var pillY = hp.y - pillH / 2;

        // Connector line from dot to label
        ctx.beginPath();
        ctx.moveTo(hp.x + 3, hp.y);
        ctx.lineTo(pillX, hp.y);
        ctx.strokeStyle = 'rgba(' + hp.r + ',' + hp.g + ',' + hp.b + ',0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.fillStyle = hexToRgba(BRAND.surface, 0.85);
        ctx.strokeStyle = 'rgba(' + hp.r + ',' + hp.g + ',' + hp.b + ',0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, pillX, pillY, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        // City/zip name
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = (isTop ? "700 10px" : "600 9px") + " 'Space Grotesk', sans-serif";
        ctx.fillStyle = 'rgb(' + hp.r + ',' + hp.g + ',' + hp.b + ')';
        ctx.fillText(cityName, pillX + 4, pillY + pillH / 2 - (isTop ? 4 : 2));

        // Impression count below
        if (isTop) {
          ctx.font = "500 8px 'IBM Plex Mono', monospace";
          ctx.fillStyle = BRAND.text2;
          ctx.fillText(impText + ' imp', pillX + 4, pillY + pillH / 2 + 6);
        } else {
          ctx.textAlign = 'right';
          ctx.font = "400 7px 'IBM Plex Mono', monospace";
          ctx.fillStyle = BRAND.text3;
          ctx.fillText(impText, pillX + pillW - 4, pillY + pillH / 2);
        }
      });
    }

    // ── Sorted top states ──
    var sorted = Object.entries(stateData)
      .sort(function (a, b) { return b[1].impressions - a[1].impressions; });
    var topStates = sorted.slice(0, 10);
    var topCenters = [];

    // Data center pixel positions
    var dcPositions = DATA_CENTERS.map(function (dc) {
      var xy = US.project(dc.lon, dc.lat);
      return { id: dc.id, label: dc.label, x: mapX + xy[0] * mapW, y: mapY + xy[1] * mapH };
    });

    topStates.forEach(function (entry) {
      var stDef = US.states.find(function (s) { return s.id === entry[0]; });
      if (!stDef) return;
      var cxy = US.project(stDef.center[0], stDef.center[1]);
      topCenters.push({ id: entry[0], x: mapX + cxy[0] * mapW, y: mapY + cxy[1] * mapH, imp: entry[1].impressions, bids: entry[1].bids });
    });

    // ── Proportional bubble overlay (sized by bid volume) ──
    topCenters.forEach(function (tc) {
      var bidRatio = tc.bids / maxBids;
      var bubbleR = 8 + bidRatio * 22;

      ctx.beginPath();
      ctx.arc(tc.x, tc.y, bubbleR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(BRAND.cyan, 0.12 + bidRatio * 0.08);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(BRAND.cyan, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ── Directional arcs from data centers OUTWARD to states (campaign delivery) ──
    if (topCenters.length > 1 && dcPositions.length > 0) {
      mapParticles.forEach(function (p) {
        p.age = (p.age || 0) + 1;
        if (p.age < (p.delay || 0)) return; // stagger initial appearance

        p.t += p.speed;
        if (p.t > 1) {
          p.t = -Math.random() * 0.3; // random pause before next arc
          p.dc = Math.floor(Math.random() * dcPositions.length);
          p.target = Math.floor(Math.random() * Math.min(topCenters.length, 10));
          p.speed = 0.002 + Math.random() * 0.004;
        }
        if (p.t < 0) return; // in pause phase

        var dc = dcPositions[p.dc % dcPositions.length];
        var target = topCenters[p.target % topCenters.length];
        if (!dc || !target) return;

        // Ease-out cubic for smooth deceleration at destination
        var raw = p.t;
        var eased = 1 - Math.pow(1 - raw, 3);

        // Arc from data center outward to state — arc height proportional to distance
        var dist = Math.sqrt(Math.pow(target.x - dc.x, 2) + Math.pow(target.y - dc.y, 2));
        var arcHeight = Math.min(50, dist * 0.15);
        var mx = (dc.x + target.x) / 2;
        var my = (dc.y + target.y) / 2 - arcHeight;
        var t = eased;
        var it = 1 - t;
        var px = it * it * dc.x + 2 * it * t * mx + t * t * target.x;
        var py = it * it * dc.y + 2 * it * t * my + t * t * target.y;

        // Fade in at start, fade out at end
        var fadeAlpha = raw < 0.1 ? raw / 0.1 : (raw > 0.85 ? (1 - raw) / 0.15 : 1);

        // Gradient trail behind the particle (6 trail dots)
        for (var trail = 5; trail >= 0; trail--) {
          var tt = Math.max(0, raw - trail * 0.02);
          var easedT = 1 - Math.pow(1 - tt, 3);
          var iit = 1 - easedT;
          var tpx = iit * iit * dc.x + 2 * iit * easedT * mx + easedT * easedT * target.x;
          var tpy = iit * iit * dc.y + 2 * iit * easedT * my + easedT * easedT * target.y;
          var trailAlpha = (0.45 - trail * 0.07) * fadeAlpha;
          ctx.beginPath();
          ctx.arc(tpx, tpy, 2.2 - trail * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(BRAND.cyan, Math.max(0.01, trailAlpha));
          ctx.fill();
        }

        // Main particle
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(BRAND.cyan, 0.7 * fadeAlpha);
        ctx.fill();

        // Soft glow around particle
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(BRAND.cyan, 0.06 * fadeAlpha);
        ctx.fill();
      });

      // Draw GCP data center markers — prominent Google Cloud branding
      dcPositions.forEach(function (dc) {
        // Large outer glow
        var dcGlow = ctx.createRadialGradient(dc.x, dc.y, 0, dc.x, dc.y, 35);
        dcGlow.addColorStop(0, hexToRgba('#4285F4', 0.25));
        dcGlow.addColorStop(0.3, hexToRgba('#4285F4', 0.1));
        dcGlow.addColorStop(0.7, hexToRgba('#4285F4', 0.03));
        dcGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = dcGlow;
        ctx.fillRect(dc.x - 35, dc.y - 35, 70, 70);

        // Double animated pulse rings
        var dcP1 = (now / 3000) % 1;
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, 10 + dcP1 * 20, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba('#4285F4', (1 - dcP1) * 0.3);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        var dcP2 = ((now / 3000) + 0.5) % 1;
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, 10 + dcP2 * 20, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba('#4285F4', (1 - dcP2) * 0.15);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Google Cloud hexagon (larger)
        var hSize = 11;
        ctx.beginPath();
        for (var hi = 0; hi < 6; hi++) {
          var hAngle = (Math.PI / 3) * hi - Math.PI / 6;
          var hx = dc.x + hSize * Math.cos(hAngle);
          var hy = dc.y + hSize * Math.sin(hAngle);
          if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
        }
        ctx.closePath();

        // Google Cloud 4-color gradient
        var gcGrad = ctx.createLinearGradient(dc.x - hSize, dc.y, dc.x + hSize, dc.y);
        gcGrad.addColorStop(0, '#4285F4');     // Google Blue
        gcGrad.addColorStop(0.35, '#EA4335');  // Google Red
        gcGrad.addColorStop(0.65, '#FBBC04');  // Google Yellow
        gcGrad.addColorStop(1, '#34A853');     // Google Green
        ctx.fillStyle = gcGrad;
        ctx.fill();
        ctx.strokeStyle = hexToRgba('#ffffff', 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();

        // White cloud symbol in center
        ctx.save();
        ctx.beginPath();
        // Simple cloud shape
        ctx.arc(dc.x - 2, dc.y + 1, 3.5, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(dc.x, dc.y - 2, 3, Math.PI, 0);
        ctx.arc(dc.x + 2, dc.y + 1, 3.5, Math.PI * 1.5, Math.PI * 0.5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.restore();

        // "Google Cloud" label + region
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = "700 9px 'Space Grotesk', sans-serif";
        ctx.fillStyle = '#ffffff';
        ctx.fillText('GOOGLE CLOUD', dc.x, dc.y + 15);
        ctx.font = "500 8px 'IBM Plex Mono', monospace";
        ctx.fillStyle = hexToRgba('#4285F4', 0.8);
        ctx.fillText(dc.label, dc.x, dc.y + 19);
      });
    }

    // ── Animated pulse dots on top states with heat-rate pulse ──
    topStates.forEach(function (entry, idx) {
      var stId = entry[0];
      var stData = entry[1];
      var stDef = US.states.find(function (s) { return s.id === stId; });
      if (!stDef) return;

      var cxy = US.project(stDef.center[0], stDef.center[1]);
      var cx = mapX + cxy[0] * mapW;
      var cy = mapY + cxy[1] * mapH;
      var intensity = stData.impressions / maxImp;

      // Rate-of-change-based pulse speed
      var sparkHist = mapSparkHistory[stId] || [];
      var rateOfChange = 0;
      if (sparkHist.length > 2) {
        var recent = sparkHist[sparkHist.length - 1];
        var prev = sparkHist[sparkHist.length - 2];
        rateOfChange = Math.abs(recent - prev) / (prev || 1);
      }
      var pulseSpeed = 2000 - rateOfChange * 8000; // faster pulse for bigger changes
      pulseSpeed = Math.max(600, Math.min(3000, pulseSpeed));

      var phase = ((now / pulseSpeed) + idx * 0.8) % 1;
      var ringRadius = 6 + phase * 18;
      var ringAlpha = (1 - phase) * 0.3;

      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(BRAND.hotPink, ringAlpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      var phase2 = ((now / pulseSpeed) + idx * 0.8 + 0.5) % 1;
      var ring2 = 6 + phase2 * 18;
      var ring2a = (1 - phase2) * 0.2;
      ctx.beginPath();
      ctx.arc(cx, cy, ring2, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(BRAND.hotPink, ring2a);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Glow halo
      var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10 + intensity * 8);
      glow.addColorStop(0, hexToRgba(BRAND.hotPink, 0.5));
      glow.addColorStop(0.4, hexToRgba(BRAND.pink, 0.15));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);

      // Core dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3 + intensity * 2, 0, Math.PI * 2);
      ctx.fillStyle = BRAND.hotPink;
      ctx.fill();
    });

    // ── Data collection/expiration events — animated floating indicators ──
    mapDataEvents.forEach(function (ev) {
      var stDef = US.states.find(function (s) { return s.id === ev.stateId; });
      if (!stDef) return;
      var cxy = US.project(stDef.center[0], stDef.center[1]);
      var evx = mapX + cxy[0] * mapW;
      var evy = mapY + cxy[1] * mapH;

      var age = (now - ev.born) / 6000; // 0..1 over 6 seconds
      if (age > 1) return;

      // Expanding ring that fades out
      var ringR = 8 + age * 30;
      var ringAlpha = (1 - age) * 0.35;
      ctx.beginPath();
      ctx.arc(evx, evy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(ev.type === 'up' ? BRAND.green : BRAND.pink, ringAlpha);
      ctx.lineWidth = 1.5 * (1 - age);
      ctx.stroke();

      // Floating value indicator — drifts upward and fades
      var floatY = evy - 20 - age * 25;
      var textAlpha = age < 0.15 ? age / 0.15 : (1 - age) * 0.9;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "600 10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = hexToRgba(ev.type === 'up' ? BRAND.green : BRAND.pink, textAlpha);
      ctx.fillText(ev.value, evx + 14, floatY);
    });

    // ── Per-state data callouts on top 10 ──
    topStates.forEach(function (entry, idx) {
      var stId = entry[0];
      var stData = entry[1];
      var stDef = US.states.find(function (s) { return s.id === stId; });
      if (!stDef) return;

      var cxy = US.project(stDef.center[0], stDef.center[1]);
      var cx = mapX + cxy[0] * mapW;
      var cy = mapY + cxy[1] * mapH;

      // Larger callouts for CA, TX, FL, NY
      var isBig = ['CA','TX','FL','NY'].indexOf(stId) !== -1;
      var cardW = isBig ? 72 : 56;
      var cardH = isBig ? 42 : 34;
      var offY = -28 - (isBig ? 6 : 0);

      // Card background
      ctx.fillStyle = hexToRgba(BRAND.surface, 0.85);
      ctx.strokeStyle = hexToRgba(BRAND.pink, 0.3);
      ctx.lineWidth = 1;
      roundRect(ctx, cx - cardW / 2, cy + offY - cardH, cardW, cardH, 4);
      ctx.fill();
      ctx.stroke();

      // State abbrev (bold)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = (isBig ? "700 12px" : "700 10px") + " 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(stId, cx, cy + offY - cardH + 4);

      // Impressions
      ctx.font = (isBig ? "600 11px" : "500 9px") + " 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(stData.impressions), cx, cy + offY - cardH + (isBig ? 18 : 15));

      // Bids
      ctx.font = (isBig ? "400 9px" : "400 8px") + " 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.cyan;
      ctx.fillText(formatNum(stData.bids) + ' bids', cx, cy + offY - cardH + (isBig ? 30 : 25));
    });

    // ── Metro hotspot markers ──
    if (US.metros) {
      US.metros.forEach(function (metro) {
        var mxy = US.project(metro.lon, metro.lat);
        var mpx = mapX + mxy[0] * mapW;
        var mpy = mapY + mxy[1] * mapH;

        // Small diamond marker
        ctx.beginPath();
        ctx.moveTo(mpx, mpy - 3);
        ctx.lineTo(mpx + 3, mpy);
        ctx.lineTo(mpx, mpy + 3);
        ctx.lineTo(mpx - 3, mpy);
        ctx.closePath();
        ctx.fillStyle = hexToRgba(BRAND.cyan, 0.7);
        ctx.fill();

        // Tiny label
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = "400 8px 'DM Sans', sans-serif";
        ctx.fillStyle = hexToRgba(BRAND.cyan, 0.5);
        ctx.fillText(metro.id, mpx + 5, mpy);
      });
    }

    // ── Richer regional panels (160x110px) ──
    var panelW = 160;
    var panelH = 110;
    var regionLayout = {
      west:    { x: 10,                y: mapY + mapH * 0.35 },
      central: { x: mapX + (mapW - panelW) / 2, y: h - panelH - 8 },
      east:    { x: mapX + mapW - panelW + 30,   y: mapY + mapH * 0.35 },
    };
    var regionLabels = { west: 'WEST', central: 'CENTRAL', east: 'EAST' };

    Object.entries(regions).forEach(function (entry) {
      var key = entry[0];
      var reg = entry[1];
      var pos = regionLayout[key];
      if (!pos) return;

      ctx.fillStyle = hexToRgba(BRAND.surface, 0.75);
      ctx.strokeStyle = hexToRgba(BRAND.border, 0.5);
      ctx.lineWidth = 1;
      roundRect(ctx, pos.x, pos.y, panelW, panelH, 6);
      ctx.fill();
      ctx.stroke();

      var accent = ctx.createLinearGradient(pos.x, pos.y, pos.x + panelW, pos.y);
      accent.addColorStop(0, hexToRgba(BRAND.pink, 0.6));
      accent.addColorStop(1, hexToRgba(BRAND.hotPink, 0.6));
      roundRectTop(ctx, pos.x, pos.y, panelW, 3, 6);
      ctx.fillStyle = accent;
      ctx.fill();

      var pcx = pos.x + panelW / 2;

      // Region label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 10px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(regionLabels[key], pcx, pos.y + 8);

      // Impressions
      ctx.font = "700 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(reg.impressions), pcx, pos.y + 22);

      // Bids + campaigns
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.text2;
      ctx.fillText(formatNum(reg.bids) + ' bids', pcx - 28, pos.y + 48);

      ctx.fillStyle = BRAND.cyan;
      ctx.fillText((reg.campaigns || 0) + ' svc', pcx + 28, pos.y + 48);

      // Sparkline
      var regionStates = US.regions[key] ? US.regions[key].states : [];
      var regionSpark = [];
      for (var si = 0; si < 20; si++) {
        var sum = 0;
        regionStates.forEach(function (st) {
          var hist = mapSparkHistory[st];
          if (hist && hist.length > si) sum += hist[si];
        });
        if (sum > 0) regionSpark.push(sum);
      }
      if (regionSpark.length > 2) {
        drawMiniSparkline(ctx, regionSpark, pos.x + 10, pos.y + 64, panelW - 20, 36, BRAND.pink);
      }
    });

    // ── Leaderboard sidebar (right side) ──
    var lbX = w - leaderboardW - 4;
    var lbY = 88;
    var lbEntryH = 28;
    var lbCount = Math.min(15, sorted.length);

    // Leaderboard header
    ctx.fillStyle = hexToRgba(BRAND.surface, 0.7);
    roundRect(ctx, lbX, lbY - 24, leaderboardW, 22, 4);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "600 10px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('TOP STATES', lbX + leaderboardW / 2, lbY - 13);

    // Auto-scroll: offset based on time
    var scrollOffset = Math.floor((now / 3000) % Math.max(1, lbCount - 10));
    var visibleCount = Math.min(lbCount, Math.floor((h - lbY - 40) / lbEntryH));

    for (var li = 0; li < visibleCount; li++) {
      var si2 = (li + scrollOffset) % lbCount;
      var lEntry = sorted[si2];
      if (!lEntry) continue;
      var leY = lbY + li * lbEntryH;

      // Background bar
      var impRatio = lEntry[1].impressions / maxImp;
      var barWidth = impRatio * (leaderboardW - 60);

      ctx.fillStyle = hexToRgba(BRAND.surface, 0.5);
      roundRect(ctx, lbX, leY, leaderboardW, lbEntryH - 4, 3);
      ctx.fill();

      // Progress bar
      ctx.fillStyle = hexToRgba(BRAND.pink, 0.15);
      roundRect(ctx, lbX, leY, 60 + barWidth, lbEntryH - 4, 3);
      ctx.fill();

      // Rank
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = "600 10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('#' + (si2 + 1), lbX + 22, leY + lbEntryH / 2 - 2);

      // State name
      ctx.textAlign = 'left';
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(lEntry[0], lbX + 28, leY + lbEntryH / 2 - 2);

      // Impressions value
      ctx.textAlign = 'right';
      ctx.font = "500 10px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(lEntry[1].impressions), lbX + leaderboardW - 44, leY + lbEntryH / 2 - 2);

      // Bids value
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(formatNum(lEntry[1].bids), lbX + leaderboardW - 6, leY + lbEntryH / 2 - 2);
    }

    // ── Top header: animated counter ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.font = "600 12px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('CAMPAIGN DELIVERY  \u00B7  NATIONWIDE REACH', (w - leaderboardW) * 0.5, 8);

    // Animated count-up for total impressions
    var targetImp = totals.impressions || 0;
    if (!mapPrevTotals.impressions) mapPrevTotals.impressions = targetImp;
    var displayImp = mapPrevTotals.impressions + (targetImp - mapPrevTotals.impressions) * 0.1;
    mapPrevTotals.impressions = displayImp;

    ctx.font = "700 30px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text1;
    ctx.fillText(formatNum(Math.round(displayImp)) + ' impressions', (w - leaderboardW) * 0.5, 24);

    ctx.font = "500 14px 'DM Sans', sans-serif";
    ctx.fillStyle = BRAND.text2;
    ctx.fillText(formatNum(totals.bids || 0) + ' bids  \u00B7  ' + (totals.campaigns || 0) + ' active services', (w - leaderboardW) * 0.5, 58);

    // ── Color scale legend (bottom-left of map area) ──
    var legX = mapX;
    var legY = h - 22;
    var legW = 140;
    var legH = 8;
    var lgr = ctx.createLinearGradient(legX, 0, legX + legW, 0);
    lgr.addColorStop(0, activityColor(0).css);
    lgr.addColorStop(0.25, activityColor(0.25).css);
    lgr.addColorStop(0.5, activityColor(0.5).css);
    lgr.addColorStop(0.75, activityColor(0.75).css);
    lgr.addColorStop(1, activityColor(1).css);
    roundRect(ctx, legX, legY, legW, legH, 4);
    ctx.fillStyle = lgr;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = "400 9px 'DM Sans', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('Low', legX, legY - 2);
    ctx.textAlign = 'right';
    ctx.fillText('High', legX + legW, legY - 2);
    ctx.textAlign = 'center';
    ctx.fillText('IMPRESSIONS', legX + legW / 2, legY - 2);

    // Bubble legend
    ctx.textAlign = 'left';
    ctx.fillStyle = BRAND.text3;
    ctx.font = "400 9px 'DM Sans', sans-serif";
    ctx.fillText('\u25CB = bid volume', legX + legW + 14, legY + 6);
  }

  return { sparkline, gauge, pipeline, usaMap, thresholdColor, formatNum, setup };
})();
