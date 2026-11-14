// Vitrine da cozinha: monta só o cenário, com câmera orbital e atalhos para as estações.
// Parâmetros de URL úteis para conferência: ?estacao=fogao, ?chama=0.8, ?forno=1, ?info=1
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { criarCozinha } from './cozinha';
import type { CenaEstacao } from '../tipos';

const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: params.has('info') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;
document.body.appendChild(renderer.domElement);

const cena = new THREE.Scene();
cena.background = new THREE.Color('#0d1626');
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 80);

const cozinha = criarCozinha();
cena.add(cozinha.grupo);

// ?sosol=1 deixa só o sol aceso (para conferir sombras).
if (params.has('sosol')) {
  cozinha.grupo.traverse((o) => {
    if (o instanceof THREE.Light && !(o instanceof THREE.DirectionalLight)) o.intensity = 0;
  });
}

const controles = new OrbitControls(camera, renderer.domElement);
controles.enableDamping = true;

function irPara(id: CenaEstacao | 'inicio'): void {
  if (id === 'inicio') {
    camera.position.copy(cozinha.inicio.posicao);
    controles.target.copy(cozinha.inicio.olhar);
  } else {
    const e = cozinha.estacoes[id];
    camera.position.copy(e.camera);
    controles.target.copy(e.olhar);
  }
  controles.update();
}

// Painel com seletor de estação e controles de chama e forno.
const painel = document.getElementById('painel')!;
const seletor = document.createElement('select');
for (const id of ['inicio', ...Object.keys(cozinha.estacoes)]) {
  const o = document.createElement('option');
  o.value = id;
  o.textContent = id;
  seletor.appendChild(o);
}
seletor.onchange = () => irPara(seletor.value as CenaEstacao | 'inicio');
painel.appendChild(seletor);

function deslizante(rotulo: string, inicial: number, f: (v: number) => void): void {
  const l = document.createElement('label');
  l.textContent = rotulo;
  const i = document.createElement('input');
  i.type = 'range';
  i.min = '0';
  i.max = '1';
  i.step = '0.01';
  i.value = String(inicial);
  i.oninput = () => f(Number(i.value));
  l.appendChild(i);
  painel.appendChild(l);
  f(inicial);
}
deslizante('chama', Number(params.get('chama') ?? 0.6), cozinha.definirChama);
deslizante('forno', Number(params.get('forno') ?? 0.5), cozinha.definirForno);

const info = document.getElementById('info')!;
const inicial = (params.get('estacao') ?? 'inicio') as CenaEstacao | 'inicio';
seletor.value = inicial;
irPara(inicial);
// ?cam=x,y,z&alvo=x,y,z posiciona a câmera livremente.
const vet = (s: string | null) => (s ? new THREE.Vector3(...(s.split(',').map(Number) as [number, number, number])) : null);
const camLivre = vet(params.get('cam'));
const alvoLivre = vet(params.get('alvo'));
if (camLivre) camera.position.copy(camLivre);
if (alvoLivre) controles.target.copy(alvoLivre);
controles.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const relogio = new THREE.Clock();
let quadros = 0;
function quadro(): void {
  const dt = Math.min(relogio.getDelta(), 0.1);
  const t = relogio.elapsedTime;
  cozinha.atualizar(dt, t);
  controles.update();
  // Zera à mão para a contagem incluir também o passe de sombra.
  renderer.info.reset();
  renderer.render(cena, camera);
  quadros++;
  if (quadros % 10 === 2) {
    const r = renderer.info.render;
    info.textContent = `chamadas (com sombra) ${r.calls} | triângulos ${r.triangles} | programas ${renderer.info.programs?.length ?? 0} | texturas ${renderer.info.memory.textures}`;
    info.dataset.chamadas = String(r.calls);
    info.dataset.triangulos = String(r.triangles);
  }
  requestAnimationFrame(quadro);
}
quadro();
