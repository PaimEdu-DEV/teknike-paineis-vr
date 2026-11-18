// Simulador elétrico simplificado: união de nós por condutores (0 Ω),
// cargas resistivas (bobinas, enrolamentos) e fontes rotuladas.
import { PARTS, MOTOR } from './data.js';

class UF {
  constructor() { this.p = new Map(); }
  f(a) { if (!this.p.has(a)) this.p.set(a, a); let r = a; while (this.p.get(r) !== r) r = this.p.get(r); let c = a; while (this.p.get(c) !== r) { const n = this.p.get(c); this.p.set(c, r); c = n; } return r; }
  u(a, b) { const ra = this.f(a), rb = this.f(b); if (ra !== rb) this.p.set(ra, rb); }
}

const PHASE = { L1: 0, L2: 120, L3: 240 };
const VF = 380 / Math.sqrt(3); // tensão de fase para 380 V entre fases

export function partKey(st, role) { return st.placed[role]?.key; }
export function partOf(st, role) { const k = partKey(st, role); return k ? PARTS[k] : null; }

// Monta a rede para o estado st. kmClosed/raOn vêm da iteração.
function build(st, kmClosed, raOn) {
  const uf = new UF(); const res = []; // [a,b,R,label]
  const P = st.placed;
  // bornes: a-b ligados
  for (const role of ['X0', 'X24', 'XP']) {
    if (!P[role]) continue;
    for (const pin of PARTS[P[role].key].pins) uf.u(`${role}:${pin}a`, `${role}:${pin}b`);
  }
  // pré-ligações (vêm de fora da placa)
  uf.u('X0:L1.2b', 'SRC_L1'); uf.u('X0:L2.2b', 'SRC_L2'); uf.u('X0:L3.2b', 'SRC_L3');
  uf.u('X24:S+b', 'SRC_DCP'); uf.u('X24:0Va', 'SRC_DC0');
  if (P.RA) { uf.u('RA:A1', 'SRC_OUT10'); uf.u('RA:A2', 'SRC_DC0'); }
  // barra PE e aterramento
  for (const i of [1, 2, 3, 4]) uf.u(`PE:${i}`, 'PEBAR');
  if (st.plate.installed) uf.u('PEBAR', 'ENC');
  if (st.door.strap) uf.u('DOOR', 'ENC');
  // disjuntor-motor
  if (P.QM && st.qm.on) { uf.u('QM:1', 'QM:2'); uf.u('QM:3', 'QM:4'); uf.u('QM:5', 'QM:6'); uf.u('QM:13', 'QM:14'); }
  // link
  if (st.link.installed && P.QM && P.KM) { uf.u('QM:2', 'KM:1'); uf.u('QM:4', 'KM:3'); uf.u('QM:6', 'KM:5'); }
  // contator
  if (P.KM) {
    if (kmClosed || st.km.pressed) { uf.u('KM:1', 'KM:2'); uf.u('KM:3', 'KM:4'); uf.u('KM:5', 'KM:6'); }
    res.push(['KM:A1', 'KM:A2', PARTS[P.KM.key].coil === 'DC24' ? 240 : 620, 'bobina KM151']);
  }
  if (P.RA) {
    if (raOn) uf.u('RA:11', 'RA:14'); else uf.u('RA:11', 'RA:12');
    res.push(['RA:A1', 'RA:A2', 1100, 'bobina RA26']);
  }
  // fios
  for (const w of st.wires) {
    if (!w.to || w.popped?.some(Boolean)) continue;
    uf.u(w.from, w.to);
  }
  // motor de teste
  if (st.motorConnected && P.XP) {
    uf.u('XP:37b', 'MU'); uf.u('XP:38b', 'MV'); uf.u('XP:39b', 'MW'); uf.u('XP:40b', 'MPE');
    res.push(['MU', 'MV', 24, 'enrolamento'], ['MV', 'MW', 24, 'enrolamento'], ['MU', 'MW', 24, 'enrolamento']);
  }
  return { uf, res };
}

function labels(st, uf, withSources) {
  // rótulos de fonte por grupo
  const lab = new Map();
  const add = (node, l) => { const r = uf.f(node); if (!lab.has(r)) lab.set(r, new Set()); lab.get(r).add(l); };
  if (withSources) {
    if (st.placed.X0) { add('SRC_L1', 'L1'); add('SRC_L2', 'L2'); add('SRC_L3', 'L3'); }
    add('ENC', 'G'); if (st.motorConnected) add('MPE', 'G');
    if (st.placed.X24) { add('SRC_DCP', 'DC+'); add('SRC_DC0', 'DC0'); }
    if (st.out10) add('SRC_OUT10', 'DC+'); else add('SRC_OUT10', 'OPEN');
    add('SRC_DC0', 'DC0');
  }
  return lab;
}

