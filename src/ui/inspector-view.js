export function initInspectorView(app, inspectorContent) {
  let activeTab = 'amplitudes';
  let blochSubtab = 'register';

  // ------------------------------------------------------------------
  // Color: linear entropy -> arrow color (green pure, yellow entangled)
  // ------------------------------------------------------------------
  function entropyColor(sL) {
    const t = Math.min(1, Math.max(0, sL / 0.5));
    const r = Math.round(215 * t);
    const g = Math.round(230 - 44 * t);
    const b = Math.round(164 - 39 * t);
    return `rgb(${r},${g},${b})`;
  }

  function fmt(v) {
    return v.toFixed(3);
  }

  // ------------------------------------------------------------------
  // Amplitudes tab
  // ------------------------------------------------------------------
  function renderAmplitudes() {
    const amps = app.amplitudes();
    const labels = app.ketLabels();
    let html = '<table style="font-size:12px;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:2px;">State</th><th style="text-align:right;padding:2px;">Re</th><th style="text-align:right;padding:2px;">Im</th><th style="text-align:right;padding:2px;">Probability</th></tr></thead><tbody>';
    for (let i = 0; i < amps.length; i += 1) {
      const a = amps[i];
      if (a.prob > 1e-6) {
        html += `<tr><td style="padding:2px;color:var(--simqc-accent)">★${labels[i]}</td><td style="padding:2px;text-align:right">${a.re.toFixed(4)}</td><td style="padding:2px;text-align:right">${a.im.toFixed(4)}</td><td style="padding:2px;text-align:right">${a.prob.toFixed(4)}</td></tr>`;
      }
    }
    html += '</tbody></table>';
    inspectorContent.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Probabilities tab
  // ------------------------------------------------------------------
  function renderProbabilities() {
    const probs = app.probabilities();
    const labels = app.ketLabels();
    let html = '<table style="font-size:12px;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:2px;">State</th><th style="text-align:right;padding:2px;">Probability</th><th style="text-align:left;padding:2px;">Distribution</th></tr></thead><tbody>';
    for (let i = 0; i < probs.length; i += 1) {
      const p = probs[i];
      if (p > 1e-6) {
        const barW = Math.round(p * 100);
        html += `<tr><td style="padding:2px;color:var(--simqc-accent)">★${labels[i]}</td><td style="padding:2px;text-align:right">${(p * 100).toFixed(2)}%</td><td style="padding:2px"><div style="background:var(--simqc-border);height:6px;width:100px;"><div style="background:var(--simqc-accent);height:6px;width:${barW}px;"></div></div></td></tr>`;
      }
    }
    html += '</tbody></table>';
    inspectorContent.innerHTML = html;
  }

  // ------------------------------------------------------------------
  // Bloch sphere tab: per-qubit subtabs + register overview
  // ------------------------------------------------------------------
  function renderBloch() {
    const n = app.numQubits;
    inspectorContent.innerHTML = '';

    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.lineHeight = '1.5';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    title.textContent = 'Bloch Sphere';
    inspectorContent.appendChild(title);

    const strip = document.createElement('div');
    strip.style.margin = '6px 0';
    strip.style.display = 'flex';
    strip.style.gap = '6px';
    strip.style.flexWrap = 'wrap';
    const makeSub = (label, qKey, active) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.q = qKey;
      if (active) { b.classList.add('active'); }
      b.style.fontSize = '11px';
      b.style.padding = '2px 8px';
      return b;
    };
    strip.appendChild(makeSub('Register', 'register', blochSubtab === 'register'));
    for (let q = 0; q < n; q += 1) {
      strip.appendChild(makeSub(`Qubit ${q}`, String(q), blochSubtab === String(q)));
    }
    inspectorContent.appendChild(strip);

    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.margin = '8px auto';
    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 260;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    container.appendChild(canvas);
    inspectorContent.appendChild(container);

    const readout = document.createElement('div');
    readout.style.fontSize = '11px';
    readout.style.color = 'var(--simqc-text-muted)';
    readout.style.marginTop = '6px';
    readout.style.textAlign = 'center';
    inspectorContent.appendChild(readout);

    function drawSphere(cx, cy, R, v, sL, drawArrow) {
      const ctx = canvas.getContext('2d');
      // sphere outline
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.strokeStyle = 'var(--simqc-border-strong)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // equator ellipse (depth / y hint)
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // crosshair axes: x horizontal, z vertical
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'var(--simqc-text-muted)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('x', cx + R + 8, cy + 5);
      ctx.fillText('z', cx - 8, cy - R - 8);

      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (drawArrow && len > 0.02) {
        const tx = cx + v.x * R;
        const ty = cy - v.z * R;
        const color = entropyColor(sL);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        const headLen = 12;
        const dx = (tx - cx) / len;
        const dy = (ty - cy) / len;
        const px = -dy;
        const py = dx;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - headLen * dx + headLen * 0.5 * px, ty - headLen * dy + headLen * 0.5 * py);
        ctx.lineTo(tx - headLen * dx - headLen * 0.5 * px, ty - headLen * dy - headLen * 0.5 * py);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      } else if (drawArrow) {
        const color = entropyColor(sL);
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
      return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    function draw() {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(cx, cy) * 0.78;
      ctx.clearRect(0, 0, w, h);

      if (blochSubtab === 'register') {
        ctx.fillStyle = 'var(--simqc-foreground)';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`Register Overview — ${n} qubit row(s)`, cx, 24);
        let yy = 46;
        const step = 230 / Math.max(n, 1);
        for (let q = 0; q < n; q += 1) {
          const v = app.bloch(q);
          const sL = app.linearEntropy(q);
          const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
          const color = entropyColor(sL);
          const dx = 26 + q * step;
          ctx.beginPath();
          ctx.arc(dx, yy + 8, 6, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = 'var(--simqc-text-muted)';
          ctx.fillText(`q${q}`, dx, yy + 26);
          ctx.fillStyle = 'var(--simqc-foreground)';
          ctx.fillText(`|r|=${fmt(len)}  S_L=${fmt(sL)}`, dx, yy + 42);
        }
        readout.textContent = 'Register: colored dot = linear entropy (green pure → yellow entangled). |r|=1 surface, |r|=0 origin.';
      } else {
        const q = Number(blochSubtab);
        const v = app.bloch(q);
        const sL = app.linearEntropy(q);
        const len = drawSphere(cx, cy, R, v, sL, true);
        readout.textContent = `Qubit ${q}: r = (${fmt(v.x)}, ${fmt(v.y)}, ${fmt(v.z)}), |r| = ${fmt(len)}, S_L = ${fmt(sL)} (${len > 0.99 ? 'pure' : len < 0.05 ? 'maximally entangled' : 'partially entangled'})`;
      }
    }

    strip.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-q]');
      if (!b) return;
      strip.querySelectorAll('button').forEach((bb) => bb.classList.remove('active'));
      b.classList.add('active');
      blochSubtab = b.dataset.q;
      draw();
    });

    draw();
  }

  // ------------------------------------------------------------------
  // Tab inspector dispatch
  // ------------------------------------------------------------------
  function renderInspector() {
    if (!app.currentCircuit) {
      inspectorContent.textContent = 'No state yet.';
      return;
    }
    if (activeTab === 'amplitudes') {
      renderAmplitudes();
    } else if (activeTab === 'probabilities') {
      renderProbabilities();
    } else {
      blochSubtab = 'register';
      renderBloch();
    }
    app.draw();
  }

  // ------------------------------------------------------------------
  // Shot histogram bar chart
  // ------------------------------------------------------------------
  function renderShots() {
    const hist = app.sampleShots();
    const el = document.getElementById('shot-hist');
    const total = app.shots;
    el.innerHTML = '';
    if (!hist || hist.size === 0) {
      el.textContent = 'No shots sampled.';
      return;
    }
    const entries = [];
    for (const [idx, count] of hist.entries()) {
      entries.push({ index: idx, count });
    }
    entries.sort((a, b) => b.count - a.count || a.index - b.index);
    const maxBars = 64;
    const shown = entries.slice(0, maxBars);
    const restCount = entries.slice(maxBars).reduce((acc, e) => acc + e.count, 0);
    const maxCount = Math.max(...shown.map((e) => e.count), restCount || 0);

    const canvas = document.createElement('canvas');
    const barW = 34;
    const gap = 10;
    const nBars = shown.length + (restCount > 0 ? 1 : 0);
    const pad = 40;
    canvas.width = pad * 2 + nBars * (barW + gap);
    canvas.height = 220;
    canvas.style.display = 'block';
    canvas.style.margin = '6px auto';
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const ch = canvas.height - 60;
    const cy0 = canvas.height - 40;
    let x = pad;
    const drawBar = (count, label) => {
      const h = maxCount > 0 ? (count / maxCount) * ch : 0;
      ctx.fillStyle = 'var(--simqc-accent)';
      ctx.fillRect(x, cy0 - h, barW, h);
      ctx.fillStyle = 'var(--simqc-text-muted)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, cy0 + 14);
      ctx.fillText(`${count}`, x + barW / 2, cy0 - h - 6);
      x += barW + gap;
    };
    for (const e of shown) {
      drawBar(e.count, app.ketLabels()[e.index]);
    }
    if (restCount > 0) {
      drawBar(restCount, 'rest');
    }
    ctx.fillStyle = 'var(--simqc-text-muted)';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Empirical shot histogram (${total} shots)`, canvas.width / 2, 18);
  }

  // ------------------------------------------------------------------
  // Wiring
  // ------------------------------------------------------------------
  app.onInspector(() => { renderInspector(); });

  document.getElementById('tab-strip').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.tab[data-tab]');
    if (!tab) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    if (activeTab === 'bloch') { blochSubtab = 'register'; }
    renderInspector();
  });

  const shotsInput = document.getElementById('shots-input');
  shotsInput.addEventListener('change', (ev) => { app.setShots(ev.target.value); });
  document.getElementById('btn-sample').addEventListener('click', () => {
    app.simulate();
    renderShots();
  });

  return { renderInspector };
}
