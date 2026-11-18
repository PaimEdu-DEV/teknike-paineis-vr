// Lógica do jogo: estado, missões, interações, tablet, testes.
import * as THREE from '../vendor/three.module.min.js';
import { E, register, unregister, goView, toast, bringTablet, defineView, setHandTag } from './engine.js';
import { W, PLATE_SCALE, EASEL_POS } from './world.js';
import { buildBornes, buildGV2, buildLC1D, buildRelay, buildLink, hitbox, box, cyl, mat, labelPlane, screwMesh, PLATE, labelTexture } from './models.js';
import { PARTS, TRAY_ORDER, SLOTS, RAILS, WIRES, CABLES, CUT_OPTIONS, STRIP_OPTIONS, FERRULES, WIRE_COLORS, MOTOR,
  INTRO_CARDS, LESSON_CARDS, QUIZ, MOUNT_CARDS, WIRE_CARDS, ENCL_CARDS, TEST_INTRO, CHECKLIST, CHECK_EXPLAIN, ALIASES } from './data.js';
import { solve, ohm, volt } from './sim.js';
import { drawBoard, WIRE_EST } from './diagrams.js';
import { C, ICONS } from './ui.js';
import { sfx, motorSound } from './audio.js';

const V3 = THREE.Vector3;
// ================= Estado =================
function freshState() {
  return {
    placed: {}, // role -> {key, slot}
    railScrews: [false, false, false, false, false, false],
    link: { installed: false, tight: false },
    wires: [],
    qm: { on: false, setting: 1.6, tripped: false },
    km: { pressed: false },
    power: false, out10: false, motorConnected: false, cones: false,
    plate: { installed: false, nuts: [false, false, false, false] },
    door: { open: false, strap: false },
  };
}
export let st = freshState();
const ses = {
  screen: 'intro', card: 0, quiz: { i: 0, fb: null, wrong: 0 }, tool: 'mao', hand: null, pending: null,
  log: [], flags: {}, meas: [], probe: null, reading: null, piece: null, lastPiece: null, item: 0, marks: {}, itemFb: null,
  startT: Date.now(), mode: 'normal', dial: false, done: {}, arcT: 0,
};
const board = { tab: 'f12', regions: [], flash: null, setTab: (t) => { board.tab = t; W.boardUI.dirty = true; }, wireDone: (id) => st.wires.some(w => w.wid === id && w.to) };

function logErr(kind, msg, pts = 5) { if (ses.log.some(l => l.msg === msg)) return; ses.log.push({ kind, msg, pts, t: Date.now() }); }
const dirty = () => { E.tablet.dirty = true; };
const dirtyBoard = () => { W.boardUI.dirty = true; };

// ================= Inicialização =================
export function initGame() {
  defineView('projeto', [-0.3, 1.58, 0.12], [-1.12, 1.42, -0.62], [0.36, -0.3, 0.5]);
  defineView('placa', [0, 1.6, 0.05], [0, 1.28, -0.83], [-0.46, -0.3, 0.42]);
  defineView('cabos', [0.5, 1.5, 0.08], [1.1, 0.86, -0.42], [-0.48, -0.25, 0.42], 0.0);
  defineView('quadro', [3.0, 1.6, 0.12], [3.0, 1.3, -0.98], [-0.5, -0.3, 0.45]);
  defineView('console', [3.45, 1.5, 0.12], [3.98, 0.88, -0.45], [-0.46, -0.28, 0.42], 0.05);
  E.tablet.render = drawTablet;
  W.boardUI.render = () => drawBoard(W.boardUI, board);
  // clique em regiões do quadro (quiz "toque")
  const bia = W.board.userData.ia; const orig = bia.action;
  bia.action = (hit, ptr) => {
    const ui = W.boardUI; const px = hit.uv.x * ui.w, py = (1 - hit.uv.y) * ui.h;
    const b = ui.hit(px, py); if (b) return orig(hit, ptr);
    const r = board.regions.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h);
    if (ses.screen === 'quiz' && QUIZ[ses.quiz.i].type === 'pick' && !ses.quiz.fb) return { type: 'click', run: () => answerPick(r ? r.id : null) };
    return null;
  };
  buildTray(); buildSlotMarkers(); buildRailScrewIA(); buildPEIA(); buildWireBench(); buildEnclosureIA(); buildConsole();
  estimateRoutes();
  E.update.push(tick);
  E.onKey = (e) => { if (e.key === '1') setTool('mao'); if (e.key === '2') setTool('chave'); if (e.key === '3') setTool('multi'); };
  E.onButton = (b) => { if (b === 'a') setTool(ses.tool === 'mao' ? 'chave' : ses.tool === 'chave' ? 'multi' : 'mao'); if (b === 'b') bringTablet(); };
  goView('projeto', true);
  refresh();
}
function setTool(t) { ses.tool = t; ses.probe = null; updateProbes(); if (t !== 'chave') ses.dial = false; dirty(); sfx.click(); }

// ================= Placa: componentes =================
const plateParts = {}; // role -> {group, terms, extra, key, hits:[]}
const termHits = new Map(); // termId -> mesh
function termLabel(id) {
  if (id === 'DOOR') return 'Terra da porta'; if (id === 'ENC') return 'Terra da carcaça';
  const [role, pin] = id.split(':');
  if (role === 'PE') return 'Barra PE · ' + pin;
  const tag = PARTS[role]?.tag || role; return `${tag} · borne ${pin.replace(/(\d)[ab]$/, '$1').replace(/^(L\d\.2|S\+|0V)[ab]$/, '$1')}${/[ab]$/.test(pin) ? (pin.endsWith('a') ? ' (em cima)' : ' (embaixo)') : ''}`;
}
function builderFor(key) {
  const p = PARTS[key];
  if (p.kind === 'bornes') return buildBornes(p.pins, p.pe ? [p.pe] : [], p.tag, key === 'X24' ? { 'S+': '#c84a3c', '0V': '#3b67c4' } : {});
  if (p.kind === 'gv2') return buildGV2(p);
  if (p.kind === 'lc1d') return buildLC1D(p);
  if (p.kind === 'relay') return buildRelay(p);
  if (p.kind === 'link') return buildLink();
}
function roleOf(key) { return key.replace(/x$/, ''); }
function placePart(key, slot) {
  const role = roleOf(key); const b = builderFor(key);
  const s = SLOTS[slot]; const y = RAILS[s.rail];
  b.group.position.set(s.x, y, 0.0075 + b.size.d / 2);
  W.plateRoot.add(b.group);
  const rec = { ...b, key, slot, role, hits: [] };
  // corpo (retirar)
  const body = hitbox(b.size.w, b.size.h * 0.5, 0.01, 0, -b.size.h * 0.05, b.size.d / 2 - 0.004); b.group.add(body);
  register(body, {
    label: () => `${PARTS[key].tag} · ${PARTS[key].name} · ${PARTS[key].code}`,
    action: () => {
      if (ses.tool === 'mao' && ses.hand?.type === 'link') return { type: 'click', run: () => tryLinkClick() };
      if (ses.tool === 'mao' && key.startsWith('KM') && ses.screen !== 'mont') return { type: 'click', run: () => pressKM() };
      if (ses.tool !== 'mao' || ses.hand) return null;
      return { type: 'hold', time: 0.6, run: () => removePart(role) };
    },
  });
  rec.hits.push(body);
  // botões do disjuntor-motor e dial
  if (b.extra?.bI) {
    const hI = hitbox(0.016, 0.016, 0.012, b.extra.bI.position.x, b.extra.bI.position.y, b.extra.bI.position.z + 0.004); b.group.add(hI);
    register(hI, { label: 'Botão I (armar) do -QM151', action: () => ses.tool === 'mao' ? { type: 'click', run: () => setQM(true) } : null }); rec.hits.push(hI);
    const hO = hitbox(0.016, 0.016, 0.012, b.extra.bO.position.x, b.extra.bO.position.y, b.extra.bO.position.z + 0.004); b.group.add(hO);
    register(hO, { label: 'Botão O (desarmar) do -QM151', action: () => ses.tool === 'mao' ? { type: 'click', run: () => setQM(false) } : null }); rec.hits.push(hO);
    const hD = hitbox(0.016, 0.014, 0.012, 0, -0.015, b.size.d / 2 + 0.004); b.group.add(hD);
    register(hD, { label: () => `Dial de regulagem: ${fmtA(st.qm.setting)} (faixa ${PARTS[key].range.map(fmtA).join(' a ')})`, action: () => ses.tool === 'chave' ? { type: 'click', run: () => { ses.dial = true; dirty(); } } : null }); rec.hits.push(hD);
  }
  if (b.extra?.win) {
    const hK = hitbox(0.03, 0.02, 0.01, 0, -0.006, b.size.d / 2 + 0.004); b.group.add(hK);
    register(hK, { label: 'Visor do contator: acionar manualmente (teste)', action: () => ses.tool === 'mao' && !ses.hand ? { type: 'click', run: () => pressKM() } : null }); rec.hits.push(hK);
  }
  // terminais
  for (const t of b.terms) {
    const id = `${role}:${t.pin}`;
    const p = b.group.position.clone().add(t.pos);
    const h = hitbox(0.0086, 0.013, 0.012, p.x, p.y, p.z); W.plateRoot.add(h);
    h.userData.term = { id, pos: p, face: t.face };
    registerTerm(h, id);
    termHits.set(id, h); rec.hits.push(h);
  }
  plateParts[role] = rec;
  st.placed[role] = { key, slot };
  if (role === 'QM') { const rg = PARTS[key].range; if (st.qm.setting < rg[0] || st.qm.setting > rg[1]) st.qm.setting = rg[0]; }
  sfx.snap();
  rebuildPrewired();
}
function registerTerm(h, id) {
  register(h, {
    label: () => { const w = wireAt(id); return termLabel(id) + (w ? ` · fio ${w.wid}${w.tight[w.from === id ? 0 : 1] ? '' : ' (solto)'}` : ''); },
    action: () => termAction(id),
  });
}
function removePart(role) {
  const r = plateParts[role]; if (!r) return;
  const ids = r.terms.map(t => `${role}:${t.pin}`);
  if (st.wires.some(w => ids.includes(w.from) || ids.includes(w.to))) { toast('Retire primeiro os fios ligados nesta peça.', 'warn'); return; }
  if ((role === 'QM' || role === 'KM') && st.link.installed) { toast('Retire primeiro o link GV2AF3.', 'warn'); return; }
  for (const h of r.hits) { unregister(h); h.parent?.remove(h); }
  for (const id of ids) termHits.delete(id);
  W.plateRoot.remove(r.group);
  delete plateParts[role]; delete st.placed[role];
  trayItems[r.key].visible = true;
  sfx.snap(); rebuildPrewired(); refresh();
}

// ================= Bandeja =================
const trayItems = {};
function buildTray() {
  const n = TRAY_ORDER.length;
  TRAY_ORDER.forEach((key, i) => {
    const b = builderFor(key);
    const g = new THREE.Group(); g.add(b.group); b.group.position.y = b.size.h / 2;
    g.scale.setScalar(PLATE_SCALE);
    g.position.set(-0.52 + i * 0.13, W.trayY, W.trayZ); E.scene.add(g);
    const hb = hitbox(b.size.w + 0.01, b.size.h + 0.01, b.size.d, 0, b.size.h / 2, 0); g.add(hb);
    register(hb, {
      label: () => `${PARTS[key].name} · ${PARTS[key].code}`,
      action: () => ses.tool === 'mao' ? { type: 'click', run: () => takeFromTray(key) } : null,
    });
    trayItems[key] = g;
  });
}
function takeFromTray(key) {
  if (ses.hand?.type === 'wire' || ses.hand?.type === 'plate') { toast('Você já está segurando outra coisa.', 'warn'); return; }
  if (ses.hand?.type === 'part' || ses.hand?.type === 'link') trayItems[ses.hand.key].visible = true;
  if (ses.hand?.key === key) { ses.hand = null; dirty(); return; }
  ses.hand = { type: key === 'LINK' ? 'link' : 'part', key };
  trayItems[key].visible = false; sfx.click(); dirty(); updateMarkers();
}

