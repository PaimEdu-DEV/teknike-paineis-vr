// Motor: renderer, WebXR, ponteiros (mouse e controles), visões, tablet, toasts.
import * as THREE from '../vendor/three.module.min.js';
import { CanvasUI, C } from './ui.js';
import { initAudio, sfx } from './audio.js';

export const E = {
  clickables: [], views: {}, update: [], vr: false, holdState: null, viewName: null,
};
const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

export function initEngine(container) {
  const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(window.innerWidth, window.innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.xr.enabled = true; r.xr.setReferenceSpaceType('local-floor');
  if (r.xr.setFoveation) r.xr.setFoveation(0.5);
  container.appendChild(r.domElement);
  E.renderer = r;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#dfe6e2'); E.scene = scene;
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.02, 80);
  cam.position.set(0, 1.6, 0); E.camera = cam;
  const rig = new THREE.Group(); rig.add(cam); scene.add(rig); E.rig = rig;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa49e, 1.25));
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2.5, 4, 3); scene.add(dl);
  const dl2 = new THREE.DirectionalLight(0xffffff, 0.5); dl2.position.set(-3, 2.5, 1); scene.add(dl2);
  window.addEventListener('resize', () => { cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix(); r.setSize(window.innerWidth, window.innerHeight); });

  setupTablet();
  setupMouse();
  setupXR();
  setupToast();
  setupFade();
  E.raycaster = new THREE.Raycaster(); E.raycaster.near = 0.01; E.raycaster.far = 8;

  let last = performance.now();
  E.loop = (t, frame) => {
    const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    E.time = now / 1000;
    tickDesktop(dt);
    tickPointers(dt);
    tickXRInput(dt);
    for (const f of E.update) f(dt);
    tickPanels();
    tickToast(dt);
    tickFade(dt);
    r.render(scene, cam);
  };
  r.setAnimationLoop(E.loop);
}

// ---------- Registro de interativos ----------
// ia: { label: string|fn, action(hit, ptr) -> null | {type:'click', run} | {type:'hold', time, run, cancel}, ui?: CanvasUI }
export function register(obj, ia) { obj.userData.ia = ia; E.clickables.push(obj); return obj; }
export function unregister(obj) { const i = E.clickables.indexOf(obj); if (i >= 0) E.clickables.splice(i, 1); }
function pick(ray) {
  E.raycaster.ray.copy(ray);
  const live = E.clickables.filter(o => o.userData.ia && isVisible(o) && (!o.userData.ia.enabled || o.userData.ia.enabled()));
  const hits = E.raycaster.intersectObjects(live, false);
  if (!hits.length) return null;
  // prefere o primeiro objeto que aceita a ação atual (evita que uma área maior tape um borne)
  for (const h of hits.slice(0, 6)) { const ia = h.object.userData.ia; if (ia.panel) return h; try { if (ia.action && ia.action(h, null)) return h; } catch (e) { } }
  return hits[0];
}
function isVisible(o) { while (o) { if (o.visible === false && !(o.material && o.material.visible === false && o.userData.ia)) return false; o = o.parent; } return true; }

// ---------- Tablet (guia) ----------
function setupTablet() {
  const ui = new CanvasUI(1280, 900); E.tablet = ui;
  const dom = ui.canvas; dom.id = 'tablet'; document.body.appendChild(dom);
  const tex = new THREE.CanvasTexture(ui.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const W = 0.6, H = W * 900 / 1280;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, H + 0.02, 0.012), new THREE.MeshLambertMaterial({ color: '#1b1f1d' }));
  back.position.z = -0.0065; mesh.add(back);
  mesh.visible = false; E.scene.add(mesh); E.tabletMesh = mesh; E.tabletTex = tex;
  registerPanel(mesh, ui, tex);
  // DOM (PC)
  const toCanvas = (ev) => { const r = dom.getBoundingClientRect(); return [(ev.clientX - r.left) * ui.w / r.width, (ev.clientY - r.top) * ui.h / r.height]; };
  dom.addEventListener('pointermove', (ev) => { const [x, y] = toCanvas(ev); const b = ui.hit(x, y); ui.setHover(b); dom.style.cursor = b ? 'pointer' : 'default'; });
  dom.addEventListener('pointerleave', () => ui.setHover(null));
  dom.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); initAudio(); const [x, y] = toCanvas(ev); if (ui.click(x, y)) sfx.ui(); });
  dom.addEventListener('wheel', (ev) => { ev.stopPropagation(); ui.scroll?.(ev.deltaY); }, { passive: true });
}
const panels = [];
export function registerPanel(mesh, ui, tex) {
  panels.push({ ui, tex });
  register(mesh, {
    panel: ui,
    label: null,
    action: (hit) => {
      const px = hit.uv.x * ui.w, py = (1 - hit.uv.y) * ui.h; const b = ui.hit(px, py);
      if (!b) return null; return { type: 'click', run: () => { b.fn && b.fn(); sfx.ui(); } };
    },
  });
}
function tickPanels() { for (const p of panels) if (p.ui.dirty) { p.ui.render ? p.ui.render() : null; p.tex.needsUpdate = true; } }
export function panelTex(ui) { return panels.find(p => p.ui === ui)?.tex; }

