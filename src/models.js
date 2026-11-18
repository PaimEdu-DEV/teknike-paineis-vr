// Modelos procedurais (metros reais). Frente das peças = +Z.
import * as THREE from '../vendor/three.module.min.js';

const matCache = new Map();
export function mat(hex, opts = {}) {
  const key = hex + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const M = opts.std ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;
    const o = { color: new THREE.Color(hex) };
    if (opts.std) { o.metalness = opts.metal ?? 0.6; o.roughness = opts.rough ?? 0.4; }
    if (opts.transparent) { o.transparent = true; o.opacity = opts.opacity ?? 0.5; o.depthWrite = false; }
    if (opts.emissive) o.emissive = new THREE.Color(opts.emissive);
    matCache.set(key, new M(o));
  }
  return matCache.get(key);
}
export const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
  g.position.set(x, y, z); return g;
}
export function cyl(r, h, m, x = 0, y = 0, z = 0, axis = 'y', seg = 16) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof m === 'string' ? mat(m) : m);
  if (axis === 'z') g.rotation.x = Math.PI / 2; if (axis === 'x') g.rotation.z = Math.PI / 2;
  g.position.set(x, y, z); return g;
}
export function hitbox(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HIT_MAT); g.position.set(x, y, z); return g;
}

// Textura de texto (rótulos). lines: [{t, size, color, bold, mono}]
export function labelTexture(lines, w = 256, h = 128, bg = '#f5f5f5', fg = '#100F0D', align = 'center') {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  const total = lines.reduce((s, l) => s + (l.size || 28) * 1.15, 0);
  let y = (h - total) / 2;
  for (const l of lines) {
    const s = l.size || 28; y += s * 1.15;
    x.font = `${l.bold ? 700 : 500} ${s}px ${l.mono ? '"IBM Plex Mono", monospace' : 'Archivo, Arial, sans-serif'}`;
    x.fillStyle = l.color || fg; x.textAlign = align;
    x.fillText(l.t, align === 'center' ? w / 2 : 10, y - s * 0.22);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function labelPlane(lines, pw, ph, opts = {}) {
  const tex = labelTexture(lines, opts.w || 256, opts.h || Math.round(256 * ph / pw), opts.bg ?? '#f5f5f5', opts.fg, opts.align);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: !opts.bg }));
  return m;
}

// ---------- Componentes ----------
// Cada builder devolve { group, terms: [{pin, pos:Vector3(local), face}], extra }
const GREY_BORNE = '#a7adb1', DARK = '#2a2e33', LC_GREY = '#d3d6d8';

export function buildBornes(pins, peList = [], tag = '', colors = {}) {
  const g = new THREE.Group();
  const w = 0.0062 * 1.4, h = 0.05, d = 0.045; // borne UT4 ~6,2 mm; exagero leve para legibilidade
  const n = pins.length; const total = n * w;
  const terms = [];
  pins.forEach((p, i) => {
    const x = -total / 2 + w / 2 + i * w;
    const isPE = peList.includes(p);
    const body = box(w * 0.94, h, d, isPE ? '#3fae49' : (colors[p] || GREY_BORNE), x, 0, 0);
    g.add(body);
    if (isPE) g.add(box(w * 0.95, h * 0.18, d * 1.001, '#e8d23a', x, 0.004, 0));
    // número
    const lab = labelPlane([{ t: p, size: 34, bold: true }], w * 0.9, 0.011, { w: 96, h: 72, bg: '#ffffff' });
    lab.position.set(x, 0, d / 2 + 0.0006); g.add(lab);
    // parafusos (topo e base)
    for (const [suf, yy] of [['a', h / 2 - 0.007], ['b', -h / 2 + 0.007]]) {
      const s = cyl(0.0022, 0.002, '#c9ccce', x, yy, d / 2 - 0.006, 'z', 10); g.add(s);
      terms.push({ pin: p + suf, pos: new THREE.Vector3(x, yy, d / 2 - 0.004), face: suf === 'a' ? 'top' : 'bottom' });
    }
  });
  // tampa final + tag
  g.add(box(0.0015, h * 0.98, d, GREY_BORNE, total / 2 + 0.0008, 0, 0));
  const tg = labelPlane([{ t: tag, size: 30, bold: true }], Math.max(total, 0.024), 0.008, { w: 192, h: 64, bg: '#ffffff' });
  tg.position.set(0, h / 2 + 0.006, d / 2 - 0.01); g.add(tg);
  return { group: g, terms, size: { w: total, h, d } };
}