// ================= Marcadores de slot e link =================
const slotMarkers = {};
let linkMarker = null, linkMesh = null;
function buildSlotMarkers() {
  for (const [id, s] of Object.entries(SLOTS)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), mat('#56B951', { transparent: true, opacity: 0.35 }));
    m.position.set(s.x, RAILS[s.rail], 0.02); m.visible = false; W.plateRoot.add(m); slotMarkers[id] = m;
    register(m, { label: `Trilho ${s.rail} · posição ${id.toUpperCase()}`, action: () => ses.hand?.type === 'part' ? { type: 'click', run: () => dropOnSlot(id) } : null });
  }
  linkMarker = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.016, 0.03), mat('#56B951', { transparent: true, opacity: 0.45 }));
  linkMarker.visible = false; W.plateRoot.add(linkMarker);
  register(linkMarker, { label: 'Encaixar o link GV2AF3 aqui', action: () => ses.hand?.type === 'link' ? { type: 'click', run: () => installLink() } : null });
}
function slotFree(id) { return !Object.values(st.placed).some(p => p.slot === id); }
function updateMarkers() {
  for (const [id, m] of Object.entries(slotMarkers)) m.visible = ses.hand?.type === 'part' && slotFree(id) && !st.plate.installed;
  const ok = linkAligned();
  linkMarker.visible = ses.hand?.type === 'link' && !!ok;
  if (ok) linkMarker.position.set(SLOTS[st.placed.QM.slot].x, 0.0795, 0.088);
}
function linkAligned() {
  const q = st.placed.QM, k = st.placed.KM; if (!q || !k) return false;
  return SLOTS[q.slot].rail === 'A' && SLOTS[k.slot].rail === 'B' && Math.abs(SLOTS[q.slot].x - SLOTS[k.slot].x) < 0.005;
}
function dropOnSlot(id) {
  const key = ses.hand.key; const role = roleOf(key);
  if (st.placed[role]) { toast(`Já existe um ${PARTS[key].tag} na placa. Cada tag é única: retire o outro primeiro.`, 'warn'); return; }
  if (!slotFree(id)) return;
  placePart(key, id); ses.hand = null; updateMarkers(); refresh(); dirty();
}
function tryLinkClick() { if (linkAligned()) return installLink(); { toast('O link GV2AF3 só encaixa com o contator logo abaixo do disjuntor-motor. Confira o layout.', 'err'); logErr('Montagem', 'Tentou instalar o link com o contator fora da posição do layout', 3); } }
function installLink() {
  if (!linkAligned()) return tryLinkClick();
  st.link.installed = true; st.link.tight = false; ses.hand = null;
  showLink(); sfx.snap(); updateMarkers(); refresh(); dirty();
}
function showLink() {
  if (linkMesh) { unregister(linkMesh.userData.hb); W.plateRoot.remove(linkMesh); linkMesh = null; }
  if (!st.link.installed) return;
  const b = buildLink(); linkMesh = b.group; linkMesh.position.set(SLOTS[st.placed.QM.slot].x, 0.0795, 0.045); W.plateRoot.add(linkMesh);
  const hb = hitbox(0.046, 0.016, 0.034, 0, 0, 0); linkMesh.add(hb); linkMesh.userData.hb = hb;
  register(hb, {
    label: () => `Link -BRI1 GV2AF3 · ${st.link.tight ? 'apertado' : 'parafusos soltos'}`,
    action: () => {
      if (ses.tool === 'chave' && !st.link.tight) return { type: 'hold', time: 0.8, run: () => { st.link.tight = true; sfx.tight(); dirty(); }, progress: (p) => { if (Math.random() < 0.1) sfx.screw(); } };
      if (ses.tool === 'mao' && !ses.hand) return { type: 'hold', time: 0.6, run: () => { st.link.installed = false; st.link.tight = false; showLink(); trayItems.LINK.visible = true; refresh(); dirty(); } };
      return null;
    },
  });
}

// ================= Parafusos dos trilhos / PE =================
function buildRailScrewIA() {
  W.railScrews.forEach((s, i) => {
    const hb = hitbox(0.012, 0.012, 0.012, 0, 0, 0); s.mesh.add(hb);
    register(hb, {
      label: () => `Parafuso do trilho ${s.rail} · ${st.railScrews[i] ? 'apertado' : 'solto'}`,
      action: () => ses.tool === 'chave' && !st.railScrews[i] ? { type: 'hold', time: 0.7, run: () => { st.railScrews[i] = true; sfx.tight(); refreshScrews(); dirty(); } } : (ses.tool === 'chave' ? { type: 'click', run: () => toast('Este parafuso já está apertado.', 'info', 2) } : null),
    });
  });
  refreshScrews();
}
function refreshScrews() {
  W.railScrews.forEach((s, i) => { s.mesh.position.z = st.railScrews[i] ? 0.0012 : 0.0045; s.mesh.rotation.z = st.railScrews[i] ? 0.6 : 0; });
  plateNuts.forEach((n, i) => { n.position.z = st.plate.nuts[i] ? 0.0012 : 0.006; });
}
function buildPEIA() {
  for (const t of W.peBar.terms) {
    const id = `PE:${t.pin}`; const p = W.peBar.group.position.clone().add(t.pos);
    const h = hitbox(0.009, 0.01, 0.01, p.x, p.y, p.z); W.plateRoot.add(h); h.userData.term = { id, pos: p, face: 'top' };
    registerTerm(h, id); termHits.set(id, h);
  }
}

// ================= Fios na placa =================
const DUCTS = PLATE.ducts;
function termInfo(id) {
  const h = termHits.get(id); if (h) return h.userData.term;
  return null;
}
function ductFor(p, face) {
  if (face === 'top') return DUCTS.filter(d => d > p.y).sort((a, b) => a - b)[0] ?? DUCTS[0];
  if (face === 'bottom') return DUCTS.filter(d => d < p.y).sort((a, b) => b - a)[0] ?? DUCTS[2];
  return DUCTS.slice().sort((a, b) => Math.abs(a - p.y) - Math.abs(b - p.y))[0];
}
function lead(t) { const d = t.face === 'top' ? 1 : t.face === 'bottom' ? -1 : 0; return new V3(t.pos.x, t.pos.y + d * 0.012, t.pos.z + (t.face === 'front' ? 0.014 : 0.006)); }
function route(a, b) {
  const zD = 0.03; let pts;
  if (Math.abs(a.pos.x - b.pos.x) < 0.04 && Math.abs(a.pos.y - b.pos.y) < 0.115) {
    const m = a.pos.clone().add(b.pos).multiplyScalar(0.5); m.z = Math.max(a.pos.z, b.pos.z) + 0.018;
    pts = [a.pos.clone(), lead(a), m, lead(b), b.pos.clone()];
  } else {
    const da = ductFor(a.pos, a.face), db = ductFor(b.pos, b.face);
    pts = [a.pos.clone(), lead(a), new V3(a.pos.x, da, zD)];
    if (da === db) pts.push(new V3(b.pos.x, db, zD));
    else { const sx = (a.pos.x + b.pos.x) / 2 < 0 ? -PLATE.sideX : PLATE.sideX; pts.push(new V3(sx, da, zD), new V3(sx, db, zD), new V3(b.pos.x, db, zD)); }
    pts.push(lead(b), b.pos.clone());
  }
  const out = [pts[0]]; for (const p of pts.slice(1)) if (p.distanceTo(out[out.length - 1]) > 0.002) out.push(p);
  return out;
}
function routeLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]); return s; }
function estimateRoutes() {
  // posições ideais (layout) para estimar trajetos da lista de fios
  const fake = {};
  for (const role of ['X0', 'QM', 'RA', 'X24', 'KM', 'XP']) {
    const b = builderFor(role); const s = SLOTS[PARTS[role].slot]; const gp = new V3(s.x, RAILS[s.rail], 0.0075 + b.size.d / 2);
    for (const t of b.terms) fake[`${role}:${t.pin}`] = { pos: gp.clone().add(t.pos), face: t.face };
  }
  for (const t of W.peBar.terms) fake[`PE:${t.pin}`] = { pos: W.peBar.group.position.clone().add(t.pos), face: 'top' };
  for (const w of WIRES) { const a = fake[w.from], b = fake[w.to]; if (a && b) WIRE_EST[w.id] = routeLen(route(a, b)); }
}
const wireMeshes = new Map(); // wire -> group
function wireAt(id) { return st.wires.find(w => w.from === id || w.to === id); }
function drawWire(w) {
  const old = wireMeshes.get(w); if (old) { old.traverse(o => { if (o.userData.ia) unregister(o); }); W.plateRoot.remove(old); }
  const a = termInfo(w.from), b = termInfo(w.to); if (!a || !b) return;
  const pa = { ...a, pos: a.pos.clone() }, pb = { ...b, pos: b.pos.clone() };
  if (w.popped[0]) pa.pos.add(new V3(0, a.face === 'top' ? 0.02 : -0.02, 0.025));
  if (w.popped[1]) pb.pos.add(new V3(0, b.face === 'top' ? 0.02 : -0.02, 0.025));
  const pts = route(pa, pb); w.route = routeLen(route(a, b));
  const r = w.cable.bitola >= 2.5 ? 0.0019 : 0.0012;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 10), r, 6, false), mat(WIRE_COLORS[w.cable.cor]));
  g.add(tube);
  if (w.cable.cor === 'vd-am') { const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, r * 1.04, 6, false), mat('#e8d23a', { transparent: true, opacity: 0.55 })); g.add(t2); }
  // pontas: ponteira e cobre exposto
  [[pa, 0], [pb, 1]].forEach(([t, i]) => {
    const e = w.ends[i]; const fr = FERRULES.find(f => f.id === e.ferrule);
    const dir = new V3(0, t.face === 'top' ? 1 : t.face === 'bottom' ? -1 : 0, t.face === 'front' ? 1 : 0);
    if (fr) { const m = cyl(r * 1.25, 0.008, fr.hex, 0, 0, 0, 'y', 8); m.position.copy(t.pos).addScaledVector(dir, 0.006); if (t.face === 'front') m.rotation.x = Math.PI / 2; g.add(m); }
    if (e.strip === 15) { const cu = cyl(r * 0.7, 0.005, '#c87533', 0, 0, 0, 'y', 6); cu.position.copy(t.pos).addScaledVector(dir, 0.012); if (t.face === 'front') cu.rotation.x = Math.PI / 2; g.add(cu); }
    // anilha
    const an = cyl(r * 1.35, 0.005, '#f5f5f5', 0, 0, 0, 'y', 8); an.position.copy(t.pos).addScaledVector(dir, 0.016); if (t.face === 'front') an.rotation.x = Math.PI / 2; g.add(an);
  });
  register(tube, {
    label: () => `Fio ${w.wid} · ${fmtB(w.cable.bitola)} ${corName(w.cable.cor)} · ${termLabel(w.from)} → ${termLabel(w.to)}${w.popped.some(Boolean) ? ' · SOLTO' : ''}`,
    action: () => ses.tool === 'mao' && !ses.hand ? { type: 'hold', time: 0.7, run: () => removeWire(w) } : null,
  });
  W.plateRoot.add(g); wireMeshes.set(w, g);
}
function removeWire(w) {
  const g = wireMeshes.get(w); if (g) { g.traverse(o => { if (o.userData.ia) unregister(o); }); W.plateRoot.remove(g); wireMeshes.delete(w); }
  st.wires.splice(st.wires.indexOf(w), 1); dirtyBoard(); toast(`Fio ${w.wid} retirado. Prepare um novo na bancada de cabos.`, 'info', 3); sfx.snap(); refresh(); dirty();
}
function redrawAllWires() { for (const w of st.wires) drawWire(w); }

// cabos pré-ligados (chegam de fora da placa)
let prewired = [];
function rebuildPrewired() {
  for (const m of prewired) W.plateRoot.remove(m); prewired = [];
  const mk = (id, color, r, side, toTop = true) => {
    const t = termInfo(id); if (!t) return;
    const d = ductFor(t.pos, t.face); const sx = side < 0 ? -PLATE.sideX : PLATE.sideX;
    const pts = [t.pos.clone(), lead(t), new V3(t.pos.x, d, 0.03), new V3(sx, d, 0.03), new V3(sx, toTop ? 0.26 : -0.26, 0.03), new V3(sx, toTop ? 0.34 : -0.34, 0.03)];
    const out = [pts[0]]; for (const p of pts.slice(1)) if (p.distanceTo(out[out.length - 1]) > 0.002) out.push(p);
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(out, false, 'catmullrom', 0.15), 40, r, 6), mat(color));
    W.plateRoot.add(m); prewired.push(m);
  };
  if (st.placed.X0) ['L1.2b', 'L2.2b', 'L3.2b'].forEach(p => mk('X0:' + p, '#1d1d1f', 0.0026, -1));
  if (st.placed.X24) { mk('X24:S+b', '#1f4fbf', 0.0012, 1); mk('X24:0Va', '#1f4fbf', 0.0012, 1); }
  if (st.placed.RA) { mk('RA:A1', '#1f4fbf', 0.0012, 1); mk('RA:A2', '#1f4fbf', 0.0012, 1); }
  mk('PE:1', '#3fae49', 0.0026, -1, false);
  if (st.motorConnected && st.placed.XP) ['37b', '38b', '39b', '40b'].forEach(p => mk('XP:' + p, p === '40b' ? '#3fae49' : '#55595e', 0.002, 1, false));
}
function isPrewired(id) { return ['X0:L1.2b', 'X0:L2.2b', 'X0:L3.2b', 'X24:S+b', 'X24:0Va', 'RA:A1', 'RA:A2', 'PE:1'].includes(id) || (st.motorConnected && /^XP:\d\db$/.test(id)); }