export function placeTablet(pos, lookAt) {
  E.tabletMesh.position.copy(pos); E.tabletMesh.lookAt(lookAt);
}
export function bringTablet() {
  const head = new THREE.Vector3(); E.camera.getWorldPosition(head);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(E.camera.getWorldQuaternion(new THREE.Quaternion())); dir.y = 0; dir.normalize();
  const p = head.clone().addScaledVector(dir, 0.55); p.y = head.y - 0.28;
  placeTablet(p, head);
}

// ---------- Mouse / PC ----------
const desk = { yaw: 0, pitch: -0.15, keys: {}, drag: null, tween: null };
const mousePtr = { id: 'mouse', ray: new THREE.Ray(), hit: null, down: false, ndc: new THREE.Vector2(), moved: false, inside: false };
function setupMouse() {
  const el = E.renderer.domElement;
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointermove', (e) => {
    mousePtr.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mousePtr.inside = true;
    if (desk.drag) {
      const dx = e.clientX - desk.drag.x, dy = e.clientY - desk.drag.y; desk.drag.x = e.clientX; desk.drag.y = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 0) desk.drag.moved = true;
      desk.yaw -= dx * 0.004; desk.pitch = Math.max(-1.3, Math.min(1.2, desk.pitch - dy * 0.004)); desk.tween = null;
    }
    const tip = document.getElementById('tip'); tip.style.left = (e.clientX + 16) + 'px'; tip.style.top = (e.clientY + 18) + 'px';
  });
  el.addEventListener('pointerleave', () => { mousePtr.inside = false; });
  el.addEventListener('pointerdown', (e) => {
    initAudio();
    if (E.vr) return;
    if (e.button === 2) { desk.drag = { x: e.clientX, y: e.clientY }; return; }
    if (e.button !== 0) return;
    updateMouseRay();
    const hit = pick(mousePtr.ray);
    if (hit) { pressPointer(mousePtr, hit); }
    else desk.drag = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointerup', (e) => { desk.drag = null; releasePointer(mousePtr); });
  el.addEventListener('wheel', (e) => { if (E.vr) return; const f = new THREE.Vector3(); E.camera.getWorldDirection(f); E.camera.position.addScaledVector(f, -e.deltaY * 0.0008); desk.tween = null; }, { passive: true });
  window.addEventListener('keydown', (e) => { desk.keys[e.key.toLowerCase()] = true; E.onKey && E.onKey(e); });
  window.addEventListener('keyup', (e) => { desk.keys[e.key.toLowerCase()] = false; });
}
function updateMouseRay() {
  E.raycaster.setFromCamera(mousePtr.ndc, E.camera); mousePtr.ray.copy(E.raycaster.ray);
}
function tickDesktop(dt) {
  if (E.vr) return;
  const cam = E.camera;
  if (desk.tween) {
    const tw = desk.tween; tw.t = Math.min(1, tw.t + dt / tw.dur); const s = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2;
    cam.position.lerpVectors(tw.p0, tw.p1, s);
    desk.yaw = tw.y0 + angDiff(tw.y0, tw.y1) * s; desk.pitch = tw.pi0 + (tw.pi1 - tw.pi0) * s;
    if (tw.t >= 1) desk.tween = null;
  }
  const k = desk.keys; const sp = 1.2 * dt;
  const fwd = new THREE.Vector3(-Math.sin(desk.yaw), 0, -Math.cos(desk.yaw)), right = new THREE.Vector3(Math.cos(desk.yaw), 0, -Math.sin(desk.yaw));
  if (k['w'] || k['arrowup']) { cam.position.addScaledVector(fwd, sp); desk.tween = null; }
  if (k['s'] || k['arrowdown']) { cam.position.addScaledVector(fwd, -sp); desk.tween = null; }
  if (k['a'] || k['arrowleft']) { cam.position.addScaledVector(right, -sp); desk.tween = null; }
  if (k['d'] || k['arrowright']) { cam.position.addScaledVector(right, sp); desk.tween = null; }
  if (k['q']) { cam.position.y -= sp; desk.tween = null; } if (k['e']) { cam.position.y += sp; desk.tween = null; }
  cam.rotation.set(desk.pitch, desk.yaw, 0, 'YXZ');
}
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function yawPitch(eye, target) {
  const d = target.clone().sub(eye); const yaw = Math.atan2(-d.x, -d.z); const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); return [yaw, pitch];
}

