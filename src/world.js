// Cenário estático: sala, bancadas, quadro de projeto, quadro elétrico, console de testes.
import * as THREE from '../vendor/three.module.min.js';
import { E, registerPanel } from './engine.js';
import { box, cyl, mat, buildTable, labelPlane, buildPlate, buildRail, screwMesh, PLATE, buildPEBar } from './models.js';
import { CanvasUI, C } from './ui.js';
import { RAILS } from './data.js';

export const W = {};
export const PLATE_SCALE = 1.8;
export const EASEL_POS = new THREE.Vector3(0, 1.34, -0.83);
export const ENCL_POS = new THREE.Vector3(3, 0, -0.98);

export function buildWorld(logoImgs) {
  const s = E.scene;
  // piso e paredes
  const fc = document.createElement('canvas'); fc.width = fc.height = 512; const k = fc.getContext('2d');
  k.fillStyle = '#c9cfcb'; k.fillRect(0, 0, 512, 512); k.strokeStyle = '#b5bcb8'; k.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) { k.beginPath(); k.moveTo(i, 0); k.lineTo(i, 512); k.moveTo(0, i); k.lineTo(512, i); k.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(8, 6); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshLambertMaterial({ map: ft })); floor.rotation.x = -Math.PI / 2; floor.position.set(1.5, 0, 0); s.add(floor);
  const wallM = mat('#eef1ef');
  s.add(box(16, 3.2, 0.1, wallM, 1.5, 1.6, -2.2));
  s.add(box(0.1, 3.2, 12, wallM, -3.2, 1.6, 0));
  s.add(box(0.1, 3.2, 12, wallM, 6.2, 1.6, 0));
  s.add(box(16, 0.12, 0.12, '#56B951', 1.5, 0.06, -2.14));
  // faixa de piso de segurança em volta da área de teste
  // banner com logo
  if (logoImgs.cor) {
    const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 300; const b = bc.getContext('2d');
    b.fillStyle = '#ffffff'; b.fillRect(0, 0, 1024, 300);
    const lw = 620, lh = lw * logoImgs.cor.height / logoImgs.cor.width; b.drawImage(logoImgs.cor, 60, 150 - lh / 2, lw, lh);
    b.fillStyle = '#56B951'; b.fillRect(0, 280, 1024, 20);
    b.fillStyle = '#100F0D'; b.font = '600 34px Archivo, Arial'; b.fillText('Oficina de painéis', 740, 140); b.fillStyle = '#6C6E70'; b.font = '400 26px Archivo, Arial'; b.fillText('treino em VR', 740, 180);
    const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.645), new THREE.MeshBasicMaterial({ map: bt })); ban.position.set(1.5, 2.45, -2.14); s.add(ban);
  }

  // ---------- Estação A: bancada da placa ----------
  const t1 = buildTable(1.3, 0.62); t1.position.set(0, 0, -0.74); s.add(t1);
  // cavalete
  s.add(box(0.05, 0.95, 0.04, '#3c4046', -0.47, 1.32, -0.9));
  s.add(box(0.05, 0.95, 0.04, '#3c4046', 0.47, 1.32, -0.9));
  s.add(box(1.0, 0.04, 0.06, '#3c4046', 0, 0.9, -0.86));
  s.add(box(1.0, 0.04, 0.04, '#3c4046', 0, 1.78, -0.9));
  // bandeja de peças
  s.add(box(1.16, 0.012, 0.16, '#2a2e33', 0, 0.856, -0.5));
  W.trayY = 0.862; W.trayZ = -0.5;
  const trayLab = labelPlane([{ t: 'Bandeja de componentes', size: 30, bold: true, color: '#ffffff' }], 0.3, 0.03, { w: 512, h: 52, bg: '#2a2e33' });
  trayLab.position.set(0, 0.865, -0.415); trayLab.rotation.x = -Math.PI / 2; s.add(trayLab);

  // placa de montagem (raiz dinâmica)
  const plateRoot = new THREE.Group(); plateRoot.position.copy(EASEL_POS); plateRoot.scale.setScalar(PLATE_SCALE); s.add(plateRoot);
  const P = buildPlate(); plateRoot.add(P.group); W.plateRoot = plateRoot; W.plateMesh = P.plateMesh; W.plateHoles = P.holes;
  // trilhos com parafusos
  W.rails = {}; W.railScrews = [];
  for (const [r, y] of Object.entries(RAILS)) {
    const len = r === 'C' ? 0.29 : 0.34; const x0 = r === 'C' ? 0.025 : 0;
    const rail = buildRail(len); rail.position.set(x0, y, 0); plateRoot.add(rail); W.rails[r] = rail;
    for (const [i, sx] of [[0, x0 - len / 2 + 0.012], [1, x0 + len / 2 - 0.012]]) {
      const sc = screwMesh(); sc.position.set(sx, y, 0.0015); sc.userData.loosePos = 0.0035; sc.position.z = 0.0035; plateRoot.add(sc);
      W.railScrews.push({ rail: r, i, mesh: sc });
    }
  }
  const pe = buildPEBar(); pe.group.position.set(-0.15, -0.185, 0); plateRoot.add(pe.group); W.peBar = pe;
  // cabos pré-ligados (vindos de fora) ficam a cargo do jogo
  // ---------- Quadro de projeto (lousa) ----------
  const boardUI = new CanvasUI(1600, 1100); W.boardUI = boardUI;
  const btex = new THREE.CanvasTexture(boardUI.canvas); btex.colorSpace = THREE.SRGBColorSpace; btex.anisotropy = 8;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.36 * 1100 / 1600), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false }));
  board.position.set(-1.12, 1.45, -0.62); board.lookAt(-0.3, 1.45, 0.1); s.add(board); W.board = board;
  const bframe = box(1.4, 1.4 * 1100 / 1600 + 0.04, 0.03, '#1b1f1d'); bframe.position.set(0, 0, -0.018); board.add(bframe);
  const bleg = box(0.06, 1.0, 0.06, '#3c4046', 0, -0.8, -0.05); board.add(bleg);
  registerPanel(board, boardUI, btex);

  // ---------- Estação de cabos ----------
  const wb = new THREE.Group(); wb.position.set(1.08, 0, -0.42); wb.lookAt(0.45, 0, 0.15); s.add(wb); W.wireBench = wb;
  const t2 = buildTable(1.2, 0.6, 0.85, '#d8d2c4'); wb.add(t2);
  wb.add(box(1.0, 0.004, 0.4, '#2f3a35', 0, 0.852, 0.0)); // manta
  const wbl = labelPlane([{ t: 'Bancada de preparo de cabos', size: 30, bold: true, color: '#ffffff' }], 0.36, 0.034, { w: 512, h: 48, bg: '#0B2A1D' });
  wbl.position.set(0, 0.86, 0.27); wbl.rotation.x = -Math.PI / 2; wb.add(wbl);

  // ---------- Estação B: quadro elétrico ----------
  const enc = new THREE.Group(); enc.position.copy(ENCL_POS); s.add(enc); W.encl = enc;
  const EW = 0.88, EH = 1.02, ED = 0.32, EY = 1.33;
  const encM = mat('#d6d7d2');
  enc.add(box(EW, EH, 0.02, encM, 0, EY, -ED / 2));
  enc.add(box(0.02, EH, ED, encM, -EW / 2, EY, 0)); enc.add(box(0.02, EH, ED, encM, EW / 2, EY, 0));
  enc.add(box(EW, 0.02, ED, encM, 0, EY + EH / 2, 0)); enc.add(box(EW, 0.02, ED, encM, 0, EY - EH / 2, 0));
  enc.add(box(EW * 0.9, EY - EH / 2, ED * 0.9, '#4a4f55', 0, (EY - EH / 2) / 2, 0)); // pedestal
  // terminal de terra da carcaça
  const encStud = cyl(0.008, 0.02, '#c9a227', -EW / 2 + 0.05, EY - EH / 2 + 0.05, -ED / 2 + 0.02, 'z'); enc.add(encStud); W.encStud = encStud;
  const encStudLab = labelPlane([{ t: 'PE carcaça', size: 26, bold: true }], 0.06, 0.016, { w: 192, h: 52, bg: '#e8d23a' }); encStudLab.position.set(-EW / 2 + 0.05, EY - EH / 2 + 0.08, -ED / 2 + 0.011); enc.add(encStudLab);
  // porta
  const hinge = new THREE.Group(); hinge.position.set(-EW / 2, EY, ED / 2 + 0.012); enc.add(hinge);
  const door = new THREE.Group(); hinge.add(door);
  const doorPanel = box(EW, EH, 0.02, encM, EW / 2, 0, 0); door.add(doorPanel);
  door.add(box(EW * 0.82, EH * 0.86, 0.004, '#cfd0cb', EW / 2, 0, -0.012));
  const handle = new THREE.Group(); handle.position.set(EW - 0.06, 0, 0.012); door.add(handle);
  handle.add(box(0.03, 0.12, 0.02, '#2a2e33', 0, 0, 0.012)); handle.add(box(0.016, 0.07, 0.03, '#45494e', 0, -0.02, 0.03));
  const dl = labelPlane([{ t: 'PERIGO', size: 40, bold: true, color: '#100F0D' }, { t: 'Eletricidade', size: 30, color: '#100F0D' }], 0.16, 0.1, { w: 256, h: 160, bg: '#f2c12e' });
  dl.position.set(EW / 2, 0.25, 0.0105); door.add(dl);
  const tagD = labelPlane([{ t: 'PAINEL MIÚDOS · -M151', size: 30, bold: true }], 0.26, 0.04, { w: 512, h: 78, bg: '#ffffff' }); tagD.position.set(EW / 2, 0.42, 0.0105); door.add(tagD);
  // terminal de terra da porta (lado de dentro) e cordoalha
  const doorStud = cyl(0.008, 0.02, '#c9a227', 0.06, -EH / 2 + 0.07, -0.02, 'z'); door.add(doorStud); W.doorStud = doorStud;
  W.door = { hinge, door, handle, panel: doorPanel, EW, EH, ED, EY, open: 0, target: 0 };
  // cordoalha (malha) - mostrada quando ligada
  const strapOn = box(0.012, 0.004, 0.2, '#b87333'); strapOn.visible = false; enc.add(strapOn); W.strapOn = strapOn;
  const strapOff = box(0.012, 0.09, 0.004, '#b87333', -EW / 2 + 0.05, EY - EH / 2 + 0.12, -ED / 2 + 0.025); enc.add(strapOff); W.strapOff = strapOff;
  // placa: posição final dentro do quadro (mundo)
  W.plateInPos = new THREE.Vector3(ENCL_POS.x, EY, ENCL_POS.z - ED / 2 + 0.03);
  // alvo para soltar a placa
  // ---------- Console de testes ----------
  const con = new THREE.Group(); con.position.set(3.98, 0, -0.45); con.lookAt(3.0, 0, 0.35); s.add(con); W.console = con;
  con.add(buildTable(1.0, 0.6, 0.85, '#d8d2c4'));
  const conLab = labelPlane([{ t: 'Console de testes', size: 30, bold: true, color: '#ffffff' }], 0.3, 0.032, { w: 480, h: 52, bg: '#0B2A1D' });
  conLab.position.set(0, 0.86, 0.27); conLab.rotation.x = -Math.PI / 2; con.add(conLab);
  // faixa zebrada no piso (área isolada) -> aparece com os cones
  const cones = new THREE.Group(); s.add(cones); cones.visible = false; W.cones = cones;
  for (const [x, z] of [[2.2, -0.2], [2.6, 0.55], [3.4, 0.55], [3.8, -0.2]]) {
    const c = new THREE.Group(); c.position.set(x, 0, z);
    c.add(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.42, 16), mat('#f07c1b'))); c.children[0].position.y = 0.21;
    c.add(new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.088, 0.06, 16), mat('#ffffff'))); c.children[1].position.y = 0.2;
    cones.add(c);
  }
  const chain = box(1.6, 0.025, 0.025, '#f2c12e', 3.0, 0.36, 0.55); cones.add(chain);
  return W;
}