function termAction(id) {
  const tool = ses.tool;
  if (tool === 'multi') return { type: 'click', run: () => probe(id) };
  if (tool === 'chave') {
    const w = wireAt(id); if (!w) return { type: 'click', run: () => toast(isPrewired(id) ? 'Este borne é ligado de fábrica (cabo externo).' : 'Não há fio neste borne para apertar.', 'info', 2) };
    const i = w.from === id ? 0 : 1; if (w.tight[i]) return { type: 'click', run: () => toast('Esta conexão já está apertada.', 'info', 2) };
    if (w.popped[i]) return { type: 'click', run: () => toast('Este fio se soltou: retire e refaça.', 'warn') };
    return { type: 'hold', time: 0.7, run: () => { w.tight[i] = true; sfx.tight(); dirty(); } };
  }
  if (tool === 'mao' && ses.hand?.type === 'wire') return { type: 'click', run: () => connectClick(id) };
  if (tool === 'mao' && ses.hand?.type === 'link') return { type: 'click', run: () => tryLinkClick() };
  return null;
}
function connectClick(id) {
  if (st.power) { toast('Desenergize o painel antes de mexer na fiação.', 'err'); logErr('Segurança', 'Tentou mexer na fiação com o painel energizado', 10); return; }
  const occ = (x) => isPrewired(x) || (!x.startsWith('PE:') && wireAt(x));
  if (!ses.pending) {
    if (occ(id)) { toast('Este borne já está ocupado.', 'warn'); return; }
    ses.pending = id; showPendingMarker(id); sfx.click(); dirty(); return;
  }
  if (id === ses.pending) { ses.pending = null; showPendingMarker(null); dirty(); return; }
  if (occ(id)) { toast('Este borne já está ocupado.', 'warn'); return; }
  const a = termInfo(ses.pending), b = termInfo(id);
  const need = routeLen(route(a, b)) + 0.03;
  const pc = ses.hand.piece;
  if (pc.length < need) {
    toast(`Fio curto demais: o trajeto pede cerca de ${Math.round(need * 100)} cm e o fio tem ${Math.round(pc.length * 100)} cm. Ele foi descartado.`, 'err', 6);
    logErr('Cabos', `Cortou o fio ${pc.wid} curto demais (${Math.round(pc.length * 100)} cm para ~${Math.round(need * 100)} cm)`, 3);
    ses.hand = null; ses.pending = null; showPendingMarker(null); dirty(); return;
  }
  const w = { wid: pc.wid, cable: pc.cable, length: pc.length, ends: pc.ends, from: ses.pending, to: id, tight: [false, false], popped: [false, false] };
  st.wires.push(w); drawWire(w);
  ses.hand = null; ses.pending = null; showPendingMarker(null); sfx.snap();
  dirtyBoard(); toast(`Fio ${w.wid} ligado. Agora aperte as duas pontas com a chave de fenda.`, 'info', 3);
  refresh(); dirty();
}
let pendingMk = null;
function showPendingMarker(id) {
  if (!pendingMk) { pendingMk = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), new THREE.MeshBasicMaterial({ color: C.verde })); W.plateRoot.add(pendingMk); }
  const t = id && termInfo(id); pendingMk.visible = !!t; if (t) pendingMk.position.copy(t.pos).add(new V3(0, 0, 0.006));
}

// ================= Multímetro =================
const probeMk = [];
function probe(id) {
  if (!ses.probe) { ses.probe = id; ses.reading = null; updateProbes(); sfx.click(); dirty(); return; }
  const a = ses.probe, b = id; ses.probe = null;
  const mode = ses.meter || 'ohm';
  let txt, val;
  if (mode === 'ohm') {
    if (st.power) { txt = 'ERRO'; logErr('Segurança', 'Mediu resistência com o painel energizado (risco de queimar o multímetro)', 5); toast('Nunca meça resistência/continuidade com o circuito energizado.', 'err'); }
    else { val = ohm(st, a, b); txt = val === Infinity ? 'OL' : (val === 0 ? '0,0 Ω' : `${Math.round(val)} Ω`); if (val === 0) sfx.beep(); }
  } else { val = volt(st, a, b, mode); txt = `${(Math.round(val * 10) / 10).toFixed(1).replace('.', ',')} V${mode === 'vac' ? '~' : '⎓'}`; }
  ses.reading = { a, b, mode, txt };
  ses.meas.push({ mode, a, b, val });
  updateProbes([a, b]); meterDisplay(); dirty();
}
function updateProbes(pair) {
  if (!probeMk.length) for (const c of ['#d0342c', '#111111']) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 12, 8), new THREE.MeshBasicMaterial({ color: c })); m.visible = false; E.scene.add(m); probeMk.push(m); }
  const ids = pair || (ses.probe ? [ses.probe] : []);
  probeMk.forEach((m, i) => {
    const id = ids[i]; m.visible = !!id; if (!id) return;
    const h = id === 'DOOR' ? W.doorStud : id === 'ENC' ? W.encStud : termHits.get(id);
    if (h) h.getWorldPosition(m.position);
  });
}

// ================= Bancada de cabos =================
const WB = {};
function buildWireBench() {
  const g = W.wireBench; const Y = 0.86;
  // bobinas
  CABLES.forEach((c, i) => {
    const x = -0.44 + i * 0.17; const gr = new THREE.Group(); gr.position.set(x, Y + 0.075, -0.17); g.add(gr);
    gr.add(cyl(0.07, 0.07, '#2a2e33', 0, 0, 0, 'x', 20));
    gr.add(cyl(0.058, 0.072, WIRE_COLORS[c.cor], 0, 0, 0, 'x', 20));
    if (c.cor === 'vd-am') gr.add(cyl(0.0585, 0.02, '#e8d23a', 0, 0, 0, 'x', 20));
    gr.add(box(0.012, 0.08, 0.04, '#3c4046', -0.045, -0.04, 0)); gr.add(box(0.012, 0.08, 0.04, '#3c4046', 0.045, -0.04, 0));
    const lab = labelPlane([{ t: fmtB(c.bitola), size: 40, bold: true }, { t: corName(c.cor), size: 28 }], 0.12, 0.05, { w: 256, h: 110, bg: '#ffffff' });
    lab.position.set(0, -0.045, 0.045); gr.add(lab);
    const hb = hitbox(0.14, 0.15, 0.1, 0, 0, 0); gr.add(hb);
    register(hb, { label: c.label, action: () => benchStep() === 'cable' ? { type: 'click', run: () => chooseCable(c) } : null });
  });
  // régua
  const x0 = -0.45; WB.x0 = x0; WB.Y = Y;
  g.add(box(0.72, 0.006, 0.05, '#e8c547', x0 + 0.36, Y + 0.003, 0.06));
  for (let cm = 0; cm <= 70; cm += 5) g.add(box(0.0015, 0.002, cm % 10 ? 0.012 : 0.022, '#100F0D', x0 + cm / 100, Y + 0.007, 0.045));
  CUT_OPTIONS.forEach((L) => {
    const lab = labelPlane([{ t: `${Math.round(L * 100)} cm`, size: 38, bold: true }], 0.06, 0.022, { w: 160, h: 60, bg: '#ffffff' });
    lab.position.set(x0 + L, Y + 0.008, 0.1); lab.rotation.x = -Math.PI / 2; g.add(lab);
    const hb = hitbox(0.05, 0.03, 0.09, x0 + L, Y + 0.01, 0.07); g.add(hb);
    register(hb, { label: `Cortar em ${Math.round(L * 100)} cm`, action: () => benchStep() === 'cut' ? { type: 'click', run: () => cutAt(L) } : null });
  });
  // peça de trabalho (fio sobre a tábua clara, atrás da régua)
  g.add(box(0.8, 0.004, 0.07, '#eef1ef', x0 + 0.36, Y + 0.002, -0.02));
  WB.piece = new THREE.Group(); g.add(WB.piece);
  // decapador
  const st0 = new THREE.Group(); st0.position.set(0.36, Y, 0.1); g.add(st0);
  st0.add(box(0.05, 0.02, 0.16, '#c63c32', 0, 0.01, 0)); st0.add(box(0.03, 0.022, 0.04, '#2a2e33', 0, 0.012, -0.08));
  const stl = labelPlane([{ t: 'Decapador', size: 30, bold: true, color: '#fff' }], 0.1, 0.02, { w: 256, h: 52, bg: '#0B2A1D' }); stl.position.set(0, 0.002, 0.11); stl.rotation.x = -Math.PI / 2; st0.add(stl);
  WB.stripBtns = {};
  STRIP_OPTIONS.forEach((mm, i) => {
    const b = box(0.04, 0.016, 0.026, '#ffffff', -0.06 + i * 0.045, 0.008, 0.16); st0.add(b);
    const l = labelPlane([{ t: `${mm} mm`, size: 40, bold: true }], 0.036, 0.018, { w: 128, h: 64, bg: '#ffffff' }); l.position.set(-0.06 + i * 0.045, 0.0165, 0.16); l.rotation.x = -Math.PI / 2; st0.add(l);
    register(b, { label: `Decapador: ajustar para ${mm} mm`, action: () => benchStep() === 'strip' ? { type: 'click', run: () => { WB.strip = mm; sfx.click(); dirty(); refreshBenchHighlights(); } } : null });
    WB.stripBtns[mm] = b;
  });
  // ponteiras
  WB.ferBtns = {};
  FERRULES.forEach((f, i) => {
    const b = box(0.05, 0.025, 0.05, '#e6e6e6', 0.14 + (i % 2) * 0.07, Y + 0.012, -0.2 + Math.floor(i / 2) * 0.07); g.add(b);
    for (let k = 0; k < 6; k++) { const fm = cyl(0.003, 0.012, f.hex, 0, 0, 0, 'y', 6); fm.position.set(b.position.x - 0.015 + (k % 3) * 0.015, Y + 0.03, b.position.z - 0.01 + Math.floor(k / 3) * 0.02); g.add(fm); }
    const l = labelPlane([{ t: f.label, size: 26, bold: true }], 0.06, 0.012, { w: 256, h: 52, bg: '#ffffff' }); l.position.set(b.position.x, Y + 0.026, b.position.z + 0.032); l.rotation.x = -Math.PI / 2; g.add(l);
    register(b, { label: `Ponteira ${f.label}`, action: () => benchStep() === 'ferrule' ? { type: 'click', run: () => { WB.ferrule = f.id; sfx.click(); dirty(); refreshBenchHighlights(); } } : null });
    WB.ferBtns[f.id] = b;
  });
  // crimpador
  const cr = new THREE.Group(); cr.position.set(0.47, Y, -0.02); g.add(cr);
  cr.add(box(0.03, 0.02, 0.18, '#2f63c9', -0.012, 0.01, 0)); cr.add(box(0.03, 0.02, 0.18, '#2f63c9', 0.022, 0.01, 0.01)); cr.add(box(0.05, 0.024, 0.05, '#55595e', 0.005, 0.012, -0.11));
  const crl = labelPlane([{ t: 'Crimpador', size: 30, bold: true, color: '#fff' }], 0.1, 0.02, { w: 256, h: 52, bg: '#0B2A1D' }); crl.position.set(0, 0.0245, -0.06); crl.rotation.x = -Math.PI / 2; cr.add(crl);
  const crh = hitbox(0.08, 0.04, 0.24, 0, 0.02, 0); cr.add(crh);
  register(crh, { label: 'Crimpador (catraca)', action: () => benchStep() === 'crimp' ? { type: 'click', run: () => { WB.crimpSel = true; sfx.click(); dirty(); refreshBenchHighlights(); } } : null });
  WB.crimper = cr;
  // destaque
  WB.hl = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.003, 6, 32), new THREE.MeshBasicMaterial({ color: C.verde })); WB.hl.rotation.x = Math.PI / 2; g.add(WB.hl);
  drawPiece();
}
function benchStep() {
  const p = ses.piece; if (!p) return 'none';
  if (!p.cable) return 'cable'; if (!p.length) return 'cut';
  if (p.ends.some(e => e.strip == null)) return 'strip';
  if (p.ends.some(e => e.ferrule == null)) return 'ferrule';
  if (p.ends.some(e => e.crimp == null)) return 'crimp';
  return 'ready';
}
function newEnds() { return [{ strip: null, ferrule: null, crimp: null }, { strip: null, ferrule: null, crimp: null }]; }
function startPiece(wid) { if (ses.hand?.type === 'wire') { toast('Você já tem um fio pronto na mão. Ligue-o na placa primeiro.', 'warn'); return; } ses.piece = { wid, cable: null, length: 0, ends: newEnds() }; WB.strip = null; WB.ferrule = null; WB.crimpSel = false; drawPiece(); dirty(); goView('cabos'); }
function chooseCable(c) { ses.piece.cable = { bitola: c.bitola, cor: c.cor }; sfx.click(); drawPiece(); dirty(); }
function cutAt(L) { ses.piece.length = L; sfx.cut(); drawPiece(); dirty(); }
function endAction(i) {
  const p = ses.piece; const e = p.ends[i]; const step = benchStep();
  if (step === 'strip') {
    if (!WB.strip) return { type: 'click', run: () => toast('Primeiro ajuste o comprimento no decapador (6, 10 ou 15 mm).', 'info') };
    if (e.strip != null) return { type: 'click', run: () => toast('Esta ponta já foi decapada.', 'info', 2) };
    return { type: 'click', run: () => { e.strip = WB.strip; sfx.cut(); drawPiece(); dirty(); } };
  }
  if (step === 'ferrule') {
    if (!WB.ferrule) return { type: 'click', run: () => toast('Escolha a ponteira na caixa de ponteiras.', 'info') };
    if (e.ferrule != null) return { type: 'click', run: () => toast('Esta ponta já tem ponteira.', 'info', 2) };
    return {
      type: 'click', run: () => {
        const f = FERRULES.find(x => x.id === WB.ferrule);
        if (f.bitola < p.cable.bitola) { toast(`A ponteira ${f.label} é pequena demais para o cabo ${fmtB(p.cable.bitola)}: o cabo não entra.`, 'err', 5); logErr('Cabos', `Tentou usar ponteira ${f.label} em cabo ${fmtB(p.cable.bitola)}`, 2); return; }
        e.ferrule = f.id; sfx.click(); drawPiece(); dirty();
      },
    };
  }
  if (step === 'crimp') {
    if (!WB.crimpSel) return { type: 'click', run: () => toast('Pegue o crimpador (toque nele).', 'info') };
    if (e.crimp != null) return { type: 'click', run: () => toast('Esta ponta já foi crimpada.', 'info', 2) };
    return { type: 'hold', time: 1.4, run: () => { e.crimp = 'full'; sfx.crimp(); drawPiece(); dirty(); }, progress: () => { }, cancel: (pr) => { if (pr > 0.25) { e.crimp = 'partial'; sfx.click(); drawPiece(); dirty(); } } };
  }
  return null;
}
function drawPiece() {
  const g = WB.piece; while (g.children.length) { const c = g.children.pop(); if (c.userData.ia) unregister(c); }
  const p = ses.piece; const Y = WB.Y + 0.01, z = -0.02;
  if (p?.cable) {
    const L = p.length || 0.7; const x0 = WB.x0;
    const r = p.cable.bitola >= 2.5 ? 0.0032 : 0.0022;
    const t = cyl(r, L, WIRE_COLORS[p.cable.cor], x0 + L / 2, Y, z, 'x', 8); g.add(t);
    if (!p.length) { const coil = cyl(r, 0.2, WIRE_COLORS[p.cable.cor], x0 - 0.1, Y, z, 'x', 8); g.add(coil); }
    if (p.length) {
      [x0, x0 + L].forEach((x, i) => {
        const e = p.ends[i]; const dir = i === 0 ? -1 : 1;
        if (e.strip) { const cu = cyl(r * 0.6, e.strip / 1000 * 3, '#c87533', x + dir * e.strip / 1000 * 1.5, Y, z, 'x', 6); g.add(cu); }
        if (e.ferrule) { const f = FERRULES.find(q => q.id === e.ferrule); const fm = cyl(r * (e.crimp === 'full' ? 1.05 : 1.3), 0.03, f.hex, x + dir * 0.016, Y, z, 'x', 8); g.add(fm); }
        const act = ['strip', 'ferrule', 'crimp'].includes(benchStep());
        if (act) { const mk = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0025, 6, 24), new THREE.MeshBasicMaterial({ color: C.verde })); mk.rotation.x = Math.PI / 2; mk.position.set(x + dir * 0.014, Y + 0.004, z); g.add(mk); }
        const hb = hitbox(0.06, 0.04, 0.06, x + dir * 0.012, Y, z); g.add(hb);
        register(hb, { label: () => `Ponta ${i === 0 ? 'A' : 'B'} · ${endDesc(e)}`, action: () => endAction(i) });
      });
    }
  }
  refreshBenchHighlights();
}
function endDesc(e) {
  const a = []; a.push(e.strip ? `decapada ${e.strip} mm` : 'sem decapar');
  if (e.ferrule) a.push('ponteira ' + FERRULES.find(f => f.id === e.ferrule).label.split(' ·')[0].toLowerCase());
  if (e.crimp) a.push(e.crimp === 'full' ? 'crimpada' : 'crimpagem incompleta');
  return a.join(', ');
}
function refreshBenchHighlights() {
  const s = benchStep(); const hl = WB.hl; if (!hl) return;
  const pos = s === 'cable' ? new V3(-0.18, WB.Y + 0.005, -0.17) : s === 'cut' ? new V3(WB.x0 + 0.35, WB.Y + 0.01, 0.07) : s === 'strip' ? new V3(0.36, WB.Y + 0.02, 0.16) : s === 'ferrule' ? new V3(0.175, WB.Y + 0.03, -0.165) : s === 'crimp' ? new V3(0.47, WB.Y + 0.03, -0.02) : null;
  hl.visible = !!pos; if (pos) { hl.position.copy(pos); hl.scale.setScalar(s === 'cable' ? 5 : s === 'cut' ? 6 : 1.5); }
}
function takePiece() {
  ses.hand = { type: 'wire', piece: ses.piece }; ses.lastPiece = JSON.parse(JSON.stringify(ses.piece)); ses.piece = null; drawPiece(); dirty(); goView(st.plate.installed ? 'quadro' : 'placa');
}
function repeatPiece(wid) {
  if (ses.hand?.type === 'wire') { toast('Você já tem um fio pronto na mão. Ligue-o na placa primeiro.', 'warn'); return; }
  const lp = JSON.parse(JSON.stringify(ses.lastPiece)); lp.wid = wid; ses.lastPiece = JSON.parse(JSON.stringify(lp));
  ses.hand = { type: 'wire', piece: lp }; sfx.cut(); dirty(); goView(st.plate.installed ? 'quadro' : 'placa');
}

