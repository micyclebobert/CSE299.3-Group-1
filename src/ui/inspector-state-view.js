import { theme } from './theme.js';

export function entropyColor(sL) {
  const t = Math.min(1, Math.max(0, sL / 0.5));
  const r = Math.round(215 * t);
  const g = Math.round(230 - 44 * t);
  const b = Math.round(164 - 39 * t);
  return `rgb(${r},${g},${b})`;
}

export function fmt(v) {
  return v.toFixed(3);
}

export function initInspectorStateView(app, container) {
  function renderAmplitudes() {
    const amps = app.amplitudes();
    const labels = app.ketLabels();
    let html = '<table style="font-size:12px;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:2px;">State</th><th style="text-align:right;padding:2px;">Re</th><th style="text-align:right;padding:2px;">Im</th><th style="text-align:right;padding:2px;">Phase</th><th style="text-align:right;padding:2px;">Probability</th></tr></thead><tbody>';
    for (let i = 0; i < amps.length; i += 1) {
      const a = amps[i];
      if (a.prob > 1e-6) {
        html += `<tr><td style="padding:2px;color:${theme.accent}">★${labels[i]}</td><td style="padding:2px;text-align:right">${a.re.toFixed(4)}</td><td style="padding:2px;text-align:right">${a.im.toFixed(4)}</td><td style="padding:2px;text-align:right">${Math.atan2(a.im, a.re).toFixed(3)}rad</td><td style="padding:2px;text-align:right">${a.prob.toFixed(4)}</td></tr>`;
      }
    }
    html += '</tbody></table>';
    return html;
  }

  function renderProbabilities() {
    const probs = app.probabilities();
    const labels = app.ketLabels();
    let html = '<table style="font-size:12px;width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;padding:2px;">State</th><th style="text-align:right;padding:2px;">Probability</th><th style="text-align:left;padding:2px;">Distribution</th></tr></thead><tbody>';
    for (let i = 0; i < probs.length; i += 1) {
      const p = probs[i];
      if (p > 1e-6) {
        const barW = Math.round(p * 100);
        html += `<tr><td style="padding:2px;color:${theme.accent}">★${labels[i]}</td><td style="padding:2px;text-align:right">${(p * 100).toFixed(2)}%</td><td style="padding:2px"><div style="background:${theme.border};height:6px;width:100px;"><div style="background:${theme.accent};height:6px;width:${barW}px;"></div></div></td></tr>`;
      }
    }
    html += '</tbody></table>';
    return html;
  }

  function renderStateVectorChart() {
    const probs = app.probabilities();
    const labels = app.ketLabels();
    let html = '<div style="font-size:11px;color:' + theme.textMuted + ';margin:10px 0 4px 0;">State vector · probability by basis state</div>';
    html += '<canvas id="simqc-state-vector-chart" style="display:block;margin:0 auto;width:100%;height:180px;background:' + theme.panel + ';border:1px solid ' + theme.border + ';border-radius:4px;"></canvas>';
    return html;
  }

  function drawStateVectorChart() {
    const probs = app.probabilities();
    const labels = app.ketLabels();
    const canvasEl = container.querySelector ? container.querySelector('#simqc-state-vector-chart') : null;
    if (!canvasEl || !canvasEl.getContext) {
      return;
    }
    const ctx = canvasEl.getContext('2d');
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const rect = canvasEl.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : 500;
    const cssH = rect.height > 0 ? rect.height : 180;
    canvasEl.width = cssW * dpr;
    canvasEl.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    let maxProb = 0;
    for (let i = 0; i < probs.length; i += 1) {
      if (probs[i] > maxProb) {
        maxProb = probs[i];
      }
    }

    if (maxProb <= 1e-6) {
      ctx.fillStyle = theme.textMuted;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Zero state: all amplitudes ~0', cssW / 2, cssH / 2);
      return;
    }

    const entries = [];
    for (let i = 0; i < probs.length; i += 1) {
      if (probs[i] > 1e-6) {
        entries.push({ index: i, prob: probs[i] });
      }
    }
    entries.sort((a, b) => b.prob - a.prob || a.index - b.index);
    const maxBars = 64;
    const shown = entries.slice(0, maxBars);

    const pad = 40;
    const barW = Math.max(6, Math.floor((cssW - pad * 2) / Math.max(shown.length, 1)) - 4);
    const ch = cssH - 50;
    const cy0 = cssH - 30;
    let x = pad;
    for (const e of shown) {
      const h = (e.prob / maxProb) * ch;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, cy0 - h, barW, h);
      ctx.fillStyle = theme.textMuted;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(labels[e.index], x + barW / 2, cy0 + 13);
      ctx.fillText((e.prob * 100).toFixed(1) + '%', x + barW / 2, cy0 - h - 6);
      x += barW + 6;
    }
    if (shown.length === 1 && shown[0].index === 0) {
      ctx.fillStyle = theme.phaseAccent;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Only |0…0⟩ populated (probability 1.0000)', cssW / 2, 18);
    }
  }

  function renderState() {
    container.innerHTML = renderAmplitudes() + renderProbabilities() + renderStateVectorChart();
    drawStateVectorChart();
  }

  return { renderState, renderAmplitudes, renderProbabilities };
}
