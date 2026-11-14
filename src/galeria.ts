// Galeria de revisão (só desenvolvimento): ?familia=peixe ou ?ids=a,b ou ?pagina=0 (48 por página).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { criarFormaAlimento, familiaDe, listarAlimentos } from './modelos/alimentos';
import { Peca } from './pecas/peca';

const q = new URLSearchParams(location.search);
let ids = listarAlimentos();
if (q.get('familia')) ids = ids.filter((id) => familiaDe(id) === q.get('familia'));
if (q.get('ids')) ids = q.get('ids')!.split(',');
const porPagina = Number(q.get('n') ?? 48);
const pagina = Number(q.get('pagina') ?? 0);
ids = ids.slice(pagina * porPagina, (pagina + 1) * porPagina);
const colunas = Math.ceil(Math.sqrt(ids.length * 1.6));
const linhas = Math.ceil(ids.length / colunas);
const W = 1600;
const celula = Math.floor(W / colunas);
const H = celula * linhas;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setSize(W, H);
r.setPixelRatio(1);
r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.ACESFilmicToneMapping;
r.setScissorTest(true);
r.localClippingEnabled = true;
const pm = new THREE.PMREMGenerator(r);
const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
const rot = document.getElementById('rotulos')!;
ids.forEach((id, i) => {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(i % 2 ? '#dfe7ef' : '#e9eef4');
  cena.environment = env;
  // ?luz=jogo imita a iluminação da cozinha (mais contida que a padrão da galeria)
  const jogo = q.get('luz') === 'jogo';
  if (jogo) cena.environmentIntensity = 0.45;
  cena.add(jogo ? new THREE.HemisphereLight('#bcd0ee', '#806048', 0.6) : new THREE.HemisphereLight('#ffffff', '#8899aa', 1.2));
  const sol = jogo ? new THREE.DirectionalLight('#ffc48a', 5.0) : new THREE.DirectionalLight('#fff4e0', 2.2);
  sol.position.set(1, 2, 1.5);
  cena.add(sol);
  let p: Peca;
  try {
    p = new Peca(criarFormaAlimento(id));
  } catch (e) {
    console.error(id, e);
    return;
  }
  p.atualizar(0);
  cena.add(p);
  const caixa = new THREE.Box3().setFromObject(p);
  const c = caixa.getCenter(new THREE.Vector3());
  const tam = caixa.getSize(new THREE.Vector3()).length();
  const cam = new THREE.PerspectiveCamera(35, 1, tam / 100, tam * 20);
  cam.position.copy(c).add(new THREE.Vector3(0.2, 0.75, 1).normalize().multiplyScalar(tam * 1.5));
  cam.lookAt(c);
  const x = (i % colunas) * celula;
  const y = Math.floor(i / colunas) * celula;
  r.setViewport(x, H - y - celula, celula, celula);
  r.setScissor(x, H - y - celula, celula, celula);
  r.render(cena, cam);
  const d = document.createElement('div');
  d.style.left = `${x}px`;
  d.style.top = `${y + celula - 18}px`;
  d.style.width = `${celula}px`;
  d.textContent = `${id} (${familiaDe(id)}) ${(caixa.getSize(new THREE.Vector3()).x * 100).toFixed(0)} cm`;
  rot.append(d);
});
(window as unknown as { pronto: boolean }).pronto = true;