// ================= Quadro elétrico =================
const plateNuts = [];
let interiorHit = null;
function buildEnclosureIA() {
  const D = W.door;
  register(hitboxAt(D.handle, 0.06, 0.16, 0.06, 0, 0, 0.02), { label: () => st.door.open ? 'Fechar a porta' : 'Abrir a porta', action: () => ses.tool === 'mao' ? { type: 'click', run: () => { st.door.open = !st.door.open; sfx.clack(); dirty(); } } : null });
  // alvo interior
  interiorHit = hitbox(0.8, 0.95, 0.05, 0, D.EY, -D.ED / 2 + 0.06); W.encl.add(interiorHit);
  register(interiorHit, { label: 'Instalar a placa aqui', enabled: () => ses.hand?.type === 'plate', action: () => ({ type: 'click', run: () => installPlate() }) });
  // borda da placa (pegar)
  register(W.plateMesh, {
    label: () => st.plate.installed ? 'Placa de montagem (instalada)' : 'Placa de montagem: pegar para levar ao quadro',
    action: () => {
      if (ses.tool !== 'mao') return null;
      if (ses.hand?.type === 'plate') return { type: 'click', run: () => { ses.hand = null; dirty(); } };
      if (ses.hand) return null;
      if (st.plate.installed) return { type: 'click', run: () => toast('A placa já está no quadro. Para retirá-la, use o menu de missões.', 'info') };
      return { type: 'click', run: () => { ses.hand = { type: 'plate' }; sfx.click(); dirty(); toast('Placa na mão. Vá até o Quadro, abra a porta e toque no interior.', 'info', 4); } };
    },
  });
  // porcas
  W.plateHoles.forEach((h, i) => {
    const n = screwMesh(); n.position.set(h.x, h.y, 0.006); n.visible = false; W.plateRoot.add(n); plateNuts.push(n);
    const hb = hitbox(0.016, 0.016, 0.014, 0, 0, 0); n.add(hb);
    register(hb, { label: () => `Porca de fixação da placa · ${st.plate.nuts[i] ? 'apertada' : 'solta'}`, action: () => ses.tool === 'chave' && !st.plate.nuts[i] ? { type: 'hold', time: 0.7, run: () => { st.plate.nuts[i] = true; sfx.tight(); refreshScrews(); dirty(); } } : null });
  });
  // cordoalha
  register(hitboxAt(W.strapOff, 0.04, 0.12, 0.04), { label: () => st.door.strap ? 'Cordoalha de aterramento da porta (ligada)' : 'Cordoalha de aterramento: ligar na porta', action: () => ses.tool === 'mao' && !ses.hand ? { type: 'click', run: () => { st.door.strap = !st.door.strap; sfx.snap(); refresh(); dirty(); } } : null });
  // pontos de medição de terra
  register(hitboxAt(W.doorStud, 0.03, 0.03, 0.04), { label: 'Terra da porta (parafuso da cordoalha)', action: () => ses.tool === 'multi' ? { type: 'click', run: () => probe('DOOR') } : null });
  register(hitboxAt(W.encStud, 0.03, 0.03, 0.04), { label: 'Terra da carcaça (PE)', action: () => ses.tool === 'multi' ? { type: 'click', run: () => probe('ENC') } : null });
}
function hitboxAt(obj, w, h, d, x = 0, y = 0, z = 0) { const hb = hitbox(w, h, d, x, y, z); obj.add(hb); return hb; }
let plateAnim = null;
function installPlate() {
  if (!st.door.open) { toast('Abra a porta do quadro primeiro.', 'warn'); return; }
  ses.hand = null; st.plate.installed = true;
  plateAnim = { t: 0, from: W.plateRoot.position.clone(), to: W.plateInPos.clone() };
  plateNuts.forEach(n => n.visible = true); refreshScrews(); updateMarkers(); sfx.clack(); refresh(); dirty();
}
function placePlateInstant(inside) {
  W.plateRoot.position.copy(inside ? W.plateInPos : EASEL_POS); plateNuts.forEach(n => n.visible = inside);
}

// ================= Console de testes =================
const CON = {};
function buildConsole() {
  const g = W.console; const Y = 0.86;
  const mkBtn = (x, z, label, color, fn, lab) => {
    const base = box(0.12, 0.05, 0.1, '#3c4046', x, Y + 0.025, z); g.add(base);
    const b = cyl(0.025, 0.02, color, x, Y + 0.06, z, 'y', 16); g.add(b);
    const l = labelPlane([{ t: label, size: 26, bold: true }], 0.12, 0.03, { w: 256, h: 64, bg: '#ffffff' }); l.position.set(x, Y + 0.0505, z + 0.051); g.add(l);
    const hb = hitbox(0.13, 0.09, 0.12, x, Y + 0.04, z); g.add(hb); register(hb, { label: lab, action: () => ses.tool === 'mao' && !ses.hand ? { type: 'click', run: fn } : null });
    return { base, b, l };
  };
  CON.power = mkBtn(-0.36, 0.05, 'Alimentação 380 V', '#d0342c', () => setPower(!st.power), () => st.power ? 'Desligar a alimentação 380 V' : 'Ligar a alimentação 380 V (energizar o painel)');
  CON.out = mkBtn(-0.2, 0.05, 'Saída OUT10 (CLP)', '#2f63c9', () => setOut10(!st.out10), () => st.out10 ? 'Desligar a saída OUT10 do CLP' : 'Ligar a saída OUT10 do CLP (aciona o -RA26)');
  CON.cones = mkBtn(-0.04, 0.05, 'Isolar área (cones)', '#f07c1b', () => { st.cones = !st.cones; W.cones.visible = st.cones; sfx.clack(); dirty(); }, () => st.cones ? 'Recolher os cones' : 'Isolar a área com cones e corrente');
  CON.motorBtn = mkBtn(0.12, 0.05, 'Ligar motor na XP3.0', '#56B951', () => toggleMotor(), () => st.motorConnected ? 'Desconectar o motor de teste' : 'Conectar o motor de teste nos bornes da -XP3.0');
  // motor de teste
  const m = new THREE.Group(); m.position.set(0.32, Y, -0.12); g.add(m); CON.motor = m;
  m.add(box(0.16, 0.012, 0.12, '#3c4046', 0, 0.006, 0));
  const body = cyl(0.055, 0.16, '#3a6f9e', 0, 0.075, 0, 'x', 20); m.add(body);
  for (let i = 0; i < 8; i++) { const f = box(0.15, 0.004, 0.012, '#335f88', 0, 0.075 + Math.sin(i * Math.PI / 4) * 0.055, Math.cos(i * Math.PI / 4) * 0.055); f.rotation.x = i * Math.PI / 4; m.add(f); }
  m.add(box(0.05, 0.035, 0.05, '#335f88', 0, 0.135, 0));
  const shaft = new THREE.Group(); shaft.position.set(-0.09, 0.075, 0); m.add(shaft); CON.shaft = shaft;
  shaft.add(cyl(0.008, 0.03, '#b9bdc1', 0, 0, 0, 'x', 10));
  const disk = cyl(0.028, 0.006, '#e6e6e6', -0.018, 0, 0, 'x', 20); shaft.add(disk);
  shaft.add(box(0.007, 0.024, 0.006, '#d0342c', -0.022, 0.012, 0));
  m.rotation.y = Math.PI / 2; // eixo apontando para o aluno
  // seta do sentido correto (desenhada) e placa de identificação
  const ac = document.createElement('canvas'); ac.width = 256; ac.height = 256; const ak = ac.getContext('2d');
  ak.fillStyle = '#f2c12e'; ak.fillRect(0, 0, 256, 256); ak.strokeStyle = '#100F0D'; ak.lineWidth = 18; ak.beginPath(); ak.arc(128, 140, 70, Math.PI * 1.1, Math.PI * 2.25); ak.stroke();
  const ex = 128 + 70 * Math.cos(Math.PI * 2.25), ey = 140 + 70 * Math.sin(Math.PI * 2.25);
  ak.fillStyle = '#100F0D'; ak.beginPath(); ak.moveTo(ex + 26, ey - 18); ak.lineTo(ex - 22, ey - 6); ak.lineTo(ex + 6, ey + 34); ak.closePath(); ak.fill();
  ak.font = '700 34px Archivo, Arial'; ak.textAlign = 'center'; ak.fillText('SENTIDO', 128, 44);
  const at = new THREE.CanvasTexture(ac); at.colorSpace = THREE.SRGBColorSpace;
  const ar = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ map: at }));
  ar.position.set(0.39, Y + 0.075, -0.035); g.add(ar);
  const np = labelPlane([{ t: '-M151 · Motor de teste', size: 24, bold: true }, { t: `${MOTOR.kw} · ${MOTOR.v} · ${MOTOR.hz}`, size: 22 }, { t: `In = ${fmtA(MOTOR.inom)} · ${MOTOR.rpm}`, size: 26, bold: true }], 0.11, 0.055, { w: 300, h: 150, bg: '#e6e6e6' });
  np.position.set(0.32, Y + 0.03, 0.03); np.rotation.x = -0.5; g.add(np);
  // multímetro
  const mm = new THREE.Group(); mm.position.set(0.05, Y, -0.17); mm.rotation.x = -0.5; g.add(mm);
  mm.add(box(0.1, 0.17, 0.035, '#f2c12e', 0, 0.09, 0)); mm.add(box(0.085, 0.15, 0.036, '#2a2e33', 0, 0.09, 0.001));
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 128; CON.dispC = dc; CON.dispT = new THREE.CanvasTexture(dc); CON.dispT.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.0375), new THREE.MeshBasicMaterial({ map: CON.dispT })); disp.position.set(0, 0.135, 0.0195); mm.add(disp);
  ['ohm', 'vac', 'vdc'].forEach((md, i) => {
    const b = box(0.022, 0.016, 0.006, '#56B951', -0.026 + i * 0.026, 0.085, 0.02); mm.add(b);
    const l = labelPlane([{ t: md === 'ohm' ? 'Ω' : md === 'vac' ? 'V~' : 'V⎓', size: 44, bold: true, color: '#fff' }], 0.02, 0.012, { w: 64, h: 40, bg: '#2a2e33' }); l.position.set(-0.026 + i * 0.026, 0.068, 0.0195); mm.add(l);
    register(b, { label: `Multímetro: modo ${md === 'ohm' ? 'resistência/continuidade' : md === 'vac' ? 'tensão alternada' : 'tensão contínua'}`, action: () => ({ type: 'click', run: () => { ses.meter = md; setTool('multi'); meterDisplay(); } }) });
  });
  const mmHit = hitbox(0.1, 0.06, 0.04, 0, 0.03, 0.0); mm.add(mmHit);
  register(mmHit, { label: 'Pegar o multímetro', action: () => ({ type: 'click', run: () => setTool('multi') }) });
  meterDisplay();
}
function meterDisplay() {
  const k = CON.dispC.getContext('2d'); k.fillStyle = '#b9c9a8'; k.fillRect(0, 0, 256, 128);
  k.fillStyle = '#1a2416'; k.font = '600 22px "IBM Plex Mono", monospace'; k.fillText((ses.meter || 'ohm') === 'ohm' ? 'Ω  CONT' : ses.meter === 'vac' ? 'V~ AC' : 'V⎓ DC', 12, 30);
  k.font = '700 54px "IBM Plex Mono", monospace'; k.textAlign = 'right'; k.fillText(ses.reading?.txt?.replace(/ ?[VΩ].*$/, '') || '----', 244, 100); k.textAlign = 'left';
  CON.dispT.needsUpdate = true;
}
function setPower(on) {
  if (on) {
    if (!st.plate.installed) { toast('Instale a placa no quadro antes de energizar.', 'warn'); return; }
    if (!ses.marks['2.4'] || !ses.marks['2.5']) logErr('Segurança', 'Energizou o painel antes de concluir os testes de curto-circuito (itens 2.4 e 2.5)', 10);
    if (!st.cones) logErr('Segurança', 'Energizou o painel sem isolar a área (item 2.10)', 8);
    if (st.km.pressed) st.km.pressed = false;
  }
  st.power = on; if (!on) st.out10 = false; sfx.clack(); refresh(); dirty();
}
function setOut10(on) {
  st.out10 = on; sfx.click();
  if (on && st.power) { ses.flags.out10 = true; if (st.motorConnected) ses.flags.motorRun = true; }
  refresh(); dirty();
}
function toggleMotor() {
  if (st.power) { toast('Desenergize o painel antes de conectar ou desconectar o motor.', 'err'); logErr('Segurança', 'Tentou conectar o motor com o painel energizado', 8); return; }
  if (!st.placed.XP) { toast('A régua -XP3.0 não está na placa.', 'warn'); return; }
  st.motorConnected = !st.motorConnected; sfx.snap(); rebuildPrewired(); refresh(); dirty();
}
function setQM(on) {
  st.qm.on = on; st.qm.tripped = false; sfx.clack();
  if (on && st.power && st.out10) ses.flags.out10 = true;
  refresh(); dirty();
}
function pressKM() {
  if (!st.placed.KM) return;
  if (st.power) { toast('Nunca acione um contator manualmente com o painel energizado!', 'err'); logErr('Segurança', 'Tentou acionar o contator manualmente com o painel energizado', 10); return; }
  st.km.pressed = !st.km.pressed; sfx.clack(); refresh(); dirty();
  toast(st.km.pressed ? 'Contator acionado manualmente (só para medição com o painel desligado).' : 'Contator solto.', 'info', 2.5);
}

