import { initEngine, enterVR, E, goView } from './engine.js';
import { buildWorld } from './world.js';
import { initGame } from './game.js';
import { setBoardLogo } from './diagrams.js';
import { initAudio } from './audio.js';

async function loadFonts() {
  const list = [['Archivo', 'archivo-latin-400-normal', 400], ['Archivo', 'archivo-latin-600-normal', 600], ['Archivo', 'archivo-latin-700-normal', 700], ['IBM Plex Mono', 'ibm-plex-mono-latin-600-normal', 600]];
  await Promise.all(list.map(async ([fam, file, w]) => {
    try { const f = new FontFace(fam, `url(assets/teknike/fonts/${file}.woff2)`, { weight: String(w) }); await f.load(); document.fonts.add(f); } catch (e) { console.warn('fonte', file, e); }
  }));
}
function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

async function boot() {
  await loadFonts();
  const [cor, branco] = await Promise.all([loadImg('assets/teknike/logo/teknike-logo-completo-cor.svg'), loadImg('assets/teknike/logo/teknike-logo-compacto-branco.svg')]);
  // rasteriza SVG em resolução boa
  const raster = (img, w) => { if (!img) return null; const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * img.height / img.width); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c; };
  const corR = raster(cor, 1200);
  setBoardLogo(corR);
  initEngine(document.getElementById('app'));
  buildWorld({ cor: corR, branco: raster(branco, 600) });
  initGame();
  document.getElementById('loading').style.display = 'none';
  const vrBtn = document.getElementById('btn-vr');
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (ok) { vrBtn.disabled = false; vrBtn.textContent = 'Entrar em VR'; }
  else { vrBtn.disabled = true; vrBtn.textContent = 'VR indisponível neste navegador'; }
  vrBtn.onclick = async () => { initAudio(); document.getElementById('start').classList.add('hide'); const r = await enterVR(); if (!r) document.getElementById('start').classList.remove('hide'); };
  document.getElementById('btn-pc').onclick = () => { initAudio(); document.getElementById('start').classList.add('hide'); };
  E.onVR = (on) => { if (!on) document.getElementById('start').classList.add('hide'); };
  // atalho de teste: ?pc pula a tela inicial
  if (location.search.includes('pc')) document.getElementById('start').classList.add('hide');
}
boot();
