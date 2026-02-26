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

    // ── Particles with data volume indicators (one label per segment to prevent overlap) ──
    var labelledSegs = {};
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

      // Floating data volume label — max one per segment to prevent overlap
      if (!labelledSegs[idx] && p.t > 0.35 && p.t < 0.65) {
        var vol = stages[idx].dataVolume;
        if (vol) {
          labelledSegs[idx] = true;
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
  let mapBursts = [];       // particle arrival bursts { x, y, born, color }

  // GCP Data Center locations — delivery arc origins (real infrastructure)
  const DATA_CENTERS = [
    { id: 'us-west1',    label: 'WEST',    lon: -121.2, lat: 45.6 },   // The Dalles, Oregon
    { id: 'us-central1', label: 'CENTRAL', lon: -95.9,  lat: 41.3 },   // Council Bluffs, Iowa
    { id: 'us-east4',    label: 'EAST',    lon: -77.5,  lat: 39.0 },   // Ashburn, Virginia
  ];

  // Preload official Google Cloud icon (served locally from /img/gcp-icon.png)
  let gcpIconImg = null;
  (function () {
    var img = new Image();
    img.onload = function () { gcpIconImg = img; };
    img.src = '/img/gcp-icon.png';
  })();

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
      for (var p = 0; p < 80; p++) {  // More particles for richer visualization
        mapParticles.push({
          dc: Math.floor(Math.random() * DATA_CENTERS.length),
          target: Math.floor(Math.random() * 10),
          t: Math.random(),                        // well-distributed initial phase
          speed: 0.003 + Math.random() * 0.006,    // Faster and more varied
          delay: Math.random() * 100,               // frame delay before first appearance
          age: 0,
          type: Math.random() > 0.7 ? 'fast' : 'normal',  // Particle type variety
          size: 1 + Math.random() * 2,              // Varied sizes
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

    // Map layout — shifted left to make room for leaderboard (scaled for 4K)
    var leaderboardW = 310;
    var mapW = (w - leaderboardW - 24) * 0.68;
    var mapH = h * 0.66;
    var mapX = 12 + (w - leaderboardW - 24) * 0.16;
    var mapY = h * 0.15;

    // ── Subtle radial glow ──
    var grad = ctx.createRadialGradient(mapX + mapW * 0.5, mapY + mapH * 0.5, 0, mapX + mapW * 0.5, mapY + mapH * 0.5, mapW * 0.55);
    grad.addColorStop(0, hexToRgba(BRAND.violet, 0.15));
    grad.addColorStop(0.6, hexToRgba(BRAND.violet, 0.05));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ── Sweeping scan line for dynamic motion (every 8 seconds) ──
    var scanProgress = (now / 8000) % 1;
    var scanY = mapY + scanProgress * mapH;
    var scanGrad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.3, hexToRgba(BRAND.cyan, 0.03));
    scanGrad.addColorStop(0.5, hexToRgba(BRAND.cyan, 0.12));
    scanGrad.addColorStop(0.7, hexToRgba(BRAND.cyan, 0.03));
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(mapX, scanY - 40, mapW, 80);

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
    var hotspots = (data.hotspots || []).sort(function(a, b) {
      return (b.impressions || 0) - (a.impressions || 0);
    });
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

      // Layer 3: City labels for top 12 hotspots (reduced clutter, with anti-overlap) — 4K scaled
      var labelledCount = 0;
      var labelPositions = [];
      hotspotPositions.forEach(function (hp) {
        if (labelledCount >= 12 || hp.intensity < 0.1) return;

        var overlaps = false;
        labelPositions.forEach(function (lp) {
          if (Math.abs(hp.x - lp.x) < 110 && Math.abs(hp.y - lp.y) < 32) overlaps = true;
        });
        if (overlaps) return;

        labelPositions.push({ x: hp.x, y: hp.y });
        labelledCount++;

        var cityName = hp.city || (hp.zip3 + ' ' + (hp.state || ''));
        if (cityName.length > 14) cityName = cityName.substring(0, 13) + '.';
        var impText = formatNum(hp.imp);
        var isTop = hp.idx < 8;

        // Background pill — scaled for 4K
        var pillW = isTop ? 140 : 110;
        var pillH = isTop ? 36 : 28;
        var pillX = hp.x + (isTop ? 14 : 10);
        var pillY = hp.y - pillH / 2;

        // Connector line
        ctx.beginPath();
        ctx.moveTo(hp.x + 4, hp.y);
        ctx.lineTo(pillX, hp.y);
        ctx.strokeStyle = 'rgba(' + hp.r + ',' + hp.g + ',' + hp.b + ',0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = hexToRgba(BRAND.surface, 0.88);
        ctx.strokeStyle = 'rgba(' + hp.r + ',' + hp.g + ',' + hp.b + ',0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, pillX, pillY, pillW, pillH, 5);
        ctx.fill();
        ctx.stroke();

        // City name
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = (isTop ? "700 14px" : "600 12px") + " 'Space Grotesk', sans-serif";
        ctx.fillStyle = 'rgb(' + hp.r + ',' + hp.g + ',' + hp.b + ')';
        ctx.fillText(cityName, pillX + 6, pillY + pillH / 2 - (isTop ? 5 : 3));

        // Impression count
        if (isTop) {
          ctx.font = "500 11px 'IBM Plex Mono', monospace";
          ctx.fillStyle = BRAND.text2;
          ctx.fillText(impText + ' imp', pillX + 6, pillY + pillH / 2 + 8);
        } else {
          ctx.textAlign = 'right';
          ctx.font = "500 10px 'IBM Plex Mono', monospace";
          ctx.fillStyle = BRAND.text3;
          ctx.fillText(impText, pillX + pillW - 6, pillY + pillH / 2);
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
      // Draw faint path guides first (for visual clarity)
      ctx.globalAlpha = 0.08;
      mapParticles.slice(0, 15).forEach(function(p) {
        if (p.age < p.delay) return;
        var dc = dcPositions[p.dc % dcPositions.length];
        var target = topCenters[p.target % topCenters.length];
        if (!dc || !target) return;

        var dist = Math.sqrt(Math.pow(target.x - dc.x, 2) + Math.pow(target.y - dc.y, 2));
        var arcHeight = Math.min(50, dist * 0.15);
        var mx = (dc.x + target.x) / 2;
        var my = (dc.y + target.y) / 2 - arcHeight;

        // Draw the full arc path
        ctx.beginPath();
        for (var pathT = 0; pathT <= 1; pathT += 0.05) {
          var pathIt = 1 - pathT;
          var pathPx = pathIt * pathIt * dc.x + 2 * pathIt * pathT * mx + pathT * pathT * target.x;
          var pathPy = pathIt * pathIt * dc.y + 2 * pathIt * pathT * my + pathT * pathT * target.y;
          if (pathT === 0) ctx.moveTo(pathPx, pathPy);
          else ctx.lineTo(pathPx, pathPy);
        }
        ctx.strokeStyle = BRAND.cyan;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      ctx.globalAlpha = 1.0;

      mapParticles.forEach(function (p) {
        p.age = (p.age || 0) + 1;
        if (p.age < (p.delay || 0)) return; // stagger initial appearance

        var prevT = p.t;
        p.t += p.speed * (p.type === 'fast' ? 1.5 : 1);
        if (p.t > 1) {
          // Create burst effect at arrival
          if (prevT < 1) {
            var dc = dcPositions[p.dc % dcPositions.length];
            var target = topCenters[p.target % topCenters.length];
            if (target) {
              mapBursts.push({
                x: target.x,
                y: target.y,
                born: now,
                color: p.type === 'fast' ? BRAND.pink : BRAND.cyan
              });
            }
          }
          p.t = -Math.random() * 0.2; // random pause before next arc
          p.dc = Math.floor(Math.random() * dcPositions.length);
          p.target = Math.floor(Math.random() * Math.min(topCenters.length, 10));
          p.speed = 0.003 + Math.random() * 0.006;
          p.type = Math.random() > 0.7 ? 'fast' : 'normal';
          p.size = 1 + Math.random() * 2;
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

        // Color variety based on particle type
        var particleColor = p.type === 'fast' ? BRAND.pink : BRAND.cyan;

        // Longer gradient trail behind the particle (10 trail dots for fluid motion)
        var trailLength = p.type === 'fast' ? 8 : 12;
        for (var trail = trailLength; trail >= 0; trail--) {
          var tt = Math.max(0, raw - trail * 0.015);
          var easedT = 1 - Math.pow(1 - tt, 3);
          var iit = 1 - easedT;
          var tpx = iit * iit * dc.x + 2 * iit * easedT * mx + easedT * easedT * target.x;
          var tpy = iit * iit * dc.y + 2 * iit * easedT * my + easedT * easedT * target.y;
          var trailAlpha = (0.5 - trail * 0.04) * fadeAlpha;
          var trailSize = (2.5 - trail * 0.15) * p.size;
          ctx.beginPath();
          ctx.arc(tpx, tpy, Math.max(0.5, trailSize), 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(particleColor, Math.max(0.01, trailAlpha));
          ctx.fill();
        }

        // Main particle with size variation
        ctx.beginPath();
        ctx.arc(px, py, 2.5 * p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(particleColor, 0.85 * fadeAlpha);
        ctx.fill();

        // Enhanced glow around particle
        var glowSize = 8 * p.size;
        ctx.beginPath();
        ctx.arc(px, py, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(particleColor, 0.1 * fadeAlpha);
        ctx.fill();

        // Bright center core
        ctx.beginPath();
        ctx.arc(px, py, 1.2 * p.size, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#ffffff', 0.6 * fadeAlpha);
        ctx.fill();
      });

      // Draw GCP data center markers — official Google Cloud icon
      dcPositions.forEach(function (dc) {
        var iconSize = 40; // icon render size (4K scale)

        // Large outer glow
        var dcGlow = ctx.createRadialGradient(dc.x, dc.y, 0, dc.x, dc.y, 50);
        dcGlow.addColorStop(0, hexToRgba('#4285F4', 0.2));
        dcGlow.addColorStop(0.3, hexToRgba('#4285F4', 0.08));
        dcGlow.addColorStop(0.7, hexToRgba('#4285F4', 0.02));
        dcGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = dcGlow;
        ctx.fillRect(dc.x - 50, dc.y - 50, 100, 100);

        // Double animated pulse rings
        var dcP1 = (now / 3000) % 1;
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, iconSize * 0.6 + dcP1 * 24, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba('#4285F4', (1 - dcP1) * 0.3);
        ctx.lineWidth = 2;
        ctx.stroke();

        var dcP2 = ((now / 3000) + 0.5) % 1;
        ctx.beginPath();
        ctx.arc(dc.x, dc.y, iconSize * 0.6 + dcP2 * 24, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba('#4285F4', (1 - dcP2) * 0.15);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw official Google Cloud icon (preloaded PNG)
        if (gcpIconImg) {
          ctx.drawImage(gcpIconImg, dc.x - iconSize / 2, dc.y - iconSize / 2, iconSize, iconSize);
        } else {
          // Fallback: colored circle with "GCP" text
          ctx.beginPath();
          ctx.arc(dc.x, dc.y, iconSize * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#4285F4';
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = "700 12px 'Space Grotesk', sans-serif";
          ctx.fillStyle = '#ffffff';
          ctx.fillText('GCP', dc.x, dc.y);
        }

        // Region label below icon
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = "700 14px 'Space Grotesk', sans-serif";
        ctx.fillStyle = '#ffffff';
        ctx.fillText(dc.id, dc.x, dc.y + iconSize / 2 + 6);
        ctx.font = "600 12px 'IBM Plex Mono', monospace";
        ctx.fillStyle = hexToRgba('#4285F4', 0.85);
        ctx.fillText(dc.label + ' REGION', dc.x, dc.y + iconSize / 2 + 22);
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

    // ── Particle arrival bursts — expanding rings when particles reach destinations ──
    mapBursts = mapBursts.filter(function(burst) {
      var age = (now - burst.born) / 1000; // 0..1 over 1 second
      if (age > 1) return false;

      // Triple expanding rings
      for (var ring = 0; ring < 3; ring++) {
        var ringPhase = (age - ring * 0.15);
        if (ringPhase < 0 || ringPhase > 1) continue;
        var ringR = 8 + ringPhase * 40;
        var ringAlpha = (1 - ringPhase) * 0.4;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(burst.color, ringAlpha);
        ctx.lineWidth = 2 - ringPhase;
        ctx.stroke();
      }

      // Flash at center
      if (age < 0.3) {
        var flashAlpha = (0.3 - age) / 0.3;
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba('#ffffff', flashAlpha * 0.6);
        ctx.fill();
      }

      return true;
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
      var floatY = evy - 24 - age * 30;
      var textAlpha = age < 0.15 ? age / 0.15 : (1 - age) * 0.9;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "600 14px 'IBM Plex Mono', monospace";
      ctx.fillStyle = hexToRgba(ev.type === 'up' ? BRAND.green : BRAND.pink, textAlpha);
      ctx.fillText(ev.value, evx + 14, floatY);
    });

    // ── Per-state data callouts on top 6 (reduced clutter) — 4K scaled ──
    topStates.slice(0, 6).forEach(function (entry, idx) {
      var stId = entry[0];
      var stData = entry[1];
      var stDef = US.states.find(function (s) { return s.id === stId; });
      if (!stDef) return;

      var cxy = US.project(stDef.center[0], stDef.center[1]);
      var cx = mapX + cxy[0] * mapW;
      var cy = mapY + cxy[1] * mapH;

      // Larger callouts for CA, TX, FL, NY
      var isBig = ['CA','TX','FL','NY'].indexOf(stId) !== -1;
      var cardW = isBig ? 120 : 96;
      var cardH = isBig ? 70 : 56;
      var offY = -32 - (isBig ? 8 : 0);

      // Card background with stronger presence
      ctx.fillStyle = hexToRgba(BRAND.surface, 0.9);
      ctx.strokeStyle = hexToRgba(BRAND.pink, 0.4);
      ctx.lineWidth = 1.5;
      roundRect(ctx, cx - cardW / 2, cy + offY - cardH, cardW, cardH, 6);
      ctx.fill();
      ctx.stroke();

      // Top accent stripe
      var callGrad = ctx.createLinearGradient(cx - cardW / 2, cy + offY - cardH, cx + cardW / 2, cy + offY - cardH);
      callGrad.addColorStop(0, hexToRgba(BRAND.pink, 0.6));
      callGrad.addColorStop(1, hexToRgba(BRAND.hotPink, 0.2));
      ctx.fillStyle = callGrad;
      ctx.fillRect(cx - cardW / 2 + 2, cy + offY - cardH + 2, cardW - 4, 3);

      // State abbrev (bold)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = (isBig ? "700 20px" : "700 16px") + " 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(stId, cx, cy + offY - cardH + 8);

      // Impressions
      ctx.font = (isBig ? "600 16px" : "600 13px") + " 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(stData.impressions), cx, cy + offY - cardH + (isBig ? 30 : 26));

      // Bids
      ctx.font = (isBig ? "500 13px" : "500 11px") + " 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.cyan;
      ctx.fillText(formatNum(stData.bids) + ' bids', cx, cy + offY - cardH + (isBig ? 48 : 40));

      // Connector line from card to state center
      ctx.beginPath();
      ctx.moveTo(cx, cy + offY - 2);
      ctx.lineTo(cx, cy - 6);
      ctx.strokeStyle = hexToRgba(BRAND.pink, 0.25);
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ── Scanning radar effect from data centers for dynamic motion ──
    dcPositions.forEach(function (dc) {
      var scanPhase = ((now / 4000) + dcPositions.indexOf(dc) * 0.33) % 1;
      var scanRadius = scanPhase * Math.max(mapW, mapH) * 0.7;

      // Expanding scan ring
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, scanRadius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba('#4285F4', (1 - scanPhase) * 0.15);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Secondary scan ring
      var scan2Phase = (scanPhase + 0.5) % 1;
      var scan2Radius = scan2Phase * Math.max(mapW, mapH) * 0.7;
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, scan2Radius, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba('#4285F4', (1 - scan2Phase) * 0.08);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // ── Richer regional panels — 4K scaled ──
    var panelW = 220;
    var panelH = 150;
    var regionLayout = {
      west:    { x: 12,                y: mapY + mapH * 0.30 },
      central: { x: mapX + (mapW - panelW) / 2, y: h - panelH - 10 },
      east:    { x: mapX + mapW - panelW + 40,   y: mapY + mapH * 0.30 },
    };
    var regionLabels = { west: 'WEST', central: 'CENTRAL', east: 'EAST' };

    Object.entries(regions).forEach(function (entry) {
      var key = entry[0];
      var reg = entry[1];
      var pos = regionLayout[key];
      if (!pos) return;

      ctx.fillStyle = hexToRgba(BRAND.surface, 0.8);
      ctx.strokeStyle = hexToRgba(BRAND.border, 0.5);
      ctx.lineWidth = 1.5;
      roundRect(ctx, pos.x, pos.y, panelW, panelH, 8);
      ctx.fill();
      ctx.stroke();

      var accent = ctx.createLinearGradient(pos.x, pos.y, pos.x + panelW, pos.y);
      accent.addColorStop(0, hexToRgba(BRAND.pink, 0.6));
      accent.addColorStop(1, hexToRgba(BRAND.hotPink, 0.6));
      roundRectTop(ctx, pos.x, pos.y, panelW, 4, 8);
      ctx.fillStyle = accent;
      ctx.fill();

      var pcx = pos.x + panelW / 2;

      // Region label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 14px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(regionLabels[key], pcx, pos.y + 10);

      // Impressions — big number
      ctx.font = "700 28px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(reg.impressions), pcx, pos.y + 28);

      // Bids + campaigns
      ctx.font = "600 14px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.text2;
      ctx.fillText(formatNum(reg.bids) + ' bids', pcx - 38, pos.y + 64);

      ctx.fillStyle = BRAND.cyan;
      ctx.fillText((reg.campaigns || 0) + ' svc', pcx + 38, pos.y + 64);

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
        drawMiniSparkline(ctx, regionSpark, pos.x + 14, pos.y + 86, panelW - 28, 48, BRAND.pink);
      }
    });

    // ── Leaderboard sidebar (right side) — 4K scaled ──
    var lbX = w - leaderboardW - 6;
    var lbY = 100;
    var lbEntryH = 42;
    var lbCount = Math.min(15, sorted.length);

    // Leaderboard header
    ctx.fillStyle = hexToRgba(BRAND.surface, 0.75);
    roundRect(ctx, lbX, lbY - 34, leaderboardW, 30, 6);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.4);
    ctx.lineWidth = 1;
    roundRect(ctx, lbX, lbY - 34, leaderboardW, 30, 6);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "600 15px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text2;
    ctx.fillText('TOP STATES', lbX + leaderboardW / 2, lbY - 19);

    // Auto-scroll: offset based on time
    var scrollOffset = Math.floor((now / 3500) % Math.max(1, lbCount - 8));
    var visibleCount = Math.min(lbCount, Math.floor((h - lbY - 50) / lbEntryH));

    for (var li = 0; li < visibleCount; li++) {
      var si2 = (li + scrollOffset) % lbCount;
      var lEntry = sorted[si2];
      if (!lEntry) continue;
      var leY = lbY + li * lbEntryH;

      // Background bar
      var impRatio = lEntry[1].impressions / maxImp;
      var barWidth = impRatio * (leaderboardW - 80);

      ctx.fillStyle = hexToRgba(BRAND.surface, 0.55);
      roundRect(ctx, lbX, leY, leaderboardW, lbEntryH - 5, 5);
      ctx.fill();

      // Progress bar
      ctx.fillStyle = hexToRgba(BRAND.pink, 0.15);
      roundRect(ctx, lbX, leY, 80 + barWidth, lbEntryH - 5, 5);
      ctx.fill();

      // Rank
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = "600 14px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('#' + (si2 + 1), lbX + 32, leY + lbEntryH / 2 - 3);

      // State name
      ctx.textAlign = 'left';
      ctx.font = "700 16px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(lEntry[0], lbX + 40, leY + lbEntryH / 2 - 3);

      // Impressions value
      ctx.textAlign = 'right';
      ctx.font = "600 14px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.pink;
      ctx.fillText(formatNum(lEntry[1].impressions), lbX + leaderboardW - 60, leY + lbEntryH / 2 - 3);

      // Bids value
      ctx.font = "500 12px 'IBM Plex Mono', monospace";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(formatNum(lEntry[1].bids), lbX + leaderboardW - 8, leY + lbEntryH / 2 - 3);
    }

    // ── Top header: animated counter — 4K scaled ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var headerCx = (w - leaderboardW) * 0.5;

    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('CAMPAIGN DELIVERY  \u00B7  NATIONWIDE REACH', headerCx, 8);

    // Animated count-up for total impressions
    var targetImp = totals.impressions || 0;
    if (!mapPrevTotals.impressions) mapPrevTotals.impressions = targetImp;
    var displayImp = mapPrevTotals.impressions + (targetImp - mapPrevTotals.impressions) * 0.1;
    mapPrevTotals.impressions = displayImp;

    ctx.font = "700 44px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text1;
    ctx.fillText(formatNum(Math.round(displayImp)) + ' impressions', headerCx, 30);

    ctx.font = "500 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text2;
    ctx.fillText(formatNum(totals.bids || 0) + ' bids  \u00B7  ' + (totals.campaigns || 0) + ' active services', headerCx, 78);

    // ── Color scale legend (bottom-left of map area) — 4K scaled ──
    var legX = mapX;
    var legY = h - 28;
    var legW = 200;
    var legH = 12;
    var lgr = ctx.createLinearGradient(legX, 0, legX + legW, 0);
    lgr.addColorStop(0, activityColor(0).css);
    lgr.addColorStop(0.25, activityColor(0.25).css);
    lgr.addColorStop(0.5, activityColor(0.5).css);
    lgr.addColorStop(0.75, activityColor(0.75).css);
    lgr.addColorStop(1, activityColor(1).css);
    roundRect(ctx, legX, legY, legW, legH, 6);
    ctx.fillStyle = lgr;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = "500 13px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('Low', legX, legY - 3);
    ctx.textAlign = 'right';
    ctx.fillText('High', legX + legW, legY - 3);
    ctx.textAlign = 'center';
    ctx.fillText('IMPRESSIONS', legX + legW / 2, legY - 3);

    // Bubble legend
    ctx.textAlign = 'left';
    ctx.fillStyle = BRAND.text3;
    ctx.font = "500 13px 'Space Grotesk', sans-serif";
    ctx.fillText('\u25CB = bid volume', legX + legW + 18, legY + 8);
  }

  // ===========================================================================
  // SECURITY SCORECARD — Full-page VulnTrack visualization
  // ===========================================================================
  function securityScorecard(canvas, data) {
    var s = setup(canvas);
    var ctx = s.ctx, w = s.w, h = s.h;
    var now = Date.now();

    // ── Background — brand deep purple ──
    ctx.fillStyle = BRAND.deep;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid overlay using brand border color
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.12);
    ctx.lineWidth = 0.5;
    for (var gx = 0; gx < w; gx += 80) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (var gy = 0; gy < h; gy += 80) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // ── Layout zones — scaled for 4K TV ──
    var padX = 48, padY = 24;
    var colGap = 36, rowGap = 24;

    // Title header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = "600 20px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('SECURITY POSTURE  \u00B7  VULNTRACK', w * 0.5, 10);

    // ─── Column 1: Left — Severity Ring + Key Stats ───
    var c1x = padX;
    var c1w = w * 0.28;

    // Severity donut ring — large for TV readability
    var ringCx = c1x + c1w * 0.5;
    var ringCy = padY + 200;
    var ringR = Math.min(140, c1w * 0.42);
    var ringThick = 32;

    var total = (data.criticalOpen || 0) + (data.highOpen || 0) + (data.mediumOpen || 0) + (data.lowOpen || 0);
    var slices = [
      { val: data.criticalOpen || 0, color: BRAND.red, label: 'CRITICAL' },
      { val: data.highOpen || 0,     color: BRAND.amber, label: 'HIGH' },
      { val: data.mediumOpen || 0,   color: '#E8A838', label: 'MEDIUM' },
      { val: data.lowOpen || 0,      color: BRAND.green, label: 'LOW' },
    ];

    // Draw outer glow — brand pink tint
    var ringGlow = ctx.createRadialGradient(ringCx, ringCy, ringR - 20, ringCx, ringCy, ringR + 50);
    ringGlow.addColorStop(0, hexToRgba(BRAND.pink, 0.06));
    ringGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = ringGlow;
    ctx.fillRect(ringCx - ringR - 50, ringCy - ringR - 50, (ringR + 50) * 2, (ringR + 50) * 2);

    // Background ring track
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.arc(ringCx, ringCy, ringR - ringThick, Math.PI * 2, 0, true);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(BRAND.border, 0.3);
    ctx.fill();

    // Draw donut slices
    var startAngle = -Math.PI / 2;
    slices.forEach(function(sl) {
      if (sl.val <= 0 || total <= 0) return;
      var sweep = (sl.val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, startAngle, startAngle + sweep);
      ctx.arc(ringCx, ringCy, ringR - ringThick, startAngle + sweep, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = sl.color;
      ctx.fill();

      // Segment separator
      ctx.strokeStyle = BRAND.deep;
      ctx.lineWidth = 3;
      ctx.stroke();

      startAngle += sweep;
    });

    // Center text — open findings count
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "700 64px 'Orbitron', monospace";
    ctx.fillStyle = BRAND.text1;
    ctx.fillText(String(data.openFindings || 0), ringCx, ringCy - 12);
    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('OPEN FINDINGS', ringCx, ringCy + 30);

    // Severity legend below ring — 2x2 grid
    var legY = ringCy + ringR + 32;
    var legColW = c1w * 0.48;
    slices.forEach(function(sl, i) {
      var lx = c1x + (i % 2) * legColW;
      var ly = legY + Math.floor(i / 2) * 52;

      // Color dot
      ctx.beginPath();
      ctx.arc(lx + 12, ly + 10, 7, 0, Math.PI * 2);
      ctx.fillStyle = sl.color;
      ctx.fill();

      // Label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = "500 16px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text2;
      ctx.fillText(sl.label, lx + 26, ly + 10);

      // Value
      ctx.font = "700 28px 'Orbitron', monospace";
      ctx.fillStyle = sl.color;
      ctx.fillText(String(sl.val), lx + 26, ly + 36);
    });

    // ── Key stat cards below severity legend ──
    var cardY = legY + 124;
    var cardW = c1w * 0.47;
    var cardH = 90;
    var keyCards = [
      { label: 'EXPLOITABLE', value: data.exploitableOpen || 0, color: BRAND.red },
      { label: 'RUNTIME', value: data.runtimeFindings || 0, color: BRAND.amber },
      { label: 'THREATS', value: (data.threats && data.threats.open) || 0, color: BRAND.hotPink },
      { label: 'SECRETS', value: (data.secrets && data.secrets.open) || 0, color: BRAND.pink },
    ];

    keyCards.forEach(function(kc, i) {
      var kx = c1x + (i % 2) * (cardW + colGap * 0.4);
      var ky = cardY + Math.floor(i / 2) * (cardH + 14);

      // Card bg — brand surface
      ctx.fillStyle = BRAND.surface;
      ctx.strokeStyle = hexToRgba(kc.color, 0.25);
      ctx.lineWidth = 1.5;
      roundRect(ctx, kx, ky, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Top accent line — gradient
      var accentGrad = ctx.createLinearGradient(kx, ky, kx + cardW, ky);
      accentGrad.addColorStop(0, hexToRgba(kc.color, 0.8));
      accentGrad.addColorStop(1, hexToRgba(kc.color, 0.2));
      ctx.fillStyle = accentGrad;
      ctx.fillRect(kx + 2, ky + 2, cardW - 4, 3);

      // Label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = "600 14px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(kc.label, kx + 14, ky + 14);

      // Value
      ctx.font = "700 38px 'Orbitron', monospace";
      ctx.fillStyle = kc.color;
      ctx.fillText(String(kc.value), kx + 14, ky + 38);
    });

    // ─── Column 2: Center — Trend Chart + Source Breakdown ───
    var c2x = c1x + c1w + colGap;
    var c2w = w * 0.40;

    // Open findings trend chart
    var trendY = padY + 56;
    var trendH = 240;
    var trendW = c2w;

    // Label
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('OPEN FINDINGS TREND (30d)', c2x, trendY - 28);

    // Chart background — brand surface
    ctx.fillStyle = BRAND.surface;
    roundRect(ctx, c2x, trendY, trendW, trendH, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.5);
    ctx.lineWidth = 1;
    roundRect(ctx, c2x, trendY, trendW, trendH, 8);
    ctx.stroke();

    var hist = data.openHistory || [];
    if (hist.length > 1) {
      var tMin = Math.min.apply(null, hist) * 0.95;
      var tMax = Math.max.apply(null, hist) * 1.05;
      var tRange = tMax - tMin || 1;
      var tPadX = 16, tPadY = 20;
      var chartW = trendW - tPadX * 2;
      var chartH = trendH - tPadY * 2;

      // Grid lines
      ctx.strokeStyle = hexToRgba(BRAND.border, 0.3);
      ctx.lineWidth = 0.5;
      for (var gi = 0; gi <= 4; gi++) {
        var gy2 = trendY + tPadY + (gi / 4) * chartH;
        ctx.beginPath(); ctx.moveTo(c2x + tPadX, gy2); ctx.lineTo(c2x + tPadX + chartW, gy2); ctx.stroke();
        // Y-axis label
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = "500 13px 'IBM Plex Mono', monospace";
        ctx.fillStyle = BRAND.text3;
        ctx.fillText(String(Math.round(tMax - (gi / 4) * tRange)), c2x + tPadX - 6, gy2);
      }

      // Area fill gradient — brand pink
      ctx.beginPath();
      hist.forEach(function(v, i) {
        var px = c2x + tPadX + (i / (hist.length - 1)) * chartW;
        var py = trendY + tPadY + (1 - (v - tMin) / tRange) * chartH;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.lineTo(c2x + tPadX + chartW, trendY + tPadY + chartH);
      ctx.lineTo(c2x + tPadX, trendY + tPadY + chartH);
      ctx.closePath();
      var areaGrad = ctx.createLinearGradient(0, trendY, 0, trendY + trendH);
      areaGrad.addColorStop(0, hexToRgba(BRAND.pink, 0.2));
      areaGrad.addColorStop(1, hexToRgba(BRAND.pink, 0.02));
      ctx.fillStyle = areaGrad;
      ctx.fill();

      // Line — brand pink
      ctx.beginPath();
      hist.forEach(function(v, i) {
        var px = c2x + tPadX + (i / (hist.length - 1)) * chartW;
        var py = trendY + tPadY + (1 - (v - tMin) / tRange) * chartH;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = BRAND.pink;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Endpoint dot with pulse — brand hotPink
      var lastV = hist[hist.length - 1];
      var lastPx = c2x + tPadX + chartW;
      var lastPy = trendY + tPadY + (1 - (lastV - tMin) / tRange) * chartH;
      var pulse = ((now / 1500) % 1);
      ctx.beginPath();
      ctx.arc(lastPx, lastPy, 4 + pulse * 10, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(BRAND.hotPink, (1 - pulse) * 0.3);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lastPx, lastPy, 5, 0, Math.PI * 2);
      ctx.fillStyle = BRAND.hotPink;
      ctx.fill();
    }

    // ── Source breakdown horizontal bars ──
    var srcY = trendY + trendH + 40;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('FINDINGS BY SOURCE', c2x, srcY);
    srcY += 32;

    var sources = data.bySource || {};
    var srcEntries = Object.entries(sources).sort(function(a, b) { return b[1] - a[1]; });
    var srcMax = srcEntries.length > 0 ? srcEntries[0][1] : 1;
    var srcColors = [BRAND.pink, BRAND.hotPink, BRAND.cyan, BRAND.amber, BRAND.green, BRAND.red];
    var srcBarH = 34;
    var srcBarGap = 10;
    var srcLabelW = 160;

    srcEntries.forEach(function(entry, i) {
      var srcName = entry[0];
      var srcVal = entry[1];
      var sy = srcY + i * (srcBarH + srcBarGap);
      var barPct = srcVal / srcMax;
      var barMaxW = c2w - srcLabelW - 80;
      var barW = barPct * barMaxW;
      var color = srcColors[i % srcColors.length];

      // Label
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = "600 16px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text2;
      ctx.fillText(srcName, c2x, sy + srcBarH * 0.5);

      // Bar track
      ctx.fillStyle = hexToRgba(BRAND.border, 0.3);
      roundRect(ctx, c2x + srcLabelW, sy + 4, barMaxW, srcBarH - 8, 4);
      ctx.fill();

      // Bar fill with gradient
      if (barW > 3) {
        var barGrad = ctx.createLinearGradient(c2x + srcLabelW, 0, c2x + srcLabelW + barW, 0);
        barGrad.addColorStop(0, hexToRgba(color, 0.9));
        barGrad.addColorStop(1, hexToRgba(color, 0.5));
        ctx.fillStyle = barGrad;
        roundRect(ctx, c2x + srcLabelW, sy + 4, barW, srcBarH - 8, 4);
        ctx.fill();
      }

      // Value
      ctx.textAlign = 'right';
      ctx.font = "700 18px 'Orbitron', monospace";
      ctx.fillStyle = color;
      ctx.fillText(String(srcVal), c2x + c2w - 4, sy + srcBarH * 0.5);
    });

    // ── Resolution metrics below source bars ──
    var statY = srcY + srcEntries.length * (srcBarH + srcBarGap) + 32;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('RESOLUTION METRICS', c2x, statY);
    statY += 32;

    var resolved = data.resolvedFindings || 0;
    var totalF = data.totalFindings || 1;
    var resolvedPct = Math.round((resolved / totalF) * 100);
    var fixPct = data.fixAvailablePct || 0;
    var mttr = data.mttr;

    var resCards = [
      { label: 'RESOLVED', value: resolvedPct + '%', sub: resolved + ' / ' + totalF, color: BRAND.green },
      { label: 'FIX AVAILABLE', value: fixPct + '%', sub: 'of open findings', color: BRAND.cyan },
      { label: 'MTTR', value: mttr != null ? mttr.toFixed(1) + 'd' : '\u2014', sub: 'mean time to resolve', color: BRAND.pink },
    ];

    var rcW = (c2w - colGap * 2) / 3;
    var rcH = 90;
    resCards.forEach(function(rc, i) {
      var rx = c2x + i * (rcW + colGap);

      ctx.fillStyle = BRAND.surface;
      ctx.strokeStyle = hexToRgba(rc.color, 0.2);
      ctx.lineWidth = 1.5;
      roundRect(ctx, rx, statY, rcW, rcH, 8);
      ctx.fill();
      ctx.stroke();

      // Top accent gradient
      var rcGrad = ctx.createLinearGradient(rx, statY, rx + rcW, statY);
      rcGrad.addColorStop(0, hexToRgba(rc.color, 0.6));
      rcGrad.addColorStop(1, hexToRgba(rc.color, 0.1));
      ctx.fillStyle = rcGrad;
      ctx.fillRect(rx + 2, statY + 2, rcW - 4, 3);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 14px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(rc.label, rx + rcW * 0.5, statY + 12);

      ctx.font = "700 36px 'Orbitron', monospace";
      ctx.fillStyle = rc.color;
      ctx.fillText(rc.value, rx + rcW * 0.5, statY + 30);

      ctx.font = "500 13px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(rc.sub, rx + rcW * 0.5, statY + 70);
    });

    // ─── Column 3: Right — Team Risk Ranking ───
    var c3x = c2x + c2w + colGap;
    var c3w = w - c3x - padX;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = "600 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = BRAND.text3;
    ctx.fillText('TEAM RISK RANKING', c3x, padY + 34);

    var teams = data.topRiskTeams || [];
    var teamY = padY + 66;
    var teamH = 110;
    var teamGap = 14;

    teams.forEach(function(team, i) {
      var ty = teamY + i * (teamH + teamGap);
      if (ty + teamH > h - 80) return; // don't overflow into bottom bar

      // Card background — brand surface
      ctx.fillStyle = BRAND.surface;
      var riskColor = team.riskScore >= 60 ? BRAND.red
                    : team.riskScore >= 40 ? BRAND.amber
                    : team.riskScore >= 20 ? '#E8A838'
                    : BRAND.green;
      ctx.strokeStyle = hexToRgba(riskColor, 0.3);
      ctx.lineWidth = 1.5;
      roundRect(ctx, c3x, ty, c3w, teamH, 8);
      ctx.fill();
      ctx.stroke();

      // Left accent bar
      ctx.fillStyle = hexToRgba(riskColor, 0.7);
      roundRect(ctx, c3x + 2, ty + 8, 4, teamH - 16, 2);
      ctx.fill();

      // Rank number
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = "700 16px 'Orbitron', monospace";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('#' + (i + 1), c3x + 16, ty + 12);

      // Team name
      ctx.font = "700 22px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text1;
      ctx.fillText(team.name, c3x + 16, ty + 34);

      // Risk score bar
      var rsBarX = c3x + 16;
      var rsBarY = ty + 68;
      var rsBarW = c3w - 32;
      var rsBarH = 10;

      ctx.fillStyle = hexToRgba(BRAND.border, 0.4);
      roundRect(ctx, rsBarX, rsBarY, rsBarW, rsBarH, 5);
      ctx.fill();

      var rsFill = (team.riskScore / 100) * rsBarW;
      if (rsFill > 3) {
        var rsFillGrad = ctx.createLinearGradient(rsBarX, 0, rsBarX + rsFill, 0);
        rsFillGrad.addColorStop(0, riskColor);
        rsFillGrad.addColorStop(1, hexToRgba(riskColor, 0.5));
        ctx.fillStyle = rsFillGrad;
        roundRect(ctx, rsBarX, rsBarY, rsFill, rsBarH, 5);
        ctx.fill();
      }

      // Score value — right aligned
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = "700 24px 'Orbitron', monospace";
      ctx.fillStyle = riskColor;
      ctx.fillText(String(team.riskScore), c3x + c3w - 16, ty + 12);

      // Trend indicator
      var trendIcon = team.trend === 'improving' ? '\u25BC' : team.trend === 'declining' ? '\u25B2' : '\u25B8';
      var trendColor = team.trend === 'improving' ? BRAND.green : team.trend === 'declining' ? BRAND.red : BRAND.amber;
      ctx.font = "600 16px sans-serif";
      ctx.fillStyle = trendColor;
      ctx.fillText(trendIcon, c3x + c3w - 50, ty + 16);

      // Open findings count
      ctx.textAlign = 'left';
      ctx.font = "600 16px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text2;
      ctx.fillText(team.openFindings + ' open', c3x + 16, ty + 86);

      // Risk score label
      ctx.textAlign = 'right';
      ctx.font = "500 14px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText('risk score', c3x + c3w - 16, ty + 86);
    });

    // ── Status summary bar at bottom ──
    var botH = 70;
    var botY = h - botH;
    ctx.fillStyle = hexToRgba(BRAND.surface, 0.9);
    ctx.fillRect(0, botY, w, botH);
    ctx.strokeStyle = hexToRgba(BRAND.border, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, botY); ctx.lineTo(w, botY); ctx.stroke();

    var statItems = [
      { label: 'TOTAL FINDINGS', value: String(data.totalFindings || 0), color: BRAND.text1 },
      { label: 'OPEN', value: String(data.openFindings || 0), color: BRAND.amber },
      { label: 'RESOLVED', value: String(data.resolvedFindings || 0), color: BRAND.green },
      { label: 'CRITICAL', value: String(data.criticalOpen || 0), color: BRAND.red },
      { label: 'HIGH', value: String(data.highOpen || 0), color: BRAND.amber },
      { label: 'EXPLOITABLE', value: String(data.exploitableOpen || 0), color: BRAND.red },
      { label: 'THREATS', value: String((data.threats && data.threats.open) || 0), color: BRAND.hotPink },
      { label: 'SECRETS', value: String((data.secrets && data.secrets.open) || 0), color: BRAND.pink },
    ];

    var statSpacing = w / statItems.length;
    statItems.forEach(function(si, i) {
      var sx = statSpacing * i + statSpacing * 0.5;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "600 14px 'Space Grotesk', sans-serif";
      ctx.fillStyle = BRAND.text3;
      ctx.fillText(si.label, sx, botY + 10);

      ctx.font = "700 28px 'Orbitron', monospace";
      ctx.fillStyle = si.color;
      ctx.fillText(si.value, sx, botY + 30);
    });

    // ── Animated scan line effect — brand pink ──
    var scanY2 = (now / 8000 * h) % h;
    var scanGrad = ctx.createLinearGradient(0, scanY2 - 3, 0, scanY2 + 3);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.5, hexToRgba(BRAND.pink, 0.04));
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY2 - 3, w, 6);
  }

  return { sparkline, gauge, pipeline, usaMap, securityScorecard, thresholdColor, formatNum, setup };
})();
