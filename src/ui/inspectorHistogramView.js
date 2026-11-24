import { theme } from './theme.js';
import { StateVector } from '../core/StateVector.js';
import { sampleHistogram } from '../measurement/measurement.js';

const MAX_BARS = 256;
const MIN_BAR_W = 12;
const BAR_GAP = 6;
const CSS_H = 220;

export function initInspectorHistogramView(app, containerEl) {
  const histEl = document.createElement('div');
  histEl.style.overflowX = 'auto';
  histEl.style.width = '100%';
  histEl.style.marginTop = '8px';
  containerEl.appendChild(histEl);

  let boundary = null;

  function setBoundary(boundary_) {
    boundary = boundary_;
  }

  function sampleFrom(state, shots) {
    const sv = new StateVector(state.numQubits());
    const size = state.size();
    const re = sv.getRawRe();
    const im = sv.getRawIm();
    for (let i = 0; i < size; i += 1) {
      re[i] = state.getRe(i);
      im[i] = state.getIm(i);
    }
    return sampleHistogram(sv, shots);
  }

  function renderShots() {
    containerEl.appendChild(histEl);
    histEl.innerHTML = '';

    let shots;
    let hist;
    if (boundary && boundary.step !== undefined && typeof app.getStateAtStep === 'function') {
      const state = app.getStateAtStep(boundary.step);
      if (!state) {
        histEl.textContent = 'No state at selected step.';
        return;
      }
      shots = Number.isFinite(app.shots) ? Math.floor(app.shots) : 1024;
      hist = sampleFrom(state, shots);
    } else {
      hist = app.sampleShots ? app.sampleShots() : null;
      shots = app.shots;
      if (!hist) {
        histEl.textContent = 'No shots sampled.';
        return;
      }
    }

    const labels = app.ketLabels ? app.ketLabels() : [];
    const size = labels.length;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = histEl.clientWidth > 0 ? histEl.clientWidth : 400;

    const entries = [];
    let maxCount = 0;
    for (let i = 0; i < size; i += 1) {
      const count = hist.get(i) ?? 0;
      if (count > maxCount) maxCount = count;
      entries.push({ index: i, count, label: labels[i] || `|${i}>` });
    }

    let shown = entries;
    let truncated = false;
    if (size > MAX_BARS) {
      shown = entries
        .slice()
        .sort((a, b) => b.count - a.count || a.index - b.index)
        .slice(0, MAX_BARS)
        .sort((a, b) => a.index - b.index);
      truncated = true;
    }

    const n = Math.max(shown.length, 1);
    const barW = Math.max(MIN_BAR_W, Math.floor(cssW / n));
    const totalW = n * (barW + BAR_GAP) - BAR_GAP;
    const drawW = Math.max(cssW, totalW);

    const canvas = document.createElement('canvas');
    canvas.width = drawW * dpr;
    canvas.height = CSS_H * dpr;
    canvas.style.display = 'block';
    canvas.style.margin = '6px auto';
    canvas.style.width = drawW + 'px';
    canvas.style.height = CSS_H + 'px';
    histEl.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ch = CSS_H - 60;
    const cy0 = CSS_H - 40;
    let x = 0;
    const drawBar = (count, label) => {
      const h = maxCount > 0 ? (count / maxCount) * ch : 0;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, cy0 - h, barW, h);
      ctx.fillStyle = theme.textMuted;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barW / 2, cy0 + 13);
      ctx.fillText(`${count}`, x + barW / 2, cy0 - h - 6);
      x += barW + BAR_GAP;
    };
    for (const e of shown) {
      drawBar(e.count, e.label);
    }
    ctx.fillStyle = theme.textMuted;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Shot histogram (${shots} shots)`, drawW / 2, 18);

    if (truncated) {
      const cap = document.createElement('div');
      cap.style.fontSize = '11px';
      cap.style.color = theme.warning;
      cap.style.textAlign = 'center';
      cap.style.marginTop = '4px';
      cap.textContent = `Showing top ${MAX_BARS} of ${size} outcomes by count; remaining outcomes have 0 or negligible counts.`;
      histEl.appendChild(cap);
    }
  }

  return { renderShots, setBoundary };
}
