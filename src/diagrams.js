// Desenho das folhas do projeto (recorte do PAINEL MIÚDOS para o circuito -M151).
import { C } from './ui.js';
import { PARTS, WIRES, SLOTS, RAILS, MOTOR } from './data.js';

const BLUE = '#2b4fd6', BLK = '#111', GRN = '#1a8a2a';
export const BOARD_TABS = [['f12', 'Folha 12 · Força'], ['f40', 'Folha 40 · Comando'], ['lay', 'Folha 1 · Layout e materiais'], ['fios', 'Lista de fios']];

let logoImg = null;
export function setBoardLogo(img) { logoImg = img; }

export function drawBoard(ui, state) {
  const k = ui.begin();
  const W = ui.w, H = ui.h;
  k.fillStyle = C.floresta; k.fillRect(0, 0, W, H);
  ui.eyebrow('Quadro de projeto · PAINEL MIÚDOS', 40, 52);
  // abas
  let x = 40;
  for (const [id, label] of BOARD_TABS) {
    const w = ui.measure(label, 26, 600) + 48;
    ui.button('tab_' + id, x, 72, w, 58, label, () => state.setTab(id), { kind: 'tab', active: state.tab === id, size: 26 });
    x += w + 14;
  }
  // folha
  const sx = 40, sy = 150, sw = W - 80, sh = H - 190;
  k.fillStyle = '#ffffff'; k.fillRect(sx, sy, sw, sh);
  state.regions = [];
  const R = (id, x, y, w, h) => state.regions.push({ id, x, y, w, h });
  if (state.tab === 'f12') drawForca(ui, sx, sy, sw, sh, R);
  else if (state.tab === 'f40') drawComando(ui, sx, sy, sw, sh, R);
  else if (state.tab === 'lay') drawLayout(ui, sx, sy, sw, sh, R);
  else drawFios(ui, sx, sy, sw, sh, state);
  // destaque (cards da aula)
  if (state.flash) {
    const r = state.regions.find(q => q.id === state.flash.id);
    if (r) { k.strokeStyle = state.flash.color || C.verde; k.lineWidth = 8; k.strokeRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20); }
  }
  ui.end();
}

function grid(ui, sx, sy, sw, sh, folha, titulo) {
  const k = ui.ctx;
  const gx = sx + 40, gy = sy + 36, gw = sw - 80, gh = sh - 150;
  k.strokeStyle = '#555'; k.lineWidth = 2; k.strokeRect(gx, gy, gw, gh);
  for (let i = 0; i < 12; i++) {
    const x = gx + gw * i / 12; k.beginPath(); k.moveTo(x, gy - 22); k.lineTo(x, gy); k.stroke();
    ui.text(String(i + 1), x + gw / 24, gy - 6, { size: 18, color: '#333', align: 'center' });
  }
  'ABCDEFGH'.split('').forEach((L, i) => {
    const y = gy + gh * i / 8; k.beginPath(); k.moveTo(gx - 24, y); k.lineTo(gx, y); k.stroke();
    ui.text(L, gx - 14, y + gh / 16 + 6, { size: 18, color: '#333', align: 'center' });
  });
  // carimbo
  const ty = sy + sh - 100;
  k.strokeStyle = '#555'; k.strokeRect(sx + 40, ty, sw - 80, 84);
  if (logoImg) { const lw = 200, lh = lw * logoImg.height / logoImg.width; k.drawImage(logoImg, sx + 60, ty + 42 - lh / 2, lw, lh); }
  ui.text('Projeto: PAINEL MIÚDOS (recorte para treino: partida direta -M151)', sx + 300, ty + 34, { size: 22, color: '#222', weight: 600 });
  ui.text('Descrição da página: ' + titulo, sx + 300, ty + 66, { size: 20, color: '#444' });
  ui.text('Folha', sx + sw - 220, ty + 34, { size: 18, color: '#555' });
  ui.text(String(folha) + ' / 60', sx + sw - 220, ty + 70, { size: 34, color: '#111', weight: 700 });
  return { gx, gy, gw, gh, col: (c) => gx + gw * (c - 0.5) / 12, row: (r) => gy + gh * ('ABCDEFGH'.indexOf(r) + 0.5) / 8 };
}