// ================= Atualização elétrica =================
let S = null, motorT = 0, motorAng = 0;
function refresh() {
  S = solve(st);
  if (st.power && S.shorts.length) {
    arcFlash(S.shorts[0]);
    st.power = false; st.out10 = false; S = solve(st);
  }
  // visuais
  const km = plateParts.KM; if (km?.extra?.win) km.extra.win.position.z = (S.km || st.km.pressed) ? km.size.d / 2 - 0.009 : km.size.d / 2 - 0.004;
  const ra = plateParts.RA; if (ra?.extra?.led) ra.extra.led.material = S.ra ? mat('#ff7a1a', { emissive: '#ff5a00' }) : mat('#5a3a18');
  const qm = plateParts.QM; if (qm?.extra?.bI) { qm.extra.bI.position.z = qm.size.d / 2 + (st.qm.on ? -0.001 : 0.002); }
  if (qm?.extra?.dial) { const r = PARTS[qm.key].range; qm.extra.dial.rotation.z = -((st.qm.setting - r[0]) / (r[1] - r[0]) - 0.5) * 2.4; }
  CON.power && (CON.power.b.material = st.power ? mat('#ff4a3a', { emissive: '#aa1100' }) : mat('#d0342c'));
  CON.out && (CON.out.b.material = st.out10 ? mat('#5a8cff', { emissive: '#1d3d9a' }) : mat('#2f63c9'));
  CON.motorBtn && (CON.motorBtn.b.material = st.motorConnected ? mat('#7fe07a', { emissive: '#2a7f36' }) : mat('#56B951'));
  W.cones.visible = st.cones;
  W.strapOn.visible = st.door.strap; W.strapOff.material = st.door.strap ? mat('#7a5a30') : mat('#b87333');
  if (st.door.strap) { W.strapOn.position.set(-W.door.EW / 2 + 0.03, W.door.EY - W.door.EH / 2 + 0.07, 0.05); }
  W.strapOff.visible = !st.door.strap;
  if (S.motor.state !== 'run' && S.motor.state !== 'falta') motorT = 0;
}
function arcFlash(desc) {
  sfx.arc(); ses.arcT = 0.6;
  logErr('Segurança', `Energizou com curto-circuito (${desc}): arco elétrico e desarme do disjuntor geral`, 20);
  toast('CURTO-CIRCUITO! O disjuntor geral desarmou. No mundo real isso gera arco elétrico, queimaduras e dano ao painel. Desenergize, revise a fiação e refaça os testes 2.4 e 2.5.', 'err', 8);
  if (!E.arcLight) { E.arcLight = new THREE.PointLight(0x9fc8ff, 0, 6); E.scene.add(E.arcLight); }
  E.arcLight.position.copy(W.plateRoot.position).add(new V3(0, 0, 0.3));
}
function tick(dt) {
  // porta
  const D = W.door; D.open += ((st.door.open ? 1 : 0) - D.open) * Math.min(1, dt * 5); D.hinge.rotation.y = -D.open * 2.6;
  // placa animando
  if (plateAnim) { plateAnim.t = Math.min(1, plateAnim.t + dt / 1.4); const s = plateAnim.t < 0.5 ? 2 * plateAnim.t ** 2 : 1 - (-2 * plateAnim.t + 2) ** 2 / 2; W.plateRoot.position.lerpVectors(plateAnim.from, plateAnim.to, s); W.plateRoot.position.y += Math.sin(s * Math.PI) * 0.25; if (plateAnim.t >= 1) plateAnim = null; updateProbes(); }
  // arco
  if (ses.arcT > 0) { ses.arcT -= dt; E.arcLight.intensity = ses.arcT > 0 ? 40 * Math.random() * ses.arcT : 0; }
  // motor
  if (S) {
    const ms = S.motor.state;
    if (ms === 'run') { motorAng += dt * 20 * (S.motor.dir === 'horario' ? 1 : -1); CON.shaft.rotation.x = motorAng; motorSound(true, 1); motorT += dt; }
    else if (ms === 'falta') { CON.shaft.rotation.x += Math.sin(E.time * 60) * 0.002; motorSound(true, 0.6); motorT += dt; }
    else motorSound(false);
    if (ms === 'run' || ms === 'falta') {
      const part = st.placed.QM && PARTS[st.placed.QM.key];
      const cur = S.motor.current;
      if (part && st.qm.on && cur > st.qm.setting * 1.03 && cur >= part.range[0] * 0.9) {
        if (motorT > (ms === 'falta' ? 2.5 : 4)) {
          st.qm.on = false; st.qm.tripped = true; sfx.trip(); motorT = 0;
          if (ms === 'falta') { toast('O -QM151 desarmou: o motor estava com falta de fase (só duas fases chegando). Confira os fios 177, 178 e 179 e a entrada do disjuntor.', 'err', 7); logErr('Teste', 'Motor com falta de fase', 5); }
          else { toast(`O -QM151 desarmou por sobrecarga: regulagem ${fmtA(st.qm.setting)} abaixo da corrente do motor (${fmtA(MOTOR.inom)}). Regule o dial na corrente nominal.`, 'err', 7); logErr('Teste', `Disjuntor-motor regulado abaixo da corrente nominal (${fmtA(st.qm.setting)})`, 4); }
          refresh(); dirty();
        }
      }
      if (ms === 'run' && S.motor.dir === 'anti' && !ses.flags.antiMsg) { ses.flags.antiMsg = true; toast('O motor girou no sentido contrário ao da seta. Duas fases estão trocadas entre o contator e a régua XP3.0.', 'warn', 6); }
    }
  }
}

