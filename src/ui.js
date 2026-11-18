// UI em canvas 2D, renderizada como textura (VR) ou direto na tela (PC).
export const C = {
  verde: '#56B951', preto: '#100F0D', verdeTxt: '#2A7F36', floresta: '#0B2A1D', cinza: '#6C6E70',
  apoio1: '#E6E6E6', apoio2: '#F5F5F5', branco: '#FFFFFF', tint10: '#EFF7EF', tint20: '#DEF0DF', hair: '#E2E8E4',
  // cores de estado (não definidas pela marca; convenção usual de diagnóstico)
  erro: '#E0533D', alerta: '#E8A33D', info: '#5B9BD5',
  panel: '#0B2A1D', panel2: '#123826', line: '#24513a', txt2: '#C9D6CE',
};
export const F = (w, s) => `${w} ${s}px Archivo, Arial, sans-serif`;
export const M = (s) => `600 ${s}px "IBM Plex Mono", monospace`;

export class CanvasUI {
  constructor(w, h) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h; this.w = w; this.h = h;
    this.ctx = this.canvas.getContext('2d');
    this.buttons = []; this.hover = null; this.dirty = true; this.onChange = null;
  }
  begin() { this.buttons = []; const x = this.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.w, this.h); return x; }
  end() { this.dirty = false; this.onChange && this.onChange(); }
  hit(px, py) { for (let i = this.buttons.length - 1; i >= 0; i--) { const b = this.buttons[i]; if (!b.disabled && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; } return null; }
  setHover(b) { const id = b ? b.id : null; if (id !== this.hover) { this.hover = id; this.dirty = true; } }
  click(px, py) { const b = this.hit(px, py); if (b) { b.fn && b.fn(); return true; } return false; }

  // ---- primitivas ----
  cut(x, y, w, h, c = 18) { // canto superior direito cortado (30°)
    const k = this.ctx; k.beginPath(); k.moveTo(x, y); k.lineTo(x + w - c, y); k.lineTo(x + w, y + c * 0.58); k.lineTo(x + w, y + h); k.lineTo(x, y + h); k.closePath();
  }
  rect(x, y, w, h, fill, stroke) { const k = this.ctx; if (fill) { k.fillStyle = fill; k.fillRect(x, y, w, h); } if (stroke) { k.strokeStyle = stroke; k.lineWidth = 2; k.strokeRect(x + 1, y + 1, w - 2, h - 2); } }
  text(t, x, y, { size = 26, weight = 400, color = C.branco, align = 'left', mono = false, base = 'alphabetic' } = {}) {
    const k = this.ctx; k.font = mono ? M(size) : F(weight, size); k.fillStyle = color; k.textAlign = align; k.textBaseline = base; k.fillText(t, x, y);
  }
  measure(t, size, weight = 400, mono = false) { this.ctx.font = mono ? M(size) : F(weight, size); return this.ctx.measureText(t).width; }
  // texto com quebra de linha; retorna y final
  para(t, x, y, w, { size = 26, lh = 1.42, color = C.branco, weight = 400, maxY = 1e9 } = {}) {
    const k = this.ctx; k.font = F(weight, size); k.fillStyle = color; k.textAlign = 'left'; k.textBaseline = 'alphabetic';
    const lines = [];
    for (const par of String(t).split('\n')) {
      if (par === '') { lines.push(''); continue; }
      let cur = '';
      for (const word of par.split(' ')) {
        const tryL = cur ? cur + ' ' + word : word;
        if (k.measureText(tryL).width > w && cur) { lines.push(cur); cur = word; } else cur = tryL;
      }
      lines.push(cur);
    }
    let yy = y;
    for (const l of lines) {
      if (yy > maxY) { k.fillText('…', x, yy); break; }
      if (l === '') { yy += size * lh * 0.55; continue; }
      k.fillText(l, x, yy); yy += size * lh;
    }
    return yy;
  }
  eyebrow(t, x, y, color = C.verde) { const k = this.ctx; k.font = M(20); k.fillStyle = color; k.textAlign = 'left'; k.textBaseline = 'alphabetic'; k.letterSpacing = '3px'; k.fillText(t.toUpperCase(), x, y); k.letterSpacing = '0px'; }

  // botão. kind: primary | secondary | ghost | tab | danger | choice
  button(id, x, y, w, h, label, fn, { kind = 'secondary', active = false, disabled = false, size = 24, icon = null, sub = null, color = null } = {}) {
    const k = this.ctx; const hov = this.hover === id && !disabled;
    let bg, fg, br;
    if (kind === 'primary') { bg = hov ? C.verdeTxt : C.verde; fg = hov ? C.branco : C.preto; }
    else if (kind === 'danger') { bg = hov ? '#b8402e' : C.erro; fg = C.branco; }
    else if (kind === 'tab') { bg = active ? C.verde : (hov ? C.line : 'transparent'); fg = active ? C.preto : C.branco; br = active ? null : C.line; }
    else if (kind === 'ghost') { bg = hov ? C.line : 'transparent'; fg = C.branco; br = C.line; }
    else if (kind === 'choice') { bg = color || (hov ? C.line : C.panel2); fg = C.branco; br = active ? C.verde : C.line; }
    else { bg = active ? C.tint20 : (hov ? C.apoio1 : C.branco); fg = C.preto; }
    if (disabled) { bg = '#3a4a42'; fg = '#8a9a90'; br = null; }
    if (kind === 'primary' || kind === 'danger') this.cut(x, y, w, h, Math.min(20, h * 0.4)); else { k.beginPath(); k.rect(x, y, w, h); }
    if (bg !== 'transparent') { k.fillStyle = bg; k.fill(); }
    if (br) { k.strokeStyle = br; k.lineWidth = active ? 4 : 2; k.stroke(); }
    let tx = x + w / 2, align = 'center';
    if (icon) { ICONS[icon]?.(k, x + (label ? 30 : w / 2), y + h / 2, fg, Math.min(h * 0.5, 30)); if (label) { tx = x + 56; align = 'left'; } }
    if (label) {
      if (sub) { this.text(label, tx, y + h / 2 - 4, { size, weight: 600, color: fg, align }); this.text(sub, tx, y + h / 2 + size * 0.9, { size: size * 0.72, color: kind === 'secondary' ? C.cinza : C.txt2, align }); }
      else this.text(label, tx, y + h / 2 + size * 0.36, { size, weight: 600, color: fg, align });
    }
    this.buttons.push({ id, x, y, w, h, fn, disabled });
  }
}