// ---------- Visões / teleporte ----------
export function defineView(name, eye, target, tablet, deskBack = 0.32) { E.views[name] = { eye: new THREE.Vector3(...eye), target: new THREE.Vector3(...target), tablet, deskBack }; }
export function goView(name, instant = false) {
  const v = E.views[name]; if (!v) return; E.viewName = name;
  if (!E.vr) {
    const back = v.target.clone().sub(v.eye); back.y = 0; back.normalize();
    const eye = v.eye.clone().addScaledVector(back, -v.deskBack); eye.y += 0.05;
    let [y1, p1] = yawPitch(eye, v.target); y1 += 0.22; // tablet ocupa a esquerda da tela
    if (instant) { E.camera.position.copy(eye); desk.yaw = y1; desk.pitch = p1; desk.tween = null; }
    else desk.tween = { t: 0, dur: 0.9, p0: E.camera.position.clone(), p1: eye, y0: desk.yaw, y1, pi0: desk.pitch, pi1: p1 };
  } else {
    fadeThen(() => { teleportRig(v); placeTabletForView(v); });
    return;
  }
  placeTabletForView(v);
}
function teleportRig(v) {
  const [desired] = yawPitch(v.eye, v.target);
  const cq = E.camera.quaternion; const e = new THREE.Euler().setFromQuaternion(cq, 'YXZ');
  E.rig.rotation.set(0, desired - e.y, 0);
  const off = new THREE.Vector3(E.camera.position.x, 0, E.camera.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), E.rig.rotation.y);
  E.rig.position.set(v.eye.x - off.x, 0, v.eye.z - off.z);
}
function placeTabletForView(v) {
  const f = v.target.clone().sub(v.eye); f.y = 0; f.normalize();
  const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const o = v.tablet || [-0.42, -0.3, 0.5];
  const p = v.eye.clone().addScaledVector(right, o[0]).addScaledVector(f, o[2]); p.y = v.eye.y + o[1];
  const eye = v.eye.clone(); if (E.vr) { E.camera.getWorldPosition(eye); p.y = eye.y + o[1]; }
  placeTablet(p, eye);
}

// ---------- Ponteiros (comum) ----------
function pressPointer(ptr, hit) {
  const ia = hit.object.userData.ia; if (!ia) return;
  const act = ia.action ? ia.action(hit, ptr) : null;
  if (!act) return;
  ptr.down = true;
  if (act.type === 'click') { act.run(); pulse(ptr, 0.4, 25); }
  else if (act.type === 'hold') { E.holdState = { ptr, act, obj: hit.object, t: 0 }; }
}
function releasePointer(ptr) {
  ptr.down = false;
  const h = E.holdState; if (h && h.ptr === ptr) { E.holdState = null; if (h.t < h.act.time) h.act.cancel && h.act.cancel(h.t / h.act.time); }
}
function tickHold(dt) {
  const h = E.holdState; if (!h) return null;
  // precisa continuar apontando para o mesmo objeto
  // tolerância: o laser pode escapar do alvo por um instante (mão tremendo)
  if (h.ptr.hit?.object !== h.obj) { h.off = (h.off || 0) + dt; if (h.off > 0.35) { E.holdState = null; h.act.cancel && h.act.cancel(h.t / h.act.time); return null; } return h.t / h.act.time; }
  h.off = 0; h.t += dt; h.act.progress && h.act.progress(h.t / h.act.time);
  if (h.t >= h.act.time) { E.holdState = null; h.act.run(); pulse(h.ptr, 0.8, 60); return null; }
  if (Math.floor(h.t * 8) !== Math.floor((h.t - dt) * 8)) pulse(h.ptr, 0.15, 10);
  return h.t / h.act.time;
}
function pulse(ptr, v, ms) { try { ptr.source?.gamepad?.hapticActuators?.[0]?.pulse(v, ms); } catch (e) { } }