// ================= Checklist =================
function inSet(id, A) { const arr = typeof A === 'string' ? ALIASES[A] : A; return arr.includes(id); }
function measDone(m) { return ses.meas.some(h => h.mode === m[0] && ((inSet(h.a, m[1]) && inSet(h.b, m[2])) || (inSet(h.b, m[1]) && inSet(h.a, m[2])))); }
function measLabel(m) {
  const nm = (A) => typeof A === 'string' ? ({ L1: 'L1', L2: 'L2', L3: 'L3', PE: 'PE', SP: 'S+', ZV: '0V' })[A] : A.map(termLabel)[0].replace(/ \(.*\)$/, '');
  return `${m[0] === 'ohm' ? 'Ω' : m[0] === 'vac' ? 'V~' : 'V⎓'}  ${nm(m[1])} × ${nm(m[2])}`;
}
function needDone(n) {
  if (n === 'qmOn') return st.qm.on; if (n === 'qmOff') return !st.qm.on; if (n === 'cones') return st.cones; if (n === 'power') return st.power;
  if (n === 'out10') return !!ses.flags.out10; if (n === 'motorRun') return !!ses.flags.motorRun; return true;
}
const NEED_LABEL = { qmOn: '-QM151 armado', qmOff: '-QM151 desarmado', cones: 'Área isolada', power: 'Painel energizado', out10: 'Saída OUT10 acionada (painel energizado e QM armado)', motorRun: 'Motor conectado e acionado' };
function badEnd(e, w, i) { const f = FERRULES.find(x => x.id === e.ferrule); return e.strip === 6 || !f || f.bitola > w.cable.bitola || e.crimp !== 'full' || !w.tight[i]; }
function truth(check) {
  const P = st.placed;
  switch (check) {
    case 'na': return 'NA';
    case 'always': return 'OK';
    case 'layout': return ['X0', 'QM', 'RA', 'X24', 'KM', 'XP'].every(r => P[r] && P[r].slot === PARTS[r].slot) ? 'OK' : 'NOK';
    case 'codes': return Object.values(P).some(p => p.key.endsWith('x')) || !P.QM || !P.KM ? 'NOK' : 'OK';
    case 'fixed': return st.railScrews.every(Boolean) ? 'OK' : 'NOK';
    case 'gauge': return st.wires.every(w => { const d = WIRES.find(x => x.id === w.wid); return d && d.bitola === w.cable.bitola && d.cor === w.cable.cor; }) ? 'OK' : 'NOK';
    case 'traction': return st.wires.every(w => !w.popped.some(Boolean) && !w.ends.some((e, i) => badEnd(e, w, i))) ? 'OK' : 'NOK';
    case 'plateScrews': return st.plate.nuts.every(Boolean) ? 'OK' : 'NOK';
    case 'linkTight': return st.link.installed && st.link.tight ? 'OK' : 'NOK';
    case 'qmOn': return st.qm.on ? 'OK' : 'NOK';
    case 'qmOff': return !st.qm.on ? 'OK' : 'NOK';
    case 'cones': return st.cones ? 'OK' : 'NOK';
    case 'ground': return ohm(st, 'PE:2', 'DOOR') === 0 && ohm(st, 'PE:2', 'XP:40a') === 0 ? 'OK' : 'NOK';
    case 'noShortAC': { const s = solve(st, { power: false }); return s.shortsDry.some(g => g.filter(x => ['L1', 'L2', 'L3', 'G'].includes(x)).length > 1) ? 'NOK' : 'OK'; }
    case 'noShortDC': { const s = solve(st, { power: false }); return s.shortsDry.some(g => g.includes('DC+') && g.length > 1 || g.includes('DC0') && g.length > 1) ? 'NOK' : 'OK'; }
    case 'supply': return st.power && P.X0 ? 'OK' : 'NOK';
    case 'qmOut': { const s = solve(st); const ph = ['QM:2', 'QM:4', 'QM:6'].map(s.src); return new Set(ph.filter(p => ['L1', 'L2', 'L3'].includes(p))).size === 3 ? 'OK' : 'NOK'; }
    case 'dc24': { const s = solve(st); return s.src('X24:S+a') === 'DC+' && s.src('RA:11') === 'DC+' ? 'OK' : 'NOK'; }
    case 'setting': return P.QM?.key === 'QM' && st.qm.setting >= 1.89 && st.qm.setting <= 2.01 ? 'OK' : 'NOK';
    case 'kmPull': { const s = solve(st, { power: true, out10: true, qm: { on: true } }); return s.km && !s.shorts.length ? 'OK' : 'NOK'; }
    case 'motor': {
      const s = solve(st, { power: true, out10: true, motorConnected: true, qm: { on: true } });
      const noTrip = P.QM?.key !== 'QM' || st.qm.setting >= MOTOR.inom * 0.97;
      return s.motor.state === 'run' && s.motor.dir === 'horario' && !s.shorts.length && noTrip ? 'OK' : 'NOK';
    }
    case 'finish': return st.wires.some(w => w.ends.some(e => e.strip === 15) || w.length > (w.route || 0) + 0.28) ? 'NOK' : 'OK';
  }
  return 'OK';
}
function doTraction() {
  let n = 0;
  for (const w of st.wires) w.ends.forEach((e, i) => { if (!w.popped[i] && badEnd(e, w, i)) { w.popped[i] = true; n++; } });
  ses.flags.traction = true; redrawAllWires(); refresh(); sfx.snap();
  toast(n ? `${n} ponta(s) de fio soltaram no teste de tração!` : 'Todos os fios resistiram ao teste de tração.', n ? 'warn' : 'ok', 4); dirty();
}
function currentItem() { return CHECKLIST[ses.item]; }
function markItem(mark) {
  const it = currentItem(); const tr = truth(it.check);
  const needs = (it.need || []).filter(n => !needDone(n)); const meas = (it.meas || []).filter(m => !measDone(m));
  const act = it.action === 'traction' && !ses.flags.traction;
  if (mark !== 'NA' && (needs.length || meas.length || act)) {
    toast('Faça a verificação antes de marcar: ' + [...needs.map(n => NEED_LABEL[n]), ...meas.map(measLabel), ...(act ? ['teste de tração'] : [])].join(', '), 'warn', 5);
    logErr('Teste', `Tentou marcar o item ${it.id} sem fazer a verificação`, 2); return;
  }
  let fb;
  if (tr === 'NA') fb = mark === 'NA' ? { ok: true, t: 'Correto: este item não se aplica a este painel. Marcar NA deixa claro que ele foi avaliado, e não esquecido.' } : { ok: false, t: 'Este item não se aplica a esta placa de treino (não existe esse equipamento aqui). O certo é marcar NA.' };
  else if (mark === 'NA') fb = { ok: false, t: 'Este item se aplica a este painel: faça a verificação e marque OK ou NOK.' };
  else if (mark === tr) fb = tr === 'OK' ? { ok: true, t: 'Correto. Item conforme.' } : { ok: true, found: true, t: 'Bem visto: há uma não conformidade. ' + CHECK_EXPLAIN[it.check] };
  else if (mark === 'OK') fb = { ok: false, found: true, missed: true, t: 'Atenção: você aprovou um item com defeito. Na fábrica, isso só seria descoberto no cliente. ' + CHECK_EXPLAIN[it.check] };
  else fb = { ok: false, t: 'Aqui não há defeito: o item está conforme. Refaça a verificação com calma.' };
  if (!fb.ok) logErr('Teste', `Item ${it.id}: ${fb.missed ? 'aprovou com defeito' : 'marcação incorreta'}`, fb.missed ? 8 : 3);
  if (fb.found) { (ses.ncs ||= []).push(`${it.id} · ${it.text}`); }
  ses.itemFb = { ...fb, mark, tr }; ses.lastMark = mark;
  if (fb.ok && !fb.found) ses.marks[it.id] = mark;
  if (fb.ok && fb.found) ses.marks[it.id] = null;
  dirty();
}
function nextItem() {
  const it = currentItem(); const fb = ses.itemFb;
  if (fb?.found || (fb && !fb.ok && fb.tr === 'NOK')) { ses.itemFb = null; ses.meas = []; ses.flags.traction = false; ses.fixing = true; dirty(); return; }
  if (fb && !fb.ok) { ses.itemFb = null; dirty(); return; }
  ses.itemFb = null; ses.fixing = false; ses.meas = []; ses.flags.traction = false;
  ses.marks[it.id] = ses.marks[it.id] || fb?.mark;
  if (ses.item < CHECKLIST.length - 1) { ses.item++; ses.reading = null; } else { ses.screen = 'relatorio'; sfx.win(); }
  dirty();
}

// ================= Auto-montagem / desafio =================
function idealPiece(wid) { const d = WIRES.find(w => w.id === wid); return { wid, cable: { bitola: d.bitola, cor: d.cor }, length: Math.ceil(((WIRE_EST[wid] || 0.2) + 0.08) * 20) / 20, ends: [{ strip: 10, ferrule: d.bitola >= 2.5 ? 'azul' : 'cinza', crimp: 'full' }, { strip: 10, ferrule: d.bitola >= 2.5 ? 'azul' : 'cinza', crimp: 'full' }] }; }
function autoBuild(level, defects = []) {
  if (level >= 2) {
    st.railScrews = st.railScrews.map(() => true); refreshScrews();
    for (const role of ['X0', 'QM', 'RA', 'X24', 'KM', 'XP']) {
      let key = role; if (role === 'QM' && defects.includes('qmx')) key = 'QMx'; if (role === 'KM' && defects.includes('kmx')) key = 'KMx';
      let slot = PARTS[role].slot; if (defects.includes('layout')) { if (role === 'RA') slot = 'a4'; if (role === 'X24') slot = 'a3'; }
      if (!st.placed[role]) { placePart(key, slot); trayItems[key].visible = false; }
    }
    if (!st.link.installed) { st.link.installed = true; st.link.tight = true; showLink(); trayItems.LINK.visible = false; }
    if (defects.includes('rail')) st.railScrews[3] = false;
    if (defects.includes('link')) st.link.tight = false;
    refreshScrews();
  }
  if (level >= 3) {
    for (const d of WIRES) {
      if (st.wires.some(w => w.wid === d.id)) continue;
      const pc = idealPiece(d.id); let from = d.from, to = d.to;
      if (defects.includes('swap') && d.id === '177') to = 'XP:38a';
      if (defects.includes('swap') && d.id === '178') to = 'XP:37a';
      if (defects.includes('pe') && d.id === 'PE') to = 'XP:39a';
      if (defects.includes('pe') && d.id === '179') to = 'XP:40a';
      if (defects.includes('gauge') && d.id === '177') pc.cable = { bitola: 0.75, cor: 'preto' }, pc.ends.forEach(e => e.ferrule = 'cinza');
      if (defects.includes('crimp') && d.id === '179') pc.ends[1].crimp = 'partial';
      if (defects.includes('strip') && d.id === '462') pc.ends[0].strip = 15;
      if (defects.includes('short') && d.id === 'L2.2') pc.ends[0].strip = 6;
      const w = { wid: d.id, cable: pc.cable, length: pc.length, ends: pc.ends, from, to, tight: [true, true], popped: [false, false] };
      if (defects.includes('loose') && d.id === 'L3.2') w.tight[0] = false;
      st.wires.push(w); drawWire(w);
    }
  }
  if (level >= 4) {
    st.door.open = true; st.plate.installed = true; st.plate.nuts = [true, true, true, true]; st.door.strap = !defects.includes('strap');
    if (defects.includes('nut')) st.plate.nuts[2] = false;
    placePlateInstant(true); refreshScrews();
  }
  if (defects.includes('setting')) st.qm.setting = 1.6; else if (level >= 5) st.qm.setting = 1.6;
  updateMarkers(); refresh(); dirty();
}
function resetAll() {
  for (const role of Object.keys(plateParts)) { const r = plateParts[role]; for (const h of r.hits) { unregister(h); h.parent?.remove(h); } W.plateRoot.remove(r.group); delete plateParts[role]; }
  for (const id of [...termHits.keys()]) if (!id.startsWith('PE:')) termHits.delete(id);
  for (const w of [...st.wires]) { const g = wireMeshes.get(w); if (g) { g.traverse(o => { if (o.userData.ia) unregister(o); }); W.plateRoot.remove(g); } }
  wireMeshes.clear();
  st = freshState(); showLink(); for (const k in trayItems) trayItems[k].visible = true;
  placePlateInstant(false); refreshScrews(); rebuildPrewired();
  Object.assign(ses, { hand: null, pending: null, log: [], flags: {}, meas: [], probe: null, reading: null, piece: null, lastPiece: null, item: 0, marks: {}, itemFb: null, startT: Date.now(), ncs: [], fixing: false, dial: false });
  showPendingMarker(null); updateProbes(); drawPiece(); updateMarkers(); refresh();
}
const DEFECTS = ['swap', 'qmx', 'kmx', 'crimp', 'loose', 'strap', 'nut', 'link', 'gauge', 'strip', 'rail', 'setting', 'layout', 'pe', 'short'];
function startChallenge() {
  resetAll();
  const pool = [...DEFECTS]; const pick = [];
  while (pick.length < 3) { const d = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; if (d === 'setting' && pick.includes('qmx')) continue; if (d === 'qmx' && pick.includes('setting')) continue; if (d === 'gauge' && pick.includes('swap')) continue; pick.push(d); }
  ses.defects = pick; ses.mode = 'desafio';
  autoBuild(4, pick); ses.screen = 'teste'; ses.testIntro = true; goView('quadro'); dirty();
}
function goMission(m) {
  ses.mode = 'normal';
  if (m === 'aula') { ses.screen = 'aula'; ses.card = 0; goView('projeto'); }
  if (m === 'mont') { ses.screen = 'mont'; ses.card = 0; ses.cardsSeen = false; goView('placa'); }
  if (m === 'cabos') { autoBuild(2); ses.screen = 'cabos'; ses.card = 0; ses.wireCards = true; goView('cabos'); }
  if (m === 'quadro') { autoBuild(3); ses.screen = 'quadro'; ses.card = 0; goView('quadro'); }
  if (m === 'teste') { autoBuild(4); ses.screen = 'teste'; ses.testIntro = true; ses.item = 0; goView('quadro'); }
  dirty();
}

// ================= Tablet =================
const fmtA = (a) => String(Math.round(a * 10) / 10).replace('.', ',') + ' A';
const fmtB = (b) => String(b).replace('.', ',') + ' mm²';
const corName = (c) => c === 'vd-am' ? 'verde-amarelo' : c;
const MISSIONS = [['aula', '1', 'Interpretar o projeto', 'Folhas, tags, força, comando e quiz'], ['mont', '2', 'Montagem mecânica', 'Trilhos, componentes e link'], ['cabos', '3', 'Cabos e ligações', 'Cortar, decapar, ponteira, crimpar e ligar'], ['quadro', '4', 'Placa no quadro', 'Instalar, fixar e aterrar'], ['teste', '5', 'Testes RE-33', 'Inspeção, medições, energização e partida']];