function line(k, pts, color = BLUE, w = 2.5, dash = null) {
  k.strokeStyle = color; k.lineWidth = w; k.setLineDash(dash || []); k.beginPath(); k.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) k.lineTo(p[0], p[1]); k.stroke(); k.setLineDash([]);
}
function dot(k, x, y, c = BLUE) { k.fillStyle = c; k.beginPath(); k.arc(x, y, 5, 0, Math.PI * 2); k.fill(); }
function vtext(ui, t, x, y, size = 16, color = '#333') { const k = ui.ctx; k.save(); k.translate(x, y); k.rotate(-Math.PI / 2); ui.text(t, 0, 0, { size, color, align: 'center' }); k.restore(); }

function drawForca(ui, sx, sy, sw, sh, R) {
  const k = ui.ctx; const g = grid(ui, sx, sy, sw, sh, 12, 'Força: partida direta do motor -M151');
  const yb = [g.row('A') - 22, g.row('A'), g.row('A') + 22];
  const names = ['L1.2', 'L2.2', 'L3.2'];
  yb.forEach((y, i) => {
    line(k, [[g.gx + 70, y], [g.gx + g.gw - 70, y]]);
    ui.text('/11.A12', g.gx + 4, y + 6, { size: 16, color: GRN }); ui.text(names[i], g.gx + 80, y - 5, { size: 15, color: '#333' });
    ui.text('/13.A1', g.gx + g.gw - 64, y + 6, { size: 16, color: GRN });
  });
  ui.text('Barramento 380 Vca (na bancada: bornes -X0)', g.col(9), yb[0] - 14, { size: 18, color: '#333' });
  const cx = g.col(6.5); const xs = [cx - 34, cx, cx + 34];
  const yQ = g.row('C'), yK = g.row('E') - 20, yX = g.row('G') + 30;
  xs.forEach((x, i) => { dot(k, x, yb[i]); line(k, [[x, yb[i]], [x, yQ - 46]]); });
  ui.text('2,5mm²', cx - 150, g.row('B') + 10, { size: 18, color: '#333' });
  // QM151
  xs.forEach((x, i) => {
    line(k, [[x, yQ - 46], [x, yQ - 20]], BLK); line(k, [[x, yQ - 20], [x + 16, yQ + 14]], BLK); line(k, [[x, yQ + 18], [x, yQ + 46]], BLK);
    k.strokeStyle = BLK; k.lineWidth = 2; k.beginPath(); k.moveTo(x - 5, yQ - 25); k.lineTo(x + 5, yQ - 15); k.moveTo(x + 5, yQ - 25); k.lineTo(x - 5, yQ - 15); k.stroke();
    k.strokeRect(x - 9, yQ + 22, 18, 14);
    ui.text(String(1 + i * 2), x + 6, yQ - 52, { size: 16, color: '#111' }); ui.text(String(2 + i * 2), x + 6, yQ + 62, { size: 16, color: '#111' });
  });
  line(k, [[xs[0] - 40, yQ - 4], [xs[2] + 8, yQ - 4]], BLK, 2, [6, 5]);
  ui.text('-QM151', cx - 190, yQ - 12, { size: 26, weight: 700, color: '#111' });
  ui.text('GV2ME07', cx - 190, yQ + 16, { size: 20, color: '#111' });
  ui.text('1,6/2,5A', cx - 190, yQ + 42, { size: 20, color: '#111' });
  R('QM', cx - 200, yQ - 60, 280, 130);
  // link BRI1
  xs.forEach(x => line(k, [[x, yQ + 46], [x, yK - 46]]));
  ui.text('-BRI1  GV2AF3', cx + 70, (yQ + yK) / 2, { size: 18, color: '#111' });
  R('BRI', cx + 60, (yQ + yK) / 2 - 24, 170, 34);
  // KM151
  xs.forEach((x, i) => {
    line(k, [[x, yK - 46], [x, yK - 18]], BLK); line(k, [[x, yK - 18], [x + 16, yK + 14]], BLK); line(k, [[x, yK + 18], [x, yK + 46]], BLK);
    ui.text(String(1 + i * 2), x + 6, yK - 50, { size: 16, color: '#111' }); ui.text(String(2 + i * 2), x + 6, yK + 62, { size: 16, color: '#111' });
  });
  ui.text('-KM151', cx - 190, yK - 10, { size: 26, weight: 700, color: '#111' });
  ui.text('LC1D09BD', cx - 190, yK + 16, { size: 20, color: '#111' });
  ui.text('/40.G6   9A', cx - 190, yK + 40, { size: 18, color: '#444' });
  R('KM', cx - 200, yK - 56, 280, 120);
  // fios 177..179 até XP3.0
  const nums = ['177', '178', '179'];
  xs.forEach((x, i) => { line(k, [[x, yK + 46], [x, yX - 10]]); vtext(ui, nums[i], x - 10, g.row('F'), 16); });
  R('W177', xs[0] - 22, g.row('F') - 30, 100, 60);
  // PE
  const yPE = g.row('G') - 18;
  line(k, [[g.gx + 70, yPE], [g.gx + g.gw - 70, yPE]], '#5aa83a', 3, [16, 10]);
  ui.text('PE', g.gx + 80, yPE - 6, { size: 16, color: '#333' }); ui.text('/11.G12', g.gx + 4, yPE + 6, { size: 16, color: GRN });
  const xPE = cx + 68; dot(k, xPE, yPE, '#5aa83a'); line(k, [[xPE, yPE], [xPE, yX - 10]], '#5aa83a', 3, [10, 6]);
  // bornes XP3.0
  [...xs, xPE].forEach((x, i) => {
    k.strokeStyle = BLK; k.lineWidth = 2; k.beginPath(); k.arc(x, yX, 9, 0, Math.PI * 2); k.stroke();
    ui.text(['37', '38', '39', '40'][i], x + 12, yX - 12, { size: 18, color: '#111', weight: 600 });
  });
  ui.text('-XP3.0', cx - 190, yX + 8, { size: 24, weight: 700, color: '#111' });
  R('XP', cx - 200, yX - 30, 300, 60);
  // motor
  const yM = g.row('H') + 18;
  xs.forEach(x => line(k, [[x, yX + 9], [x, yM - 40]], BLK, 2, [8, 6]));
  k.strokeStyle = BLK; k.lineWidth = 3; k.beginPath(); k.arc(cx, yM, 40, 0, Math.PI * 2); k.stroke();
  ui.text('M', cx, yM - 2, { size: 30, weight: 700, color: '#111', align: 'center' }); ui.text('3~', cx, yM + 26, { size: 18, color: '#111', align: 'center' });
  ui.text('-M151', cx + 60, yM - 6, { size: 24, weight: 700, color: '#111' });
  ui.text(`${MOTOR.kw} · ${MOTOR.v} · In ${String(MOTOR.inom).replace('.', ',')} A`, cx + 60, yM + 22, { size: 18, color: '#333' });
  R('M', cx - 50, yM - 50, 330, 100);
}