export function buildGV2(part) {
  const g = new THREE.Group();
  const w = 0.045, h = 0.089, d = 0.08;
  g.add(box(w, h, d * 0.8, DARK, 0, 0, -d * 0.1));
  g.add(box(w * 0.92, h * 0.62, d * 0.2, '#353a40', 0, 0, d * 0.3));
  // placa frontal com código
  const lab = labelPlane([{ t: part.tag, size: 30, bold: true, color: '#ffffff' }, { t: part.code.split(' ')[0], size: 26, color: '#dfe3e6' }], 0.04, 0.016, { w: 256, h: 104, bg: '#24282c' });
  lab.position.set(0, -0.032, d / 2 + 0.0005); g.add(lab);
  // botões I (verde) e O (vermelho)
  const bI = cyl(0.0065, 0.008, '#2fa84f', -0.009, 0.006, d / 2 + 0.002, 'z');
  const bO = cyl(0.0065, 0.006, '#d0342c', 0.011, 0.006, d / 2 + 0.001, 'z');
  g.add(bI, bO);
  // dial de regulagem
  const dial = new THREE.Group(); dial.position.set(0, -0.015, d / 2 + 0.001);
  dial.add(cyl(0.0055, 0.003, '#c8ccd0', 0, 0, 0, 'z'));
  const arrow = box(0.0012, 0.005, 0.001, '#100F0D', 0, 0.0022, 0.0018); dial.add(arrow);
  g.add(dial);
  // bloco auxiliar GVAE11 (frontal, em cima)
  g.add(box(0.032, 0.02, 0.012, '#3d434a', 0, 0.028, d / 2 + 0.002));
  const auxLab = labelPlane([{ t: 'GVAE11  13·14', size: 26, color: '#ffffff' }], 0.028, 0.006, { w: 256, h: 56, bg: '#3d434a' });
  auxLab.position.set(0, 0.028, d / 2 + 0.0082); g.add(auxLab);
  const terms = [];
  [-0.015, 0, 0.015].forEach((x, i) => {
    terms.push({ pin: String(1 + i * 2), pos: new THREE.Vector3(x, h / 2 - 0.004, d / 2 - 0.016), face: 'top' });
    terms.push({ pin: String(2 + i * 2), pos: new THREE.Vector3(x, -h / 2 + 0.004, d / 2 - 0.016), face: 'bottom' });
    g.add(cyl(0.0028, 0.003, '#c9ccce', x, h / 2 - 0.002, d / 2 - 0.016, 'y', 10));
    g.add(cyl(0.0028, 0.003, '#c9ccce', x, -h / 2 + 0.002, d / 2 - 0.016, 'y', 10));
  });
  terms.push({ pin: '13', pos: new THREE.Vector3(-0.011, 0.038, d / 2 + 0.006), face: 'top' });
  terms.push({ pin: '14', pos: new THREE.Vector3(0.011, 0.018, d / 2 + 0.006), face: 'front' });
  g.add(cyl(0.002, 0.002, '#c9ccce', -0.011, 0.038, d / 2 + 0.006, 'y', 10));
  g.add(cyl(0.002, 0.002, '#c9ccce', 0.011, 0.018, d / 2 + 0.009, 'z', 10));
  return { group: g, terms, size: { w, h, d }, extra: { bI, bO, dial, arrow } };
}