function drawTablet() {
  const ui = E.tablet; const k = ui.begin(); const Wd = ui.w, H = ui.h;
  k.fillStyle = C.floresta; k.fillRect(0, 0, Wd, H);
  // navegação de estações
  const nav = [['projeto', 'Projeto'], ['placa', 'Placa'], ['cabos', 'Cabos'], ['quadro', 'Quadro'], ['console', 'Console']];
  let x = 24;
  for (const [v, l] of nav) { const w = ui.measure(l, 22, 600) + 36; ui.button('nav_' + v, x, 18, w, 50, l, () => goView(v), { kind: 'tab', active: E.viewName === v, size: 22 }); x += w + 8; }
  ui.button('menu', Wd - 150, 18, 126, 50, 'Missões', () => { ses.screen = 'menu'; dirty(); }, { kind: 'ghost', size: 22 });
  k.fillStyle = C.line; k.fillRect(0, 84, Wd, 2);
  const area = { x: 40, y: 104, w: Wd - 80, h: 640 };
  const scr = ses.screen;
  if (ses.dial && plateParts.QM) drawDial(ui, area);
  else if (scr === 'menu') drawMenu(ui, area);
  else if (scr === 'intro') drawCards(ui, area, INTRO_CARDS, 'Boas-vindas', () => { ses.screen = 'aula'; ses.card = 0; goView('projeto'); });
  else if (scr === 'aula') drawCards(ui, area, LESSON_CARDS, 'Missão 1 · Interpretar o projeto', () => { ses.screen = 'quiz'; ses.quiz = { i: 0, fb: null, wrong: 0 }; board.setTab(QUIZ[0].tab); }, true);
  else if (scr === 'quiz') drawQuiz(ui, area);
  else if (scr === 'mont') drawMont(ui, area);
  else if (scr === 'cabos') drawCabos(ui, area);
  else if (scr === 'quadro') drawQuadro(ui, area);
  else if (scr === 'teste') drawTeste(ui, area);
  else if (scr === 'relatorio') drawRelatorio(ui, area);
  // rodapé: ferramentas
  k.fillStyle = C.panel2; k.fillRect(0, 766, Wd, H - 766); k.fillStyle = C.line; k.fillRect(0, 766, Wd, 2);
  const tools = [['mao', 'Mão', 'hand'], ['chave', 'Chave de fenda', 'driver'], ['multi', 'Multímetro', 'meter']];
  x = 24;
  for (const [t, l, ic] of tools) { const w = ui.measure(l, 22, 600) + 80; ui.button('tool_' + t, x, 790, w, 60, l, () => setTool(t), { kind: 'tab', active: ses.tool === t, icon: ic, size: 22 }); x += w + 10; }
  let hand = 'Mãos livres';
  if (ses.hand?.type === 'part' || ses.hand?.type === 'link') hand = 'Na mão: ' + PARTS[ses.hand.key].tag + ' ' + PARTS[ses.hand.key].code;
  if (ses.hand?.type === 'wire') hand = `Na mão: fio ${ses.hand.piece.wid}` + (ses.pending ? ` · origem ${termLabel(ses.pending)}` : '');
  if (ses.hand?.type === 'plate') hand = 'Na mão: placa de montagem';
  if (ses.tool === 'multi') hand = `Multímetro ${({ ohm: 'Ω', vac: 'V~', vdc: 'V⎓' })[ses.meter || 'ohm']} · ` + (ses.reading ? `${ses.reading.txt}` : ses.probe ? 'toque no 2º ponto' : 'toque no 1º ponto');
  ui.text(hand, x + 14, 828, { size: 22, color: C.txt2, weight: 600 });
  setHandTag(ses.hand || ses.tool === 'multi' ? hand.replace('Na mão: ', '') : (ses.tool === 'chave' ? 'Chave de fenda' : null));
  if (ses.hand) ui.button('drop', Wd - 150, 790, 126, 60, 'Soltar', () => dropHand(), { kind: 'ghost', size: 22 });
  ui.end();
}
function dropHand() {
  if (ses.hand?.type === 'part' || ses.hand?.type === 'link') trayItems[ses.hand.key].visible = true;
  if (ses.hand?.type === 'wire') { ses.piece = ses.hand.piece; drawPiece(); }
  ses.hand = null; ses.pending = null; showPendingMarker(null); updateMarkers(); dirty();
}
function header(ui, a, eyebrow, title) { ui.eyebrow(eyebrow, a.x, a.y + 22); ui.text(title, a.x, a.y + 68, { size: 40, weight: 700 }); return a.y + 116; }
function drawMenu(ui, a) {
  let y = header(ui, a, 'Teknike · Oficina de painéis em VR', 'Partida direta do motor -M151');
  ui.para('Escolha uma missão. Cada missão já prepara o painel até aquele ponto, então você pode treinar qualquer etapa.', a.x, y, a.w, { size: 23, color: C.txt2 }); y += 50;
  const bw3 = (a.w - 24) / 3;
  ui.button('m_intro', a.x, y, bw3, 60, 'Como jogar', () => { ses.screen = 'intro'; ses.card = 0; dirty(); }, { kind: 'choice', size: 23 });
  ui.button('m_desafio', a.x + bw3 + 12, y, bw3, 60, 'Desafio: 3 defeitos', () => startChallenge(), { kind: 'choice', size: 23 });
  ui.button('m_reset', a.x + 2 * (bw3 + 12), y, bw3, 60, 'Recomeçar do zero', () => { resetAll(); ses.done = {}; ses.screen = 'intro'; ses.card = 0; goView('projeto'); dirty(); }, { kind: 'ghost', size: 23 });
  y += 76;
  for (const [id, n, t, s] of MISSIONS) {
    ui.button('m_' + id, a.x, y, a.w, 68, `${n}. ${t}`, () => goMission(id), { kind: 'choice', size: 26, sub: s, active: ses.done[id] });
    if (ses.done[id]) ICONS.check(ui.ctx, a.x + a.w - 40, y + 34, C.verde, 34);
    y += 76;
  }
}
function drawCards(ui, a, cards, eyebrow, onEnd, syncBoard) {
  const c = cards[ses.card];
  if (syncBoard && c.tab && board.tab !== c.tab) board.setTab(c.tab);
  let y = header(ui, a, `${eyebrow} · ${ses.card + 1} de ${cards.length}`, c.t);
  ui.para(c.b, a.x, y + 6, a.w, { size: 26, maxY: a.y + a.h - 80 });
  if (syncBoard) ui.text('Acompanhe no quadro de projeto ao lado.', a.x, a.y + a.h - 64, { size: 20, color: C.txt2 });
  const by = a.y + a.h - 44;
  if (ses.card > 0) ui.button('prev', a.x, by, 160, 56, 'Voltar', () => { ses.card--; dirty(); }, { kind: 'ghost', icon: 'left', size: 22 });
  const last = ses.card === cards.length - 1;
  ui.button('next', a.x + a.w - 240, by, 240, 56, last ? 'Começar' : 'Próximo', () => { if (last) onEnd(); else ses.card++; dirty(); }, { kind: 'primary', size: 24 });
}
function drawQuiz(ui, a) {
  const q = QUIZ[ses.quiz.i]; const fb = ses.quiz.fb;
  let y = header(ui, a, `Missão 1 · Quiz · pergunta ${ses.quiz.i + 1} de ${QUIZ.length}`, 'Leia o projeto');
  y = ui.para(q.q, a.x, y + 4, a.w, { size: 28, weight: 600 }) + 10;
  if (q.type === 'pick' && !fb) { ui.text('Toque no desenho, no quadro de projeto ao lado.', a.x, y + 10, { size: 22, color: C.txt2 }); y += 40; }
  if (q.type === 'mc') q.opts.forEach((o, i) => {
    const col = fb ? (i === q.a ? '#1f5a35' : (fb.pick === i ? '#6a2a20' : null)) : null;
    ui.button('opt' + i, a.x, y, a.w, 64, o, () => { if (!fb) answerMC(i); }, { kind: 'choice', size: 24, color: col }); y += 74;
  });
  if (fb) {
    const k = ui.ctx; k.fillStyle = fb.ok ? '#123f26' : '#3e1c16'; k.fillRect(a.x, y + 6, a.w, 120);
    k.fillStyle = fb.ok ? C.verde : C.erro; k.fillRect(a.x, y + 6, 8, 120);
    ui.para(fb.t, a.x + 26, y + 46, a.w - 40, { size: 23 });
    const last = ses.quiz.i === QUIZ.length - 1;
    const retry = !fb.ok && q.type === 'pick';
    ui.button('qnext', a.x + a.w - 260, a.y + a.h - 44, 260, 56, retry ? 'Tentar de novo' : (last ? 'Concluir missão' : 'Próxima'), () => {
      if (retry) { ses.quiz.fb = null; board.flash = null; dirty(); dirtyBoard(); return; }
      board.flash = null; dirtyBoard();
      if (last) { ses.done.aula = true; ses.screen = 'mont'; ses.card = 0; goView('placa'); toast(`Missão 1 concluída${ses.quiz.wrong ? ` com ${ses.quiz.wrong} erro(s)` : ' sem erros'}!`, 'ok'); }
      else { ses.quiz.i++; ses.quiz.fb = null; board.setTab(QUIZ[ses.quiz.i].tab); }
      dirty();
    }, { kind: 'primary', size: 24 });
  }
}
function answerMC(i) { const q = QUIZ[ses.quiz.i]; const ok = i === q.a; ses.quiz.fb = { ok, pick: i, t: ok ? q.ok : q.no }; if (!ok) { ses.quiz.wrong++; logErr('Projeto', `Quiz: errou "${q.q.slice(0, 50)}…"`, 2); } ok ? sfx.ok() : sfx.err(); dirty(); }
function answerPick(id) {
  const q = QUIZ[ses.quiz.i]; const ok = id === q.target; ses.quiz.fb = { ok, t: ok ? q.ok : q.no };
  board.flash = { id: ok ? id : q.target, color: ok ? C.verde : C.erro }; if (!ok) board.flash = id ? { id, color: C.erro } : null;
  if (!ok) { ses.quiz.wrong++; logErr('Projeto', `Quiz: errou "${q.q.slice(0, 50)}…"`, 2); }
  ok ? sfx.ok() : sfx.err(); dirty();
}
function progressRow(ui, x, y, w, label, done, detail) {
  const k = ui.ctx; k.strokeStyle = done ? C.verde : C.line; k.lineWidth = 3; k.strokeRect(x, y - 24, 30, 30);
  if (done) ICONS.check(k, x + 15, y - 9, C.verde, 26);
  ui.text(label, x + 46, y, { size: 24, weight: 600, color: done ? C.branco : C.txt2 });
  if (detail) ui.text(detail, x + w, y, { size: 22, color: C.txt2, align: 'right' });
}
function drawMont(ui, a) {
  if (!ses.cardsSeen) { drawCards(ui, a, MOUNT_CARDS, 'Missão 2 · Montagem mecânica', () => { ses.cardsSeen = true; dirty(); }); return; }
  let y = header(ui, a, 'Missão 2 · Montagem mecânica', 'Monte a placa conforme o layout');
  const scr = st.railScrews.filter(Boolean).length, parts = ['X0', 'QM', 'RA', 'X24', 'KM', 'XP'].filter(r => st.placed[r]).length;
  progressRow(ui, a.x, y + 20, a.w, 'Apertar os parafusos dos trilhos (chave de fenda)', scr === 6, `${scr}/6`);
  progressRow(ui, a.x, y + 76, a.w, 'Colocar os 6 componentes nos trilhos (Mão)', parts === 6, `${parts}/6`);
  progressRow(ui, a.x, y + 132, a.w, 'Instalar o link GV2AF3 entre -QM151 e -KM151', st.link.installed, '');
  progressRow(ui, a.x, y + 188, a.w, 'Apertar os parafusos do link (chave de fenda)', st.link.tight, '');
  ui.para('Dica: o layout e a lista de materiais estão na folha 1, no quadro de projeto. Passe o laser sobre as peças da bandeja para ler o código de cada uma. Para retirar uma peça da placa, segure a Mão sobre ela.', a.x, y + 260, a.w, { size: 22, color: C.txt2 });
  ui.button('lay', a.x, a.y + a.h - 44, 300, 56, 'Ver layout (folha 1)', () => { board.setTab('lay'); goView('projeto'); }, { kind: 'ghost', size: 22, icon: 'doc' });
  const can = parts === 6 && st.link.installed;
  ui.button('mdone', a.x + a.w - 300, a.y + a.h - 44, 300, 56, 'Concluir montagem', () => { ses.done.mont = true; ses.screen = 'cabos'; ses.card = 0; ses.wireCards = true; goView('cabos'); }, { kind: 'primary', size: 24, disabled: !can });
}
function drawCabos(ui, a) {
  if (ses.wireCards) { drawCards(ui, a, WIRE_CARDS, 'Missão 3 · Cabos e ligações', () => { ses.wireCards = false; dirty(); }); return; }
  const p = ses.piece;
  if (p) { drawBench(ui, a, p); return; }
  let y = header(ui, a, 'Missão 3 · Cabos e ligações', ses.hand?.type === 'wire' ? `Ligue o fio ${ses.hand.piece.wid} na placa` : 'Escolha o próximo fio');
  if (ses.hand?.type === 'wire') {
    const d = WIRES.find(w => w.id === ses.hand.piece.wid);
    ui.para(`Lista de fios: ${termLabel(d.from)} → ${termLabel(d.to)}.\nCom a Mão, toque no borne de origem e depois no de destino. Depois aperte as duas pontas com a chave de fenda.`, a.x, y, a.w, { size: 24 });
    return;
  }
  const loose = st.wires.reduce((s, w) => s + w.tight.filter(t => !t).length, 0);
  ui.text(`${st.wires.length} de ${WIRES.length} fios ligados${loose ? ` · ${loose} ponta(s) sem aperto` : ''}`, a.x, y - 8, { size: 22, color: loose ? C.alerta : C.txt2, weight: 600 });
  const cols = 2, bw = (a.w - 16) / cols, bh = 62;
  WIRES.forEach((d, i) => {
    const bx = a.x + (i % cols) * (bw + 16), by = y + 8 + Math.floor(i / cols) * (bh + 8);
    const done = st.wires.some(w => w.wid === d.id);
    ui.button('w_' + d.id, bx, by, bw * (ses.lastPiece && !done ? 0.66 : 1), bh, `Fio ${d.id}`, () => { if (!done) startPiece(d.id); else toast('Este fio já está ligado. Para refazer, segure a Mão sobre ele na placa.', 'info'); }, { kind: 'choice', size: 22, sub: `${fmtB(d.bitola)} ${corName(d.cor)} · ${done ? 'ligado' : 'preparar'}`, active: done });
    if (ses.lastPiece && !done) ui.button('wr_' + d.id, bx + bw * 0.68, by, bw * 0.32, bh, 'Repetir', () => repeatPiece(d.id), { kind: 'ghost', size: 20, sub: 'último preparo' });
  });
  const can = WIRES.every(d => st.wires.some(w => w.wid === d.id));
  ui.button('cdone', a.x + a.w - 300, a.y + a.h - 44, 300, 56, 'Concluir ligações', () => {
    if (loose) logErr('Cabos', `Concluiu as ligações com ${loose} ponta(s) sem aperto`, 0);
    ses.done.cabos = true; ses.screen = 'quadro'; ses.card = 0; goView('placa'); toast('Agora leve a placa até o quadro. Toque na borda laranja da placa com a Mão.', 'info', 5);
  }, { kind: 'primary', size: 24, disabled: !can });
}
function drawBench(ui, a, p) {
  const d = WIRES.find(w => w.id === p.wid);
  let y = header(ui, a, `Bancada de cabos · fio ${p.wid}`, `${termLabel(d.from)} → ${termLabel(d.to)}`);
  ui.text(`Lista de fios: ${fmtB(d.bitola)} ${corName(d.cor)} · trajeto ~${Math.round((WIRE_EST[d.id] || 0) * 100)} cm`, a.x, y - 4, { size: 22, color: C.txt2 });
  const s = benchStep(); y += 30;
  const steps = [['cable', 'Escolher a bobina de cabo', p.cable ? `${fmtB(p.cable.bitola)} ${corName(p.cable.cor)}` : ''], ['cut', 'Cortar na régua', p.length ? `${Math.round(p.length * 100)} cm` : ''],
  ['strip', 'Decapar as duas pontas', p.ends.map(e => e.strip ? e.strip + ' mm' : '—').join(' / ') + (WB.strip && s === 'strip' ? ` · decapador em ${WB.strip} mm` : '')],
  ['ferrule', 'Colocar ponteira nas duas pontas', p.ends.map(e => e.ferrule ? FERRULES.find(f => f.id === e.ferrule).label.split(' ·')[0] : '—').join(' / ')],
  ['crimp', 'Crimpar as duas pontas (segure até o fim)', p.ends.map(e => e.crimp ? (e.crimp === 'full' ? 'ok' : 'incompleta') : '—').join(' / ')]];
  const order = ['cable', 'cut', 'strip', 'ferrule', 'crimp', 'ready'];
  steps.forEach(([id, l, det], i) => { const done = order.indexOf(s) > i; progressRow(ui, a.x, y + i * 52, a.w, l, done, det); if (id === s) { ui.ctx.fillStyle = C.verde; ui.ctx.fillRect(a.x - 18, y + i * 52 - 26, 6, 34); } });
  y += steps.length * 52 + 6;
  const hint = { cable: 'Toque na bobina com a bitola e a cor da lista de fios.', cut: 'Toque na marca da régua: trajeto + folga de 5 a 10 cm.', strip: 'Ajuste o decapador (6, 10 ou 15 mm) e toque em cada ponta do fio.', ferrule: 'Escolha a cor da ponteira na caixa e toque em cada ponta.', crimp: 'Toque no crimpador e depois segure sobre cada ponta até a catraca completar.', ready: 'Fio pronto. Leve até a placa.' }[s];
  ui.para(hint, a.x, y + 12, a.w, { size: 23, color: C.tint20, weight: 600 });
  ui.button('cancelp', a.x, a.y + a.h - 44, 200, 56, 'Descartar', () => { ses.piece = null; drawPiece(); dirty(); }, { kind: 'ghost', size: 22 });
  if (s === 'ready') ui.button('takep', a.x + a.w - 300, a.y + a.h - 44, 300, 56, 'Levar para a placa', () => takePiece(), { kind: 'primary', size: 24 });
}
function drawQuadro(ui, a) {
  if (ses.card < ENCL_CARDS.length && !ses.enclSeen) { drawCards(ui, a, ENCL_CARDS, 'Missão 4 · Placa no quadro', () => { ses.enclSeen = true; dirty(); }); return; }
  let y = header(ui, a, 'Missão 4 · Placa no quadro', 'Instale e aterre a placa');
  const nuts = st.plate.nuts.filter(Boolean).length;
  progressRow(ui, a.x, y + 20, a.w, 'Abrir a porta do quadro', st.door.open || D_open());
  progressRow(ui, a.x, y + 76, a.w, 'Levar a placa para dentro do quadro', st.plate.installed);
  progressRow(ui, a.x, y + 132, a.w, 'Apertar as 4 porcas da placa', nuts === 4, `${nuts}/4`);
  progressRow(ui, a.x, y + 188, a.w, 'Ligar a cordoalha de aterramento da porta', st.door.strap);
  if (!st.plate.installed) ui.button('gop', a.x, a.y + a.h - 44, 260, 56, 'Ir até a placa', () => goView('placa'), { kind: 'ghost', size: 22 });
  ui.button('qdone', a.x + a.w - 300, a.y + a.h - 44, 300, 56, 'Ir para os testes', () => { ses.done.quadro = true; ses.screen = 'teste'; ses.testIntro = true; ses.item = 0; dirty(); }, { kind: 'primary', size: 24, disabled: !st.plate.installed });
}
function D_open() { return false; }
function drawTeste(ui, a) {
  if (ses.testIntro) {
    let y = header(ui, a, ses.mode === 'desafio' ? 'Desafio · RE-33' : 'Missão 5 · RE-33', TEST_INTRO.t);
    y = ui.para(TEST_INTRO.b, a.x, y + 6, a.w, { size: 25 });
    if (ses.mode === 'desafio') ui.para('Neste desafio, o painel foi montado por outra pessoa e tem 3 defeitos escondidos. Encontre todos com o checklist.', a.x, y + 10, a.w, { size: 24, color: C.alerta, weight: 600 });
    ui.button('tstart', a.x + a.w - 280, a.y + a.h - 44, 280, 56, 'Começar os testes', () => { ses.testIntro = false; dirty(); }, { kind: 'primary', size: 24 });
    return;
  }
  const it = currentItem(); const fb = ses.itemFb;
  // barra de progresso
  const k = ui.ctx; k.fillStyle = C.line; k.fillRect(a.x, a.y, a.w, 8); k.fillStyle = C.verde; k.fillRect(a.x, a.y, a.w * (ses.item / CHECKLIST.length), 8);
  ui.eyebrow(`RE-33 · ${it.sec} · item ${ses.item + 1} de ${CHECKLIST.length}`, a.x, a.y + 40);
  ui.text(it.id, a.x, a.y + 92, { size: 44, weight: 700, color: C.verde, mono: true });
  let y = ui.para(it.text, a.x + 120, a.y + 78, a.w - 120, { size: 27, weight: 600 });
  y = Math.max(y, a.y + 110);
  if (ses.fixing && !fb) { k.fillStyle = '#3d2f12'; k.fillRect(a.x, y - 4, a.w, 44); ui.text('Corrija a não conformidade e verifique de novo antes de marcar.', a.x + 16, y + 26, { size: 21, color: C.alerta, weight: 600 }); y += 52; }
  y = ui.para(it.how, a.x, y + 22, a.w, { size: 22, color: C.txt2 });
  // verificações
  const rows = [...(it.need || []).map(n => [NEED_LABEL[n], needDone(n)]), ...(it.meas || []).map(m => [measLabel(m), measDone(m)])];
  if (it.action === 'traction') rows.push(['Teste de tração feito', !!ses.flags.traction]);
  rows.forEach(([l, d], i) => progressRow(ui, a.x, y + 34 + i * 44, a.w, l, d));
  y += rows.length * 44 + 14;
  if (it.action === 'traction' && !fb) ui.button('tract', a.x, y + 6, 330, 54, 'Fazer teste de tração', () => doTraction(), { kind: 'secondary', size: 22 });
  if (ses.reading && ses.tool === 'multi' && !fb) ui.text(`Última leitura: ${ses.reading.txt}  (${termLabel(ses.reading.a)} × ${termLabel(ses.reading.b)})`, a.x + (it.action === 'traction' ? 350 : 0), y + 40, { size: 20, color: C.tint20, weight: 600 });
  // feedback / marcações
  const by = a.y + a.h - 44;
  if (fb) {
    k.fillStyle = fb.ok ? '#123f26' : '#3e1c16'; k.fillRect(a.x, by - 150, a.w, 136); k.fillStyle = fb.ok ? C.verde : C.erro; k.fillRect(a.x, by - 150, 8, 136);
    ui.para(fb.t, a.x + 24, by - 114, a.w - 40, { size: 22, maxY: by - 22 });
    const lbl = fb.found ? 'Vou corrigir' : (fb.ok ? (ses.item === CHECKLIST.length - 1 ? 'Ver relatório' : 'Próximo item') : 'Tentar de novo');
    ui.button('inext', a.x + a.w - 280, by, 280, 56, lbl, () => nextItem(), { kind: 'primary', size: 24 });
  } else {
    ui.button('mOK', a.x, by, 200, 56, 'OK', () => markItem('OK'), { kind: 'choice', size: 26, color: '#1f5a35' });
    ui.button('mNOK', a.x + 216, by, 200, 56, 'NOK', () => markItem('NOK'), { kind: 'choice', size: 26, color: '#6a2a20' });
    ui.button('mNA', a.x + 432, by, 200, 56, 'NA', () => markItem('NA'), { kind: 'choice', size: 26 });
    if (ses.item > 0) ui.button('iprev', a.x + a.w - 200, by, 200, 56, 'Item anterior', () => { ses.item--; ses.itemFb = null; ses.meas = []; dirty(); }, { kind: 'ghost', size: 20 });
  }
}
function drawRelatorio(ui, a) {
  const pts = ses.log.reduce((s, l) => s + l.pts, 0); const nota = Math.max(0, 100 - pts);
  let y = header(ui, a, ses.mode === 'desafio' ? 'Desafio concluído' : 'Missão 5 concluída', `Relatório do teste · nota ${nota}`);
  const mins = Math.round((Date.now() - ses.startT) / 60000);
  ui.text(`${CHECKLIST.length} itens verificados · ${(ses.ncs || []).length} não conformidade(s) encontrada(s) · ${mins} min`, a.x, y - 6, { size: 22, color: C.txt2 });
  y += 30;
  if (ses.mode === 'desafio') { const names = { swap: 'Fases trocadas (177/178)', qmx: 'Disjuntor-motor errado (GV2ME14)', kmx: 'Contator com bobina 220 Vca', crimp: 'Crimpagem incompleta (fio 179)', loose: 'Parafuso sem aperto (L3.2)', strap: 'Porta sem aterramento', nut: 'Porca da placa solta', link: 'Link GV2AF3 frouxo', gauge: 'Fio 177 com bitola 0,75 mm²', strip: 'Cobre exposto (fio 462)', rail: 'Trilho mal fixado', setting: 'Disjuntor-motor mal regulado', layout: 'RA26 e X24 trocados de posição', pe: 'Fio 179 no borne do terra (PE)', short: 'Decapagem curta (L2.2)' }; ui.text('Defeitos escondidos: ' + ses.defects.map(d => names[d]).join(' · '), a.x, y, { size: 20, color: C.alerta, weight: 600 }); y += 36; }
  ui.text(ses.log.length ? 'Pontos de atenção' : 'Nenhum erro registrado. Excelente trabalho!', a.x, y + 10, { size: 26, weight: 700 }); y += 30;
  for (const l of ses.log.slice(0, 9)) { ui.text(`${l.kind}`, a.x, y + 24, { size: 19, color: l.kind === 'Segurança' ? C.erro : C.alerta, weight: 700, mono: true }); ui.text(l.msg.length > 92 ? l.msg.slice(0, 90) + '…' : l.msg, a.x + 150, y + 24, { size: 20 }); y += 34; }
  if (ses.log.length > 9) ui.text(`+ ${ses.log.length - 9} outros`, a.x, y + 24, { size: 19, color: C.txt2 });
  ui.button('rmenu', a.x, a.y + a.h - 44, 220, 56, 'Missões', () => { ses.screen = 'menu'; dirty(); }, { kind: 'ghost', size: 22 });
  ui.button('rchal', a.x + a.w - 360, a.y + a.h - 44, 360, 56, 'Novo desafio de defeitos', () => startChallenge(), { kind: 'primary', size: 24 });
  ses.done.teste = true;
}
function drawDial(ui, a) {
  const part = PARTS[st.placed.QM.key]; const [lo, hi] = part.range;
  let y = header(ui, a, 'Regulagem do disjuntor-motor', `${part.tag} · ${part.code.split(' ')[0]}`);
  ui.para(`Faixa do relé térmico: ${fmtA(lo)} a ${fmtA(hi)}. Regule na corrente nominal do motor, que está na placa de identificação dele (no console de testes).`, a.x, y, a.w, { size: 24, color: C.txt2 });
  ui.text(fmtA(st.qm.setting), a.x + a.w / 2, y + 190, { size: 96, weight: 700, align: 'center', mono: true });
  const step = hi - lo > 2 ? 0.5 : 0.1;
  ui.button('dminus', a.x + a.w / 2 - 330, y + 112, 120, 100, '−', () => { st.qm.setting = Math.max(lo, Math.round((st.qm.setting - step) * 10) / 10); refresh(); dirty(); sfx.click(); }, { kind: 'choice', size: 56 });
  ui.button('dplus', a.x + a.w / 2 + 210, y + 112, 120, 100, '+', () => { st.qm.setting = Math.min(hi, Math.round((st.qm.setting + step) * 10) / 10); refresh(); dirty(); sfx.click(); }, { kind: 'choice', size: 56 });
  ui.button('dok', a.x + a.w - 240, a.y + a.h - 44, 240, 56, 'Pronto', () => { ses.dial = false; dirty(); }, { kind: 'primary', size: 24 });
}

// regulagem inicial dependente da peça
export function onPartChanged() { const p = st.placed.QM && PARTS[st.placed.QM.key]; if (p && (st.qm.setting < p.range[0] || st.qm.setting > p.range[1])) st.qm.setting = p.range[0]; }
window.__game = { get st() { return st; }, trayItems, slotMarkers, get linkMarker() { return linkMarker; }, get linkMesh() { return linkMesh; }, WB, termHits, plateNuts, CON, wireMeshes, get interiorHit() { return interiorHit; }, ses, autoBuild, goMission, startChallenge, truth, resetAll, CHECKLIST, solve: () => solve(st), markItem, nextItem, doTraction, setPower, setOut10, setQM, toggleMotor, probe, setTool };