let lastTip = null;
function tickPointers(dt) {
  const tip = document.getElementById('tip');
  if (!E.vr) {
    if (mousePtr.inside && !desk.drag) { updateMouseRay(); mousePtr.hit = pick(mousePtr.ray); } else if (!desk.drag) mousePtr.hit = null;
    const hit = mousePtr.hit; const ia = hit?.object.userData.ia;
    // hover em painéis 3D
    for (const p of panels) if (!ia || ia.panel !== p.ui) { if (p.ui !== E.tablet || E.vr) p.ui.setHover(null); }
    let label = null;
    if (ia?.panel) { const b = ia.panel.hit(hit.uv.x * ia.panel.w, (1 - hit.uv.y) * ia.panel.h); ia.panel.setHover(b); }
    else if (ia) label = typeof ia.label === 'function' ? ia.label(hit) : ia.label;
    E.renderer.domElement.style.cursor = ia && (ia.panel ? ia.panel.hit(hit.uv.x * ia.panel.w, (1 - hit.uv.y) * ia.panel.h) : true) ? 'pointer' : (desk.drag ? 'grabbing' : 'default');
    if (label !== lastTip) { lastTip = label; tip.textContent = label || ''; tip.style.display = label ? 'block' : 'none'; }
    const p = tickHold(dt); const ring = document.getElementById('ring');
    if (p !== null) { ring.style.display = 'block'; ring.style.left = tip.style.left; ring.style.top = tip.style.top; ring.style.setProperty('--p', Math.round(p * 100)); }
    else ring.style.display = 'none';
  } else {
    tip.style.display = 'none';
    for (const c of E.ctrls) {
      if (!c.connected) { c.line.visible = false; c.cursor.visible = false; continue; }
      tmpM.identity().extractRotation(c.space.matrixWorld);
      c.ray.origin.setFromMatrixPosition(c.space.matrixWorld); c.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
      c.hit = pick(c.ray);
      const len = c.hit ? c.hit.distance : 1.5; c.line.scale.z = len; c.line.visible = true;
      if (c.hit) { c.cursor.visible = true; c.cursor.position.set(0, 0, -len + 0.002); } else c.cursor.visible = false;
    }
    // hover de painéis + rótulo 3D do controle dominante
    const main = E.ctrls.find(c => c.connected && c.hit) || null;
    const hov = new Map(panels.map(p => [p.ui, null]));
    let label = null, at = null;
    for (const c of E.ctrls) {
      const ia = c.hit?.object.userData.ia; if (!ia) continue;
      if (ia.panel) { const b = ia.panel.hit(c.hit.uv.x * ia.panel.w, (1 - c.hit.uv.y) * ia.panel.h); if (b) hov.set(ia.panel, b); }
      else if (!label) { label = typeof ia.label === 'function' ? ia.label(c.hit) : ia.label; at = c.hit.point; }
    }
    for (const [ui, b] of hov) ui.setHover(b);
    setVRTip(label, at); placeHandTag();
    const p = tickHold(dt);
    E.vrRing.visible = p !== null;
    if (p !== null && E.holdState) { const hp = E.holdState.ptr.hit?.point; if (hp) { E.vrRing.position.copy(hp); E.vrRing.lookAt(E.camera.getWorldPosition(tmpV)); E.vrRing.geometry.dispose(); E.vrRing.geometry = new THREE.RingGeometry(0.012, 0.018, 24, 1, Math.PI / 2, -p * Math.PI * 2); } }
  }
}

