import { theme } from './theme.js';
import { entropyColor, fmt } from './inspectorStateView.js';

export function initInspectorBlochView(app, inspectorEl) {
  let blochSubtab = 'register';
  function renderBloch() {
    const n = app.numQubits;
    inspectorEl.innerHTML = '';

    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.lineHeight = '1.5';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '4px';
    title.textContent = 'Bloch Sphere';
    inspectorEl.appendChild(title);

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
    inspectorEl.appendChild(strip);

    const container = document.createElement('div');
    container.style.textAlign = 'center';
    container.style.margin = '8px auto';
    const canvas = document.createElement('canvas');
    canvas.width = 260;
    canvas.height = 260;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    container.appendChild(canvas);
    inspectorEl.appendChild(container);

    const readout = document.createElement('div');
    readout.style.fontSize = '11px';
    readout.style.color = 'var(--simqc-text-muted)';
    readout.style.marginTop = '6px';
    readout.style.textAlign = 'center';
    inspectorEl.appendChild(readout);

    function drawSphere(cx, cy, R, v, sL, drawArrow) {
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 2 * Math.PI);
      ctx.strokeStyle = theme.borderStrong;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 0.35, 0, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = theme.textMuted;
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('x', cx + R + 8, cy + 5);
      ctx.fillText('z', cx - 8, cy - R - 8);

      const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (drawArrow && len > 0.02) {
        const { tx, ty } = projectBloch(v, cx, cy, R);
        const projectedLen = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
        const color = entropyColor(sL);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        const headLen = 12;
        const dx = projectedLen > 0 ? (tx - cx) / projectedLen : 0;
        const dy = projectedLen > 0 ? (ty - cy) / projectedLen : 0;
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
        ctx.fillStyle = theme.foreground;
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
          ctx.fillStyle = theme.textMuted;
          ctx.fillText(`q${q}`, dx, yy + 26);
          ctx.fillStyle = theme.foreground;
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
  return { renderBloch };
}

const depthScale = 0.35;

export function projectBloch(v, cx, cy, R) {
  const tx = cx + v.x * R + v.y * R * depthScale;
  const ty = cy - v.z * R;
  return { tx, ty };
}