function drawComando(ui, sx, sy, sw, sh, R) {
  const k = ui.ctx; const g = grid(ui, sx, sy, sw, sh, 40, 'Comando 24 Vcc: contatores -KM149 a -KM153 (recorte -KM151)');
  const yT = g.row('A'), yB = g.row('G') + 40;
  line(k, [[g.gx + 70, yT], [g.gx + g.gw - 70, yT]]); ui.text('/39.A12', g.gx + 4, yT + 6, { size: 16, color: GRN }); ui.text('S+  (24 Vcc)', g.gx + 84, yT - 8, { size: 18, color: '#333' });
  line(k, [[g.gx + 70, yB], [g.gx + g.gw - 70, yB]]); ui.text('/39.G12', g.gx + 4, yB + 6, { size: 16, color: GRN }); ui.text('0V', g.gx + 84, yB - 8, { size: 18, color: '#333' });
  // RA26 bobina (via saída CLP)
  const xr = g.col(5);
  k.strokeStyle = BLK; k.lineWidth = 2; k.strokeRect(xr - 56, g.row('B') - 22, 112, 50);
  ui.text('-A8', xr, g.row('B') - 2, { size: 18, color: '#111', align: 'center', weight: 600 }); ui.text('OUT10', xr, g.row('B') + 22, { size: 18, color: '#111', align: 'center' });
  line(k, [[xr, g.row('B') + 28], [xr, g.row('G') - 28]], '#555');
  vtext(ui, '461', xr - 12, g.row('D'), 16);
  k.strokeRect(xr - 24, g.row('G') - 28, 48, 28); ui.text('A1', xr + 30, g.row('G') - 26, { size: 15, color: '#111' }); ui.text('A2', xr + 30, g.row('G') + 6, { size: 15, color: '#111' });
  line(k, [[xr, g.row('G')], [xr, yB]], '#555'); dot(k, xr, yB);
  ui.text('-RA26', xr - 120, g.row('G') - 6, { size: 22, weight: 700, color: '#111' });
  R('RA_COIL', xr - 130, g.row('G') - 40, 200, 56);
  // linha do KM151
  const xk = g.col(6.6);
  dot(k, xk, yT); line(k, [[xk, yT], [xk, g.row('B') - 22]]);
  // contato RA26 11-14
  line(k, [[xk, g.row('B') - 22], [xk + 14, g.row('B') + 10]], BLK); line(k, [[xk, g.row('B') + 14], [xk, g.row('B') + 40]], BLK);
  ui.text('11', xk + 10, g.row('B') - 22, { size: 16, color: '#111' }); ui.text('14', xk + 10, g.row('B') + 36, { size: 16, color: '#111' });
  ui.text('-RA26', xk - 110, g.row('B') + 4, { size: 22, weight: 700, color: '#111' });
  R('RA', xk - 120, g.row('B') - 30, 190, 74);
  line(k, [[xk, g.row('B') + 40], [xk, g.row('E') - 26]]); vtext(ui, '462', xk - 12, g.row('C') + 40, 16);
  R('W462', xk - 30, g.row('C'), 60, 80);
  // QM151 13-14
  line(k, [[xk, g.row('E') - 26], [xk + 14, g.row('E') + 6]], BLK); line(k, [[xk, g.row('E') + 10], [xk, g.row('E') + 36]], BLK);
  ui.text('13', xk + 10, g.row('E') - 26, { size: 16, color: '#111' }); ui.text('14', xk + 10, g.row('E') + 32, { size: 16, color: '#111' });
  ui.text('-QM151', xk - 128, g.row('E'), { size: 22, weight: 700, color: '#111' }); ui.text('GVAE11', xk - 128, g.row('E') + 24, { size: 18, color: '#111' });
  R('QM_AUX', xk - 136, g.row('E') - 34, 210, 74);
  line(k, [[xk, g.row('E') + 36], [xk, g.row('G') - 28]]); vtext(ui, '463', xk - 12, g.row('F'), 16);
  // bobina KM151
  k.strokeStyle = BLK; k.lineWidth = 2; k.strokeRect(xk - 24, g.row('G') - 28, 48, 28);
  ui.text('A1', xk + 30, g.row('G') - 26, { size: 15, color: '#111' }); ui.text('A2', xk + 30, g.row('G') + 6, { size: 15, color: '#111' });
  ui.text('-KM151', xk - 120, g.row('G') - 6, { size: 22, weight: 700, color: '#111' }); ui.text('/40.G6', xk - 120, g.row('G') + 18, { size: 16, color: '#444' });
  R('KM_COIL', xk - 130, g.row('G') - 42, 210, 62);
  line(k, [[xk, g.row('G')], [xk, yB]]); dot(k, xk, yB);
  // referência contatos de força
  ui.text('Contatos de força do -KM151: folha 12, bornes 1-2 / 3-4 / 5-6', g.col(8), g.row('D'), { size: 18, color: '#444' });
  ui.text('O contato 13-14 do -QM151 só fecha com o disjuntor-motor armado.', g.col(8), g.row('D') + 28, { size: 18, color: '#444' });
}