// ---------- WebXR ----------
function setupXR() {
  E.ctrls = [];
  for (let i = 0; i < 2; i++) {
    const space = E.renderer.xr.getController(i);
    const c = { id: 'xr' + i, space, ray: new THREE.Ray(), hit: null, connected: false, source: null, down: false, lastAxis: 0, btn: {} };
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    c.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: C.verde })); space.add(c.line);
    c.cursor = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: C.verde })); space.add(c.cursor);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.1, 12), new THREE.MeshLambertMaterial({ color: '#2b2f33' }));
    body.rotation.x = Math.PI / 2; body.position.z = 0.05; space.add(body);
    space.addEventListener('connected', (e) => { c.connected = true; c.source = e.data; body.visible = !e.data.hand; });
    space.addEventListener('disconnected', () => { c.connected = false; c.source = null; });
    space.addEventListener('selectstart', () => { initAudio(); if (c.hit) pressPointer(c, c.hit); });
    space.addEventListener('selectend', () => releasePointer(c));
    E.rig.add(space); E.ctrls.push(c);
  }
  const hc = document.createElement('canvas'); hc.width = 512; hc.height = 80;
  const htex = new THREE.CanvasTexture(hc); htex.colorSpace = THREE.SRGBColorSpace;
  E.handTag = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.019), new THREE.MeshBasicMaterial({ map: htex, transparent: true, depthTest: false }));
  E.handTag.renderOrder = 996; E.handTag.visible = false; E.handTag.userData = { c: hc, tex: htex, last: null };
  E.vrRing = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.018, 24), new THREE.MeshBasicMaterial({ color: C.verde, side: THREE.DoubleSide, depthTest: false }));
  E.vrRing.renderOrder = 999; E.vrRing.visible = false; E.scene.add(E.vrRing);
  // rótulo 3D
  const tipUI = document.createElement('canvas'); tipUI.width = 512; tipUI.height = 96;
  const tex = new THREE.CanvasTexture(tipUI); tex.colorSpace = THREE.SRGBColorSpace;
  E.vrTip = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0375), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
  E.vrTip.renderOrder = 998; E.vrTip.visible = false; E.scene.add(E.vrTip); E.vrTip.userData = { canvas: tipUI, tex, last: null };

  E.renderer.xr.addEventListener('sessionstart', () => {
    E.vr = true; document.body.classList.add('in-vr'); E.tabletMesh.visible = true;
    E.camera.position.set(0, 0, 0); E.camera.rotation.set(0, 0, 0);
    setTimeout(() => goView(E.viewName || 'projeto', true), 50);
    E.onVR && E.onVR(true);
  });
  E.renderer.xr.addEventListener('sessionend', () => {
    E.vr = false; document.body.classList.remove('in-vr'); E.tabletMesh.visible = false;
    E.rig.position.set(0, 0, 0); E.rig.rotation.set(0, 0, 0);
    goView(E.viewName || 'projeto', true); E.onVR && E.onVR(false);
  });
}
export function setHandTag(text) {
  const t = E.handTag; if (!t) return; const d = t.userData;
  if (d.last === text) return; d.last = text;
  const k = d.c.getContext('2d'); k.clearRect(0, 0, 512, 80);
  if (text) { k.font = '600 30px Archivo, Arial'; const w = Math.min(508, k.measureText(text).width + 30); k.fillStyle = 'rgba(86,185,81,0.95)'; k.fillRect(0, 10, w, 60); k.fillStyle = '#100F0D'; k.fillText(text, 15, 50, 480); }
  d.tex.needsUpdate = true;
}
function placeHandTag() {
  const t = E.handTag; const c = E.ctrls.find(c => c.connected && c.source?.handedness === 'right') || E.ctrls.find(c => c.connected);
  if (!E.vr || !c || !t.userData.last) { t.visible = false; return; }
  if (t.parent !== c.space) { c.space.add(t); t.position.set(0.045, 0.03, 0.02); t.rotation.set(-0.6, 0, 0); }
  t.visible = true;
}
function setVRTip(label, at) {
  const t = E.vrTip; const d = t.userData;
  if (!label || !at) { t.visible = false; return; }
  if (d.last !== label) {
    d.last = label; const k = d.canvas.getContext('2d'); k.clearRect(0, 0, 512, 96);
    k.font = '600 34px Archivo, Arial'; const w = Math.min(500, k.measureText(label).width + 36);
    k.fillStyle = 'rgba(11,42,29,0.94)'; k.fillRect((512 - w) / 2, 14, w, 68);
    k.fillStyle = '#fff'; k.textAlign = 'center'; k.fillText(label, 256, 60, 480); d.tex.needsUpdate = true;
  }
  const head = E.camera.getWorldPosition(tmpV.clone());
  t.position.copy(at).lerp(head, 0.08); t.position.y += 0.035; t.lookAt(head); t.visible = true;
}
function tickXRInput(dt) {
  if (!E.vr) return;
  for (const c of E.ctrls) {
    const gp = c.source?.gamepad; if (!gp) continue;
    const ax = gp.axes[2] ?? 0;
    if (Math.abs(ax) > 0.7 && Math.abs(c.lastAxis) <= 0.7) {
      // giro suave em passos de 30°, mantendo a cabeça no lugar
      const head = E.camera.getWorldPosition(new THREE.Vector3());
      const ang = ax > 0 ? -Math.PI / 6 : Math.PI / 6;
      E.rig.rotation.y += ang;
      const after = E.camera.getWorldPosition(new THREE.Vector3()); E.rig.updateMatrixWorld();
      const after2 = E.camera.getWorldPosition(new THREE.Vector3());
      E.rig.position.x += head.x - after2.x; E.rig.position.z += head.z - after2.z;
    }
    c.lastAxis = ax;
    const bA = !!gp.buttons[4]?.pressed, bB = !!gp.buttons[5]?.pressed;
    if (bA && !c.btn.a) E.onButton && E.onButton('a');
    if (bB && !c.btn.b) E.onButton && E.onButton('b');
    c.btn.a = bA; c.btn.b = bB;
  }
}