// Ícones vetoriais simples (sem emoji)
export const ICONS = {
  hand(k, cx, cy, c, s) {
    k.save(); k.translate(cx, cy); k.strokeStyle = c; k.lineWidth = s * 0.1; k.lineCap = 'round'; k.lineJoin = 'round';
    k.beginPath();
    for (const [x, t] of [[-0.3, -0.35], [-0.1, -0.5], [0.1, -0.45], [0.3, -0.3]]) { k.moveTo(x * s, 0); k.lineTo(x * s, t * s); }
    k.moveTo(-0.3 * s, 0); k.quadraticCurveTo(-0.32 * s, 0.45 * s, 0.05 * s, 0.48 * s); k.quadraticCurveTo(0.35 * s, 0.45 * s, 0.32 * s, 0.05 * s);
    k.lineTo(0.3 * s, -0.3 * s); k.moveTo(-0.3 * s, 0.05 * s); k.lineTo(-0.5 * s, -0.12 * s); k.stroke(); k.restore();
  },
  driver(k, cx, cy, c, s) {
    k.save(); k.translate(cx, cy); k.rotate(-Math.PI / 4); k.fillStyle = c; k.strokeStyle = c; k.lineWidth = s * 0.09;
    k.beginPath(); k.roundRect(-s * 0.14, -s * 0.55, s * 0.28, s * 0.5, s * 0.08); k.fill();
    k.beginPath(); k.moveTo(0, -s * 0.05); k.lineTo(0, s * 0.42); k.stroke();
    k.fillRect(-s * 0.08, s * 0.4, s * 0.16, s * 0.1); k.restore();
  },
  meter(k, cx, cy, c, s) {
    k.save(); k.translate(cx, cy); k.strokeStyle = c; k.fillStyle = c; k.lineWidth = s * 0.08;
    k.beginPath(); k.roundRect(-s * 0.32, -s * 0.5, s * 0.64, s, s * 0.1); k.stroke();
    k.fillRect(-s * 0.2, -s * 0.36, s * 0.4, s * 0.22);
    k.beginPath(); k.arc(0, s * 0.18, s * 0.15, 0, Math.PI * 2); k.stroke(); k.restore();
  },
  check(k, cx, cy, c, s) { k.save(); k.strokeStyle = c; k.lineWidth = s * 0.14; k.lineCap = 'round'; k.beginPath(); k.moveTo(cx - s * 0.35, cy); k.lineTo(cx - s * 0.08, cy + s * 0.28); k.lineTo(cx + s * 0.4, cy - s * 0.3); k.stroke(); k.restore(); },
  cross(k, cx, cy, c, s) { k.save(); k.strokeStyle = c; k.lineWidth = s * 0.14; k.lineCap = 'round'; k.beginPath(); k.moveTo(cx - s * 0.3, cy - s * 0.3); k.lineTo(cx + s * 0.3, cy + s * 0.3); k.moveTo(cx + s * 0.3, cy - s * 0.3); k.lineTo(cx - s * 0.3, cy + s * 0.3); k.stroke(); k.restore(); },
  left(k, cx, cy, c, s) { k.save(); k.strokeStyle = c; k.lineWidth = s * 0.14; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(cx + s * 0.15, cy - s * 0.35); k.lineTo(cx - s * 0.2, cy); k.lineTo(cx + s * 0.15, cy + s * 0.35); k.stroke(); k.restore(); },
  right(k, cx, cy, c, s) { k.save(); k.strokeStyle = c; k.lineWidth = s * 0.14; k.lineCap = 'round'; k.lineJoin = 'round'; k.beginPath(); k.moveTo(cx - s * 0.15, cy - s * 0.35); k.lineTo(cx + s * 0.2, cy); k.lineTo(cx - s * 0.15, cy + s * 0.35); k.stroke(); k.restore(); },
  bolt(k, cx, cy, c, s) { k.save(); k.fillStyle = c; k.beginPath(); k.moveTo(cx + s * 0.1, cy - s * 0.5); k.lineTo(cx - s * 0.3, cy + s * 0.08); k.lineTo(cx - s * 0.02, cy + s * 0.08); k.lineTo(cx - s * 0.12, cy + s * 0.5); k.lineTo(cx + s * 0.3, cy - s * 0.1); k.lineTo(cx + s * 0.02, cy - s * 0.1); k.closePath(); k.fill(); k.restore(); },
  doc(k, cx, cy, c, s) { k.save(); k.strokeStyle = c; k.lineWidth = s * 0.09; k.beginPath(); k.rect(cx - s * 0.3, cy - s * 0.45, s * 0.6, s * 0.9); k.moveTo(cx - s * 0.15, cy - s * 0.15); k.lineTo(cx + s * 0.15, cy - s * 0.15); k.moveTo(cx - s * 0.15, cy + s * 0.05); k.lineTo(cx + s * 0.15, cy + s * 0.05); k.moveTo(cx - s * 0.15, cy + s * 0.25); k.lineTo(cx + s * 0.05, cy + s * 0.25); k.stroke(); k.restore(); },
};