function drawLayout(ui, sx, sy, sw, sh, R) {
  const k = ui.ctx; const g = grid(ui, sx, sy, sw, sh, 1, 'Layout da placa de montagem e lista de materiais');
  // placa
  const pw = 0.42, ph = 0.5; const sc = Math.min((g.gw * 0.45) / pw, (g.gh - 20) / ph);
  const ox = g.gx + 30 + pw * sc / 2, oy = g.gy + 10 + ph * sc / 2;
  const P = (x, y) => [ox + x * sc, oy - y * sc];
  k.fillStyle = '#f3c9a6'; k.fillRect(ox - pw * sc / 2, oy - ph * sc / 2, pw * sc, ph * sc);
  k.strokeStyle = '#a0561d'; k.lineWidth = 2; k.strokeRect(ox - pw * sc / 2, oy - ph * sc / 2, pw * sc, ph * sc);
  k.fillStyle = '#c4c8cc';
  for (const y of [0.215, -0.06, -0.222]) { const [x0, y0] = P(-0.18, y + 0.018); k.fillRect(x0, y0, 0.36 * sc, 0.036 * sc); }
  for (const x of [-0.192, 0.192]) { const [x0, y0] = P(x - 0.0125, 0.235); k.fillRect(x0, y0, 0.025 * sc, 0.47 * sc); }
  k.fillStyle = '#9aa0a5';
  for (const y of Object.values(RAILS)) { const [x0, y0] = P(-0.17, y + 0.0175); k.fillRect(x0, y0, 0.34 * sc, 0.035 * sc); }
  const items = [['X0', 'a1', 0.03, 0.05], ['QM', 'a2', 0.045, 0.089], ['RA', 'a3', 0.016, 0.08], ['X24', 'a4', 0.02, 0.05], ['KM', 'b2', 0.045, 0.077], ['XP', 'c2', 0.035, 0.05]];
  for (const [role, slot, w, h] of items) {
    const s = SLOTS[slot]; const y = RAILS[s.rail];
    const [x0, y0] = P(s.x - w / 2, y + h / 2);
    k.fillStyle = role === 'RA' ? '#2f6fb8' : (role === 'QM' ? '#2a2e33' : (role === 'KM' ? '#d3d6d8' : '#a7adb1'));
    k.fillRect(x0, y0, w * sc, h * sc); k.strokeStyle = '#111'; k.strokeRect(x0, y0, w * sc, h * sc);
    const tag = PARTS[role].tag;
    ui.text(tag, x0 + w * sc / 2, y0 - 8, { size: 17, weight: 700, color: '#111', align: 'center' });
    R('L_' + role, x0, y0, w * sc, h * sc);
  }
  { const [x0, y0] = P(-0.19, -0.18); k.fillStyle = '#c58a4a'; k.fillRect(x0, y0, 0.075 * sc, 0.01 * sc); ui.text('PE', x0, y0 - 6, { size: 16, weight: 700, color: '#111' }); }
  ui.text('Link -BRI1 entre -QM151 e -KM151', ox - pw * sc / 2, oy + ph * sc / 2 + 30, { size: 18, color: '#333' });
  // lista de materiais
  const tx = g.gx + g.gw * 0.55, tw = g.gw * 0.43; let ty = g.gy + 40;
  ui.text('Lista de materiais', tx, ty, { size: 28, weight: 700, color: '#111' }); ty += 24;
  const cols = [0, 0.2, 0.62]; const hdr = ['Tag', 'Descrição', 'Código'];
  k.fillStyle = '#e6e6e6'; k.fillRect(tx, ty, tw, 40);
  hdr.forEach((h, i) => ui.text(h, tx + 10 + cols[i] * tw, ty + 28, { size: 19, weight: 700, color: '#111' })); ty += 40;
  const bom = [['-X0', 'Bornes de chegada (3x)', 'UT 4'], ['-QM151', 'Disjuntor-motor 1,6–2,5 A', 'GV2ME07'], ['-QM151', 'Contato auxiliar frontal', 'GVAE11'], ['-BRI1', 'Link disjuntor-contator', 'GV2AF3'], ['-KM151', 'Contator 9 A, bobina 24 Vcc', 'LC1D09BD'], ['-RA26', 'Relé de interface 24 Vcc', 'RSB1A120BD'], ['-X24', 'Bornes 24 Vcc (S+, 0V)', 'UT 2,5'], ['-XP3.0', 'Bornes do motor + PE', 'UT 4 / UT 4-PE'], ['PE', 'Barra de aterramento', '—']];
  for (const [i, r] of bom.entries()) {
    if (i % 2) { k.fillStyle = '#f5f5f5'; k.fillRect(tx, ty, tw, 44); }
    r.forEach((c, j) => ui.text(c, tx + 10 + cols[j] * tw, ty + 30, { size: 19, color: '#111', weight: j === 0 ? 600 : 400, mono: j === 2 }));
    ty += 44;
  }
}