export function buildLC1D(part) {
  const g = new THREE.Group();
  const w = 0.045, h = 0.077, d = 0.086;
  g.add(box(w, h, d * 0.75, LC_GREY, 0, 0, -d * 0.125));
  g.add(box(w * 0.86, h * 0.5, d * 0.25, '#c2c6c9', 0, 0, d * 0.25));
  const win = box(0.016, 0.012, 0.004, '#5b6166', 0, -0.006, d / 2 - 0.004); g.add(win); // visor/armadura
  const lab = labelPlane([{ t: part.tag, size: 30, bold: true }, { t: part.code, size: 26, color: '#3a3f44' }], 0.036, 0.013, { w: 256, h: 96, bg: '#eef0f1' });
  lab.position.set(0, -0.026, d / 2 - 0.016); g.add(lab);
  // bobina: A1 em cima, A2 embaixo, na frente
  const coilTxt = part.coil === 'DC24' ? '24 Vcc' : '220 Vca';
  const coil = labelPlane([{ t: 'A1   bobina ' + coilTxt + '   A2', size: 22, color: '#100F0D' }], 0.04, 0.005, { w: 320, h: 40, bg: '#eef0f1' });
  coil.position.set(0, 0.008, d / 2 + 0.0005); g.add(coil);
  const terms = [];
  [-0.015, 0, 0.015].forEach((x, i) => {
    terms.push({ pin: String(1 + i * 2), pos: new THREE.Vector3(x, h / 2 - 0.004, d / 2 - 0.03), face: 'top' });
    terms.push({ pin: String(2 + i * 2), pos: new THREE.Vector3(x, -h / 2 + 0.004, d / 2 - 0.03), face: 'bottom' });
    g.add(cyl(0.0028, 0.003, '#c9ccce', x, h / 2 - 0.002, d / 2 - 0.03, 'y', 10));
    g.add(cyl(0.0028, 0.003, '#c9ccce', x, -h / 2 + 0.002, d / 2 - 0.03, 'y', 10));
  });
  terms.push({ pin: 'A1', pos: new THREE.Vector3(-0.017, 0.016, d / 2 + 0.002), face: 'front' });
  terms.push({ pin: 'A2', pos: new THREE.Vector3(0.017, -0.004, d / 2 + 0.002), face: 'front' });
  g.add(cyl(0.0025, 0.003, '#c9ccce', -0.017, 0.016, d / 2 + 0.001, 'z', 10));
  g.add(cyl(0.0025, 0.003, '#c9ccce', 0.017, -0.004, d / 2 + 0.001, 'z', 10));
  return { group: g, terms, size: { w, h, d }, extra: { win } };
}

export function buildRelay(part) {
  const g = new THREE.Group();
  const w = 0.016, h = 0.08, d = 0.07;
  g.add(box(w, h, d * 0.55, '#3b4046', 0, 0, -d * 0.22)); // soquete
  const rel = box(w * 0.9, h * 0.55, d * 0.45, '#2f6fb8', 0, 0, d * 0.26); g.add(rel);
  const led = cyl(0.0018, 0.002, '#5a3a18', 0, 0.018, d / 2 + 0.002, 'z', 10); g.add(led);
  const lab = labelPlane([{ t: part.tag, size: 30, bold: true, color: '#fff' }, { t: 'RSB1A120BD', size: 20, color: '#dbe7f5' }], 0.0145, 0.014, { w: 128, h: 120, bg: '#2f6fb8' });
  lab.position.set(0, -0.004, d / 2 + 0.0004); g.add(lab);
  const terms = [
    { pin: '11', pos: new THREE.Vector3(-0.0042, h / 2 - 0.006, d / 2 - 0.03), face: 'top' },
    { pin: '14', pos: new THREE.Vector3(0.0042, h / 2 - 0.006, d / 2 - 0.03), face: 'top' },
    { pin: 'A1', pos: new THREE.Vector3(-0.0042, -h / 2 + 0.006, d / 2 - 0.03), face: 'bottom' },
    { pin: 'A2', pos: new THREE.Vector3(0.0042, -h / 2 + 0.006, d / 2 - 0.03), face: 'bottom' },
  ];
  for (const t of terms) g.add(cyl(0.002, 0.003, '#c9ccce', t.pos.x, t.pos.y + (t.face === 'top' ? 0.002 : -0.002), t.pos.z, 'y', 10));
  const tl = labelPlane([{ t: '11      14', size: 26, bold: true }], 0.0155, 0.004, { w: 128, h: 32, bg: '#d8dadc' });
  tl.position.set(0, h / 2 - 0.0125, d / 2 - 0.0206); g.add(tl);
  return { group: g, terms, size: { w, h, d }, extra: { led } };
}

