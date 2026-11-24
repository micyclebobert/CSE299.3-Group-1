import { renderCircuit } from '../canvas/Renderer.js';
import { theme } from './theme.js';

export function initCanvasRenderer(app, canvas, ctx) {
  app.onRender(({ circuit, purity }) => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : 680;
    const cssH = rect.height > 0 ? rect.height : 660;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const drawing = renderCircuit(circuit, theme, { labelGutter: 48, purity });
    const { gateFill, gateStroke, foreground, entanglementGlow, entropyAccent } = theme;
    for (const g of drawing.gates) {
      if (g.kind === 'label') { ctx.fillStyle = g.color; ctx.font = '13px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(g.text, g.x - 4, g.y); }
      else if (g.kind === 'rowSeparator') { ctx.strokeStyle = g.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); }
      else if (g.kind === 'line') { ctx.strokeStyle = g.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); }
      else if (g.kind === 'controlLine') { ctx.strokeStyle = entanglementGlow; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); }
      else if (g.kind === 'controlDot') { ctx.fillStyle = entanglementGlow; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, Math.PI * 2); ctx.fill(); }
      else if (g.kind === 'targetCircle') { ctx.strokeStyle = foreground; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x, g.y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = foreground; ctx.fillText('\u2295', g.x - 4, g.y + 5); }
      else if (g.kind === 'swapLine') { ctx.strokeStyle = foreground; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(g.x1, g.y1); ctx.lineTo(g.x2, g.y2); ctx.stroke(); }
      else if (g.kind === 'gate') { ctx.fillStyle = g.color; ctx.strokeStyle = g.stroke; ctx.lineWidth = 1.5; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.strokeRect(g.x, g.y, g.w, g.h); ctx.fillStyle = foreground; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const label = g.thetaRad !== undefined ? `${g.gateId} \u03b8=${g.thetaRad.toFixed(2)}` : g.gateId; ctx.fillText(label, g.cx, g.cy); }
      else if (g.kind === 'rowGlow') { ctx.save(); ctx.globalAlpha = g.alpha; ctx.fillStyle = g.color; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.restore(); }
    }
  });
}