export function routeEstimate(id) { return WIRE_EST[id]; }
export const WIRE_EST = {};

function drawFios(ui, sx, sy, sw, sh, state) {
  const k = ui.ctx;
  ui.text('Lista de fios · partida direta -M151', sx + 40, sy + 60, { size: 34, weight: 700, color: '#111' });
  ui.text('Convenção deste projeto de treino: força 2,5 mm² preto · terra 2,5 mm² verde-amarelo · comando 24 Vcc 0,75 mm² azul', sx + 40, sy + 96, { size: 20, color: '#444' });
  const cols = [0, 0.1, 0.3, 0.5, 0.64, 0.8]; const hdr = ['Fio', 'Origem', 'Destino', 'Bitola', 'Cor', 'Trajeto aprox.'];
  const tx = sx + 40, tw = sw - 80; let ty = sy + 120;
  k.fillStyle = '#e6e6e6'; k.fillRect(tx, ty, tw, 48);
  hdr.forEach((h, i) => ui.text(h, tx + 12 + cols[i] * tw, ty + 33, { size: 22, weight: 700, color: '#111' })); ty += 48;
  const nm = (t) => { const [r, p] = t.split(':'); const tag = r === 'PE' ? 'Barra PE' : PARTS[r].tag; return `${tag} : ${p.replace(/[ab]$/, '')}`; };
  for (const [i, w] of WIRES.entries()) {
    if (i % 2) { k.fillStyle = '#f5f5f5'; k.fillRect(tx, ty, tw, 52); }
    const done = state.wireDone?.(w.id);
    const row = [w.id, nm(w.from), nm(w.to), String(w.bitola).replace('.', ',') + ' mm²', w.cor === 'vd-am' ? 'verde-amarelo' : w.cor, WIRE_EST[w.id] ? `${Math.round(WIRE_EST[w.id] * 100)} cm` : '—'];
    row.forEach((c, j) => ui.text(c, tx + 12 + cols[j] * tw, ty + 35, { size: 22, color: '#111', weight: j === 0 ? 700 : 400, mono: j === 0 }));
    if (done) { ui.text('ligado', tx + tw - 90, ty + 35, { size: 20, color: C.verdeTxt, weight: 700 }); }
    ty += 52;
  }
  ui.text('Corte sempre com folga de 5 a 10 cm sobre o trajeto. Decapagem = comprimento da ponteira (10 mm).', tx, ty + 44, { size: 22, color: '#333' });
}