export async function enterVR() {
  if (!navigator.xr) return false;
  const opt = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
  try { const s = await navigator.xr.requestSession('immersive-vr', opt); await E.renderer.xr.setSession(s); return true; } catch (e) { console.warn(e); return false; }
}

// ---------- Toast ----------
function setupToast() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 200;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.098), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
  m.renderOrder = 997; m.visible = false; E.scene.add(m); E.toast3d = { m, cv, tex, t: 0 };
}
export function toast(msg, kind = 'info', secs = 4) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show ' + kind; clearTimeout(el._t); el._t = setTimeout(() => el.className = '', secs * 1000);
  if (kind === 'err') sfx.err(); else if (kind === 'ok') sfx.ok();
  const T = E.toast3d; const k = T.cv.getContext('2d'); k.clearRect(0, 0, 1024, 200);
  k.fillStyle = kind === 'err' ? '#7a2417' : (kind === 'ok' ? C.floresta : '#1d2b24'); k.fillRect(0, 0, 1024, 200);
  k.fillStyle = kind === 'err' ? C.erro : (kind === 'ok' ? C.verde : C.alerta); k.fillRect(0, 0, 14, 200);
  k.fillStyle = '#fff'; k.font = '600 40px Archivo, Arial'; k.textAlign = 'left';
  // quebra em até 3 linhas
  const words = msg.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (k.measureText(t).width > 960 && cur) { lines.push(cur); cur = w; } else cur = t; } lines.push(cur);
  const L = lines.slice(0, 3); const y0 = 100 - (L.length - 1) * 24 + 14; L.forEach((l, i) => k.fillText(l, 36, y0 + i * 48));
  T.tex.needsUpdate = true; T.t = secs;
  if (E.vr) {
    const head = E.camera.getWorldPosition(new THREE.Vector3()); const q = E.camera.getWorldQuaternion(new THREE.Quaternion());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); f.y = Math.max(-0.3, Math.min(0.3, f.y)); f.normalize();
    T.m.position.copy(head).addScaledVector(f, 0.9); T.m.position.y -= 0.18; T.m.lookAt(head); T.m.visible = true;
  }
}
function tickToast(dt) { const T = E.toast3d; if (T.t > 0) { T.t -= dt; if (T.t <= 0) T.m.visible = false; } if (!E.vr) T.m.visible = false; }

// ---------- Fade (teleporte VR) ----------
function setupFade() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
  m.renderOrder = 1000; m.visible = false; E.camera.add(m); E.fade = { m, t: 0, cb: null, phase: 0 };
}
function fadeThen(cb) { const F = E.fade; F.cb = cb; F.phase = 1; F.t = 0; F.m.visible = true; }
function tickFade(dt) {
  const F = E.fade; if (!F.phase) return;
  F.t += dt / 0.18;
  if (F.phase === 1) { F.m.material.opacity = Math.min(1, F.t); if (F.t >= 1) { F.cb && F.cb(); F.cb = null; F.phase = 2; F.t = 0; } }
  else { F.m.material.opacity = Math.max(0, 1 - F.t); if (F.t >= 1) { F.phase = 0; F.m.visible = false; } }
}
