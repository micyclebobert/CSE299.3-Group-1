import { theme } from './theme.js';

const MAX_BARS = 256;

export function initInspectorHistogramView(app, histEl) {
  function renderShots() {
    const hist = app.sampleShots();
    histEl.innerHTML = '';
    if (!hist) {
      histEl.textContent = 'No shots sampled.';
      return;
    }
    const labels = app.ketLabels();
    const total = app.shots;
    const size = labels.length;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = histEl.clientWidth > 0 ? histEl.clientWidth : 400;
    const cssH = 220;

    const entries = [];
    let maxCount = 0;
    for (let i = 0; i < size; i += 1) {
      const count = hist.get(i) ?? 0;
      if (count > maxCount) maxCount = count;
      entries.push({ index: i, count, label: labels[i] || `|${i}>` });
    }

    let shown = entries;
    if (size > MAX_BARS) {
      shown = entries
        .slice()
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .slice(0, MAX_BARS)
        .sort((a, b) => a.index - b.index);
    }

    const canvas = document.createElement('canvas');
    const barW = 34;
    const gap = 10;
    const pad = 40;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.display = 'block';
    canvas.style.margin = '6px auto';
    histEl.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ch = cssH - 60;
    const cy0 = cssH - 40;
    let x = pad;
    const drawBar = (count, label) => {
      const h = maxCount > 0 ? (count / maxCount) * ch : 0;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, cy0 - h, barW, h);
      ctx.fillStyle = theme.textMuted;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, cy0 + 14);
      ctx.fillText(`${count}`, x + barW / 2, cy0 - h - 6);
      x += barW + gap;
    };
    for (const e of shown) {
      drawBar(e.count, e.label);
    }
    ctx.fillStyle = theme.textMuted;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Shot histogram (${total} shots)`, cssW / 2, 18);
  }
  return { renderShots };
}