// Resolve o estado elétrico. hyp = sobreposições hipotéticas.
export function solve(st0, hyp = null) {
  const st = hyp ? { ...st0, ...hyp, qm: { ...st0.qm, ...(hyp.qm || {}) }, km: { ...st0.km, ...(hyp.km || {}) } } : st0;
  const powered = st.power;
  let km = false, ra = false, net, lab;
  for (let it = 0; it < 6; it++) {
    net = build(st, km, ra);
    lab = labels(st, net.uf, powered);
    const L = (n) => lab.get(net.uf.f(n)) || new Set();
    const one = (n) => { const s = [...L(n)].filter(x => x !== 'OPEN'); return s.length === 1 ? s[0] : (s.length ? 'MULTI' : null); };
    // bobina do RA: A1 recebe OUT10, A2 0V
    const raNew = !!(st.placed.RA && one('RA:A1') === 'DC+' && one('RA:A2') === 'DC0');
    let kmNew = false;
    if (st.placed.KM) {
      const a = one('KM:A1'), b = one('KM:A2');
      const coil = PARTS[st.placed.KM.key].coil;
      if (coil === 'DC24') kmNew = (a === 'DC+' && b === 'DC0') || (a === 'DC0' && b === 'DC+');
      else kmNew = !!(a && b && a !== b && ['L1', 'L2', 'L3', 'G'].includes(a) && ['L1', 'L2', 'L3', 'G'].includes(b));
    }
    if (kmNew === km && raNew === ra) break;
    km = kmNew; ra = raNew;
  }
  // curto: grupo com mais de uma fonte diferente
  const shorts = [];
  if (powered) {
    for (const [r, s] of lab) {
      const real = [...s].filter(x => x !== 'OPEN');
      if (real.length > 1) shorts.push(real.sort().join(' × '));
    }
  }
  // detecção sem energia (para os itens do checklist)
  const labS = labels(st, net.uf, true);
  const shortsDry = [];
  for (const [r, s] of labS) { const real = [...s].filter(x => x !== 'OPEN'); if (real.length > 1) shortsDry.push(real); }

  const group = (n) => net.uf.f(n);
  const src = (n) => { const s = [...(lab.get(group(n)) || [])].filter(x => x !== 'OPEN'); return s.length === 1 ? s[0] : null; };

  // motor
  let motor = { state: 'off' };
  if (st.motorConnected && powered && st.placed.XP) {
    const ph = ['MU', 'MV', 'MW'].map(src);
    const ok = ph.filter(p => p in PHASE);
    const uniq = new Set(ok);
    if (uniq.size === 3) {
      const a = ph.map(p => PHASE[p]);
      const fwd = ((a[1] - a[0] + 360) % 360) === 120;
      motor = { state: 'run', dir: fwd ? 'horario' : 'anti', current: MOTOR.inom };
    } else if (uniq.size === 2) motor = { state: 'falta', current: MOTOR.inom * 1.7 };
    else motor = { state: 'off' };
  }
  return { st, net, lab, km, ra, shorts, shortsDry, group, src, motor };
}

// Resistência entre dois nós (multímetro em Ω). Retorna número (Ω) ou Infinity.
export function ohm(st, a, b) {
  const S = solve(st, { power: false, out10: false });
  const ga = S.group(a), gb = S.group(b);
  if (ga === gb) return 0;
  // Dijkstra entre grupos via resistências
  const adj = new Map();
  for (const [x, y, R] of S.net.res) {
    const gx = S.group(x), gy = S.group(y); if (gx === gy) continue;
    if (!adj.has(gx)) adj.set(gx, []); if (!adj.has(gy)) adj.set(gy, []);
    adj.get(gx).push([gy, R]); adj.get(gy).push([gx, R]);
  }
  const dist = new Map([[ga, 0]]); const q = [[0, ga]];
  while (q.length) {
    q.sort((m, n) => m[0] - n[0]); const [d, g] = q.shift();
    if (g === gb) return d;
    for (const [n, R] of adj.get(g) || []) if (!dist.has(n) || dist.get(n) > d + R) { dist.set(n, d + R); q.push([d + R, n]); }
  }
  return Infinity;
}

export function volt(st, a, b, mode) {
  const S = solve(st);
  if (!st.power || S.shorts.length) return 0;
  const sa = S.src(a), sb = S.src(b);
  if (mode === 'vac') {
    const vec = (s) => s in PHASE ? [VF * Math.cos(PHASE[s] * Math.PI / 180), VF * Math.sin(PHASE[s] * Math.PI / 180)] : (s === 'G' ? [0, 0] : null);
    const va = vec(sa), vb = vec(sb);
    if (!va || !vb) return 0;
    return Math.hypot(va[0] - vb[0], va[1] - vb[1]);
  }
  const dc = (s) => s === 'DC+' ? 24 : (s === 'DC0' ? 0 : null);
  const da = dc(sa), db = dc(sb);
  if (da === null || db === null) return 0;
  return da - db;
}