export function buildLink() {
  const g = new THREE.Group();
  g.add(box(0.044, 0.014, 0.03, '#7f868c'));
  for (const x of [-0.015, 0, 0.015]) g.add(cyl(0.0022, 0.016, '#b87333', x, 0, 0.016, 'y', 8));
  return { group: g, terms: [], size: { w: 0.044, h: 0.014, d: 0.03 } };
}

export function buildPEBar() {
  const g = new THREE.Group();
  g.add(box(0.075, 0.009, 0.006, '#c58a4a', 0, 0, 0.016, ));
  g.add(box(0.008, 0.012, 0.014, '#3fae49', -0.034, 0, 0.007));
  g.add(box(0.008, 0.012, 0.014, '#3fae49', 0.034, 0, 0.007));
  const terms = [];
  [-0.022, -0.008, 0.006, 0.02].forEach((x, i) => {
    g.add(cyl(0.0025, 0.003, '#d9dcde', x, 0.004, 0.019, 'z', 10));
    terms.push({ pin: String(i + 1), pos: new THREE.Vector3(x, 0.0055, 0.02), face: 'top' });
  });
  const lab = labelPlane([{ t: 'PE', size: 40, bold: true }], 0.012, 0.007, { w: 96, h: 56, bg: '#e8d23a' });
  lab.position.set(-0.046, 0, 0.004); g.add(lab);
  return { group: g, terms };
}

// ---------- Placa de montagem com canaletas e trilhos ----------
export const PLATE = { w: 0.42, h: 0.5, ducts: [0.215, -0.06, -0.222], sideX: 0.192 };
export function buildPlate() {
  const g = new THREE.Group();
  const plate = box(PLATE.w, PLATE.h, 0.003, mat('#e07a2c'), 0, 0, -0.0015);
  g.add(plate);
  // furos de fixação nos cantos
  const holes = [];
  for (const [x, y] of [[-0.19, 0.23], [0.19, 0.23], [-0.19, -0.23], [0.19, -0.23]]) {
    const h = cyl(0.006, 0.004, '#5d3412', x, y, 0.0005, 'z', 14); g.add(h); holes.push(new THREE.Vector3(x, y, 0));
  }
  // canaletas horizontais
  const ductMat = mat('#9ba2a7');
  for (const y of PLATE.ducts) {
    const dh = y === PLATE.ducts[2] ? 0.03 : 0.036;
    g.add(box(0.36, dh, 0.04, ductMat, 0, y, 0.02));
    g.add(box(0.362, dh * 0.15, 0.002, '#b9bec2', 0, y, 0.041));
  }
  // canaletas verticais
  for (const x of [-PLATE.sideX, PLATE.sideX]) g.add(box(0.025, 0.47, 0.04, ductMat, x, 0, 0.02));
  return { group: g, plateMesh: plate, holes };
}

export function buildRail(len) {
  const g = new THREE.Group();
  const m = mat('#c3c7cb', { std: true, metal: 0.7, rough: 0.35 });
  g.add(box(len, 0.035, 0.0015, m, 0, 0, 0.0008));
  g.add(box(len, 0.004, 0.0075, m, 0, 0.0155, 0.0037));
  g.add(box(len, 0.004, 0.0075, m, 0, -0.0155, 0.0037));
  return g;
}

export function screwMesh() {
  const g = new THREE.Group();
  const head = cyl(0.0042, 0.003, mat('#b9bdc1', { std: true, metal: 0.8, rough: 0.3 }), 0, 0, 0.002, 'z', 14);
  g.add(head);
  g.add(box(0.0062, 0.0011, 0.001, '#2a2e33', 0, 0, 0.0037));
  return g;
}

// ---------- Mobiliário ----------
export function buildTable(w, d, h = 0.85, top = '#d8d2c4', legs = '#3c4046') {
  const g = new THREE.Group();
  g.add(box(w, 0.04, d, top, 0, h - 0.02, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, h - 0.04, 0.05, legs, sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05)));
  g.add(box(w - 0.1, 0.03, 0.03, legs, 0, 0.15, -d / 2 + 0.05));
  return g;
}
