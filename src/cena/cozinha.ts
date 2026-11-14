// Cozinha-escola Chama Azul: cenário completo gerado por código.
//
// Planta (metros, piso em y = 0, sala de 9 x 7 com pé-direito de 3):
//   x de -4,5 (parede da janela) a +4,5 (parede de azulejo celeste)
//   z de -3,5 (parede do fogão, azulejo português) a +3,5 (parede da porta)
// A ilha central fica entre o jogador e o fogão. Geladeira, forno de parede e
// bancada de confeitaria ficam na parede celeste; pia sob a janela.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CenaEstacao, Cozinha, Estacao } from '../tipos';
import { Construtor, M, type Cor } from './construtor';
import { criarMateriais } from './materiais';
import { criarChama, criarVapor, materialCeu, materialJanela } from './efeitos';
import { ATLAS, sorteador } from './texturas';

const LX = 4.5;
const LZ = 3.5;
const PE = 3.0;
const BANC = 0.9;
const PI = Math.PI;

/* Paleta */
const MARINHO = '#213860';
const MARINHO2 = '#284470';
const MARINHO3 = '#2f4e80';
const RODAPE = '#141f33';
const LATAO = '#d0a54e';
const INOX = '#c4cad0';
const COBRE = '#c27a4a';
const FERRO = '#202124';
const PEDRA = '#5d7080';
const CARVALHO = '#a77a4f';
const NOGUEIRA = '#6e4a30';
const LOUCA = '#f1efe9';
const FILETE = '#2b5bab';
const TERRACOTA = '#b2603b';
const FOLHA = ['#4f7d3a', '#3e6c33', '#679a48', '#2f5a2c'];
const GELADEIRA = '#9fcbe2';
const BRANCO = '#f4f3ef';

/* Atalhos de UV para o atlas */
function uvAtlas(geo: THREE.BufferGeometry, reg: readonly [number, number, number, number], u0 = 0, u1 = 1): THREE.BufferGeometry {
  const W = ATLAS.largura;
  const H = ATLAS.altura;
  const [x0, y0, x1, y1] = reg;
  const a0 = x0 / W + (u0 * (x1 - x0)) / W;
  const a1 = x0 / W + (u1 * (x1 - x0)) / W;
  const b0 = 1 - y1 / H;
  const b1 = 1 - y0 / H;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, a0 + uv.getX(i) * (a1 - a0), b0 + uv.getY(i) * (b1 - b0));
  }
  return geo;
}

/* ------------------------------------------------------------------ */
/* Peças de marcenaria (espaço local: frente em z = 0, voltada para +z) */
/* ------------------------------------------------------------------ */

type Frente = { w: number; tipo: 'porta' | 'portas' | 'gavetas' | 'cego'; n?: number };

function puxador(c: Construtor, x: number, y: number, horizontal: boolean, comp = 0.13): void {
  const barra = new THREE.CylinderGeometry(0.0055, 0.0055, comp, 8);
  const pino = new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6);
  if (horizontal) {
    c.add('metal', barra, LATAO, M(x, y, 0.036, 0, 0, PI / 2));
    c.add('metal', pino, LATAO, M(x - comp * 0.4, y, 0.02, PI / 2));
    c.add('metal', pino, LATAO, M(x + comp * 0.4, y, 0.02, PI / 2));
  } else {
    c.add('metal', barra, LATAO, M(x, y, 0.036));
    c.add('metal', pino, LATAO, M(x, y - comp * 0.4, 0.02, PI / 2));
    c.add('metal', pino, LATAO, M(x, y + comp * 0.4, 0.02, PI / 2));
  }
}

/** Porta estilo shaker: painel com moldura saliente. */
function porta(c: Construtor, x0: number, y0: number, w: number, h: number): void {
  c.bloco('fosco', MARINHO2, x0, y0, -0.02, x0 + w, y0 + h, 0);
  const f = Math.min(0.055, w * 0.18);
  const e = 0.009;
  c.bloco('fosco', MARINHO3, x0, y0, 0, x0 + w, y0 + f, e);
  c.bloco('fosco', MARINHO3, x0, y0 + h - f, 0, x0 + w, y0 + h, e);
  c.bloco('fosco', MARINHO3, x0, y0 + f, 0, x0 + f, y0 + h - f, e);
  c.bloco('fosco', MARINHO3, x0 + w - f, y0 + f, 0, x0 + w, y0 + h - f, e);
}

function frentes(c: Construtor, lista: Frente[], y0 = 0.12, y1 = 0.845, alto = false): void {
  let x = 0;
  const folga = 0.004;
  const h = y1 - y0;
  for (const f of lista) {
    if (f.tipo === 'porta') {
      porta(c, x + folga, y0, f.w - 2 * folga, h);
      puxador(c, x + f.w - 0.05, alto ? y0 + 0.08 : y1 - 0.09, false);
    } else if (f.tipo === 'portas') {
      const dw = f.w / 2;
      porta(c, x + folga, y0, dw - 2 * folga, h);
      porta(c, x + dw + folga, y0, dw - 2 * folga, h);
      puxador(c, x + dw - 0.045, alto ? y0 + 0.08 : y1 - 0.09, false);
      puxador(c, x + dw + 0.045, alto ? y0 + 0.08 : y1 - 0.09, false);
    } else if (f.tipo === 'gavetas') {
      const n = f.n ?? 3;
      const alturas = n === 3 ? [0.4, 0.33, 0.27] : Array.from({ length: n }, () => 1 / n);
      let yy = y0;
      for (let k = 0; k < n; k++) {
        const hh = h * alturas[k];
        porta(c, x + folga, yy + folga, f.w - 2 * folga, hh - 2 * folga);
        puxador(c, x + f.w / 2, yy + hh / 2, true, Math.min(0.16, f.w * 0.4));
        yy += hh;
      }
    }
    x += f.w;
  }
}

/** Gabinete inferior: rodapé, corpo e frentes. Espaço local começa em x = 0. */
function armarioBaixo(c: Construtor, L: number, prof: number, lista: Frente[], vao?: [number, number]): void {
  c.bloco('fosco', RODAPE, 0, 0, -prof, L, 0.1, -0.06);
  if (vao) {
    // Corpo rebaixado sob a cuba para ela caber.
    c.bloco('fosco', MARINHO, 0, 0.1, -prof, vao[0], 0.86, -0.02);
    c.bloco('fosco', MARINHO, vao[1], 0.1, -prof, L, 0.86, -0.02);
    c.bloco('fosco', MARINHO, vao[0], 0.1, -prof, vao[1], 0.6, -0.02);
  } else {
    c.bloco('fosco', MARINHO, 0, 0.1, -prof, L, 0.86, -0.02);
  }
  frentes(c, lista);
}

/** Armário superior com luz embutida embaixo. */
function armarioAlto(c: Construtor, L: number, prof: number, h: number, nPortas: number): void {
  c.bloco('fosco', MARINHO, 0, 0, -prof, L, h, -0.02);
  const w = L / nPortas;
  const lista: Frente[] = Array.from({ length: nPortas }, () => ({ w, tipo: 'porta' as const }));
  frentes(c, lista, 0.01, h - 0.01, true);
  // Cornija de madeira e fita de luz quente embaixo.
  c.bloco('fosco', MARINHO3, -0.01, h, -prof, L + 0.01, h + 0.04, 0.02);
  c.bloco('emissivo', [2.4, 1.8, 1.1], 0.03, -0.006, -0.08, L - 0.03, -0.001, -0.06);
}

/* ------------------------------------------------------------------ */
/* Objetos pequenos                                                    */
/* ------------------------------------------------------------------ */

function lathe(pontos: [number, number][], seg = 18): THREE.LatheGeometry {
  return new THREE.LatheGeometry(pontos.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

/** Pote de vidro com conteúdo e tampa. Base em (x, y, z). */
function pote(c: Construtor, x: number, y: number, z: number, r: number, h: number, conteudo: Cor, tampa: Cor): void {
  c.add('vidro', lathe([[0.001, 0], [r, 0], [r, h], [r * 0.85, h + 0.01], [r * 0.85, h + 0.02]], 14), '#dfe9f0', M(x, y, z));
  c.cilindro('fosco', conteudo, x, y + h * 0.36, z, r * 0.9, h * 0.68, 12);
  c.cilindro('metal', tampa, x, y + h + 0.025, z, r * 0.9, 0.022, 14);
}

function garrafa(c: Construtor, x: number, y: number, z: number, h: number, cor: Cor): void {
  c.add('vidro', lathe([[0.001, 0], [0.035, 0], [0.036, h * 0.6], [0.014, h * 0.8], [0.012, h]], 12), cor, M(x, y, z));
  c.cilindro('fosco', NOGUEIRA, x, y + h + 0.012, z, 0.011, 0.025, 8);
}

/** Pilha de pratos brancos com filete azul. */
function pratos(c: Construtor, x: number, y: number, z: number, n: number, r = 0.12): void {
  for (let i = 0; i < n; i++) {
    const yy = y + i * 0.017;
    c.add('brilho', lathe([[0.001, 0], [r * 0.6, 0], [r * 0.65, 0.008], [r, 0.016], [r * 0.6, 0.006], [0.001, 0.007]], 22), LOUCA, M(x, yy, z));
    c.add('brilho', new THREE.TorusGeometry(r * 0.985, 0.0028, 4, 26), FILETE, M(x, yy + 0.0155, z, PI / 2));
  }
}

/** Prato em pé no escorredor (voltado para +z local). */
function pratoEmPe(c: Construtor, m: THREE.Matrix4, r = 0.12): void {
  c.com(m, () => {
    c.add('brilho', lathe([[0.001, 0], [r * 0.6, 0], [r * 0.65, 0.008], [r, 0.016], [r * 0.6, 0.006], [0.001, 0.007]], 22), LOUCA, M(0, r, 0, PI / 2 - 0.12));
    c.add('brilho', new THREE.TorusGeometry(r * 0.985, 0.003, 4, 26), FILETE, M(0, r, 0, -0.12, 0, 0).multiply(M(0, 0, 0.0155)));
  });
}

function tigela(c: Construtor, x: number, y: number, z: number, r: number, cor: Cor, filete = true): void {
  c.add('brilho', lathe([[0.001, 0], [r * 0.5, 0], [r * 0.85, r * 0.35], [r, r * 0.7], [r * 0.96, r * 0.72], [r * 0.8, r * 0.38], [r * 0.45, r * 0.06], [0.001, r * 0.06]], 20), cor, M(x, y, z));
  if (filete) c.add('brilho', new THREE.TorusGeometry(r * 0.99, 0.003, 4, 24), FILETE, M(x, y + r * 0.7, z, PI / 2));
}

/** Tufo de folhas (ervas) sobre um vaso. */
function ervas(c: Construtor, x: number, y: number, z: number, r: number, semente: number): void {
  const s = sorteador(semente);
  for (let i = 0; i < 9; i++) {
    const a = s() * PI * 2;
    const d = s() * r * 0.7;
    c.esfera('fosco', FOLHA[Math.floor(s() * FOLHA.length)], x + Math.cos(a) * d, y + s() * r * 0.9, z + Math.sin(a) * d, r * (0.35 + s() * 0.25), 1, 0.7, 1, 1);
  }
}

function vaso(c: Construtor, x: number, y: number, z: number, r: number, h: number, semente: number, cor: Cor = TERRACOTA): void {
  c.add('fosco', lathe([[0.001, 0], [r * 0.75, 0], [r, h * 0.9], [r * 1.08, h * 0.92], [r * 1.08, h], [r * 0.9, h], [r * 0.9, h * 0.85], [0.001, h * 0.85]], 14), cor, M(x, y, z));
  ervas(c, x, y + h, z, r * 1.5, semente);
}

/** Panela pendurada pelo cabo (disco de frente para +z). */
function panelaPendurada(c: Construtor, x: number, yGancho: number, z: number, r: number): void {
  const cy = yGancho - 0.2 - r;
  c.add('metal', new THREE.CylinderGeometry(r, r * 0.92, 0.05, 22), COBRE, M(x, cy, z + 0.03, PI / 2));
  c.bloco('metal', LATAO, x - 0.012, cy + r * 0.9, z + 0.04, x + 0.012, yGancho - 0.03, z + 0.05);
  c.add('metal', new THREE.TorusGeometry(0.014, 0.003, 4, 10), LATAO, M(x, yGancho - 0.02, z + 0.045));
}

function concha(c: Construtor, x: number, yGancho: number, z: number): void {
  c.bloco('metal', INOX, x - 0.006, yGancho - 0.32, z + 0.04, x + 0.006, yGancho - 0.02, z + 0.048);
  c.add('metal', new THREE.SphereGeometry(0.045, 12, 6, 0, PI * 2, PI / 2, PI / 2), INOX, M(x, yGancho - 0.32, z + 0.06));
}

/* ------------------------------------------------------------------ */
/* Montagem                                                            */
/* ------------------------------------------------------------------ */

export function criarCozinha(): Cozinha {
  const grupo = new THREE.Group();
  grupo.name = 'cozinha';
  const mats = criarMateriais();
  const c = new Construtor();
  const colisores: THREE.Box3[] = [];
  const bloqueio = (x0: number, z0: number, x1: number, z1: number, y1 = PE) =>
    colisores.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, y1, z1)));

  /* ---------------- Casca: piso, teto, paredes ---------------- */
  c.plano('piso', 0, 1, -LX, LX, -LZ, LZ, 0.4);
  c.plano('parede', PE, -1, -LX, LX, -LZ, LZ, 1, '#efece6');
  // Vigas de madeira no teto.
  for (const z of [-2.4, 0.1, 2.4]) c.bloco('fosco', NOGUEIRA, -LX, PE - 0.18, z - 0.07, LX, PE, z + 0.07);

  // Parede do fogão (z = -3,5): azulejo português da bancada até 2,3 m.
  const ZF = -LZ;
  c.paredeZ('azulejoPt', ZF, 1, -LX, LX, BANC, 2.3, 0.15);
  c.paredeZ('parede', ZF, 1, -LX, LX, 0, BANC, 1, '#e8e4dc');
  c.paredeZ('parede', ZF, 1, -LX, LX, 2.3, PE, 1, '#e8e4dc');
  c.bloco('fosco', CARVALHO, -LX, 2.3, ZF, LX, 2.33, ZF + 0.025);

  // Parede da janela (x = -4,5) com vão de z -1,6 a 0,6 e y 1,1 a 2,55.
  const XJ = -LX;
  const J = { z0: -1.6, z1: 0.6, y0: 1.1, y1: 2.55 };
  c.paredeX('parede', XJ, 1, -LZ, LZ, 0, BANC, 1, '#e8e4dc');
  c.paredeX('azulejoPt', XJ, 1, -LZ, 1.22, BANC, J.y0, 0.15);
  c.paredeX('azulejoPt', XJ, 1, -LZ, J.z0, J.y0, 2.3, 0.15);
  c.paredeX('azulejoPt', XJ, 1, J.z1, 1.22, J.y0, 2.3, 0.15);
  c.paredeX('parede', XJ, 1, 1.22, LZ, BANC, PE, 1, '#e8e4dc');
  c.paredeX('parede', XJ, 1, -LZ, J.z0, 2.3, PE, 1, '#e8e4dc');
  c.paredeX('parede', XJ, 1, J.z1, 1.22, 2.3, PE, 1, '#e8e4dc');
  c.paredeX('parede', XJ, 1, J.z0, J.z1, J.y1, PE, 1, '#e8e4dc');
  c.bloco('fosco', CARVALHO, XJ, 2.3, -LZ, XJ + 0.025, 2.33, J.z0);
  c.bloco('fosco', CARVALHO, XJ, 2.3, J.z1, XJ + 0.025, 2.33, 1.22);
  // Vão da janela (espessura da parede) com peitoril.
  const XV = XJ - 0.22;
  c.paredeZ('parede', J.z0, 1, XV, XJ, J.y0, J.y1, 1, '#eeebe5');
  c.paredeZ('parede', J.z1, -1, XV, XJ, J.y0, J.y1, 1, '#eeebe5');
  c.plano('parede', J.y1, -1, XV, XJ, J.z0, J.z1, 1, '#eeebe5');
  c.bloco('fosco', BRANCO, XV, J.y0 - 0.03, J.z0 - 0.02, XJ + 0.02, J.y0, J.z1 + 0.02);
  // Caixilho branco: moldura, montante central e bandeira.
  const XC = XJ - 0.16;
  c.bloco('fosco', BRANCO, XC - 0.03, J.y0, J.z0, XC + 0.03, J.y0 + 0.05, J.z1);
  c.bloco('fosco', BRANCO, XC - 0.03, J.y1 - 0.05, J.z0, XC + 0.03, J.y1, J.z1);
  c.bloco('fosco', BRANCO, XC - 0.03, J.y0, J.z0, XC + 0.03, J.y1, J.z0 + 0.05);
  c.bloco('fosco', BRANCO, XC - 0.03, J.y0, J.z1 - 0.05, XC + 0.03, J.y1, J.z1);
  c.bloco('fosco', BRANCO, XC - 0.03, J.y0, -0.53, XC + 0.03, J.y1, -0.47);
  c.bloco('fosco', BRANCO, XC - 0.03, 2.13, J.z0, XC + 0.03, 2.18, J.z1);
  // Ervas em vasos no peitoril.
  vaso(c, XJ - 0.08, J.y0, -1.25, 0.05, 0.09, 1);
  vaso(c, XJ - 0.08, J.y0, -0.8, 0.045, 0.08, 2);
  vaso(c, XJ - 0.08, J.y0, -0.18, 0.05, 0.09, 3, '#d8d4ca');
  vaso(c, XJ - 0.08, J.y0, 0.3, 0.04, 0.075, 4);

  // Parede celeste (x = +4,5).
  c.paredeX('celeste', LX, -1, -LZ, LZ, 0, 2.3, 0.6);
  c.paredeX('parede', LX, -1, -LZ, LZ, 2.3, PE, 1, '#e8e4dc');
  c.bloco('fosco', CARVALHO, LX - 0.025, 2.3, -LZ, LX, 2.33, LZ);

  // Parede da porta (z = +3,5): lambri de madeira e reboco azul bem claro.
  c.paredeZ('parede', LZ, -1, -LX, LX, 1.0, PE, 1, '#d5e1ea');
  c.paredeZ('parede', LZ, -1, -LX, LX, 0, 1.0, 1, '#a9bfd0');
  for (let x = -LX + 0.05; x < LX - 0.3; x += 0.45) {
    c.bloco('fosco', '#9fb6c8', x + 0.04, 0.12, LZ - 0.012, x + 0.41, 0.9, LZ - 0.002);
  }
  c.bloco('fosco', BRANCO, -LX, 0.98, LZ - 0.03, LX, 1.02, LZ);

  // Rodapé de madeira nas paredes visíveis.
  c.bloco('fosco', NOGUEIRA, -LX, 0, LZ - 0.015, LX, 0.1, LZ);
  c.bloco('fosco', NOGUEIRA, LX - 0.015, 0, -LZ, LX, 0.1, LZ);
  c.bloco('fosco', NOGUEIRA, -LX, 0, -LZ, -LX + 0.015, 0.1, LZ);

  /* ---------------- Porta de entrada ---------------- */
  {
    const x0 = -3.45;
    const x1 = -2.55;
    c.bloco('fosco', BRANCO, x0 - 0.07, 0, LZ - 0.03, x1 + 0.07, 2.17, LZ);
    c.bloco('fosco', '#7a5436', x0, 0, LZ - 0.045, x1, 2.1, LZ - 0.03);
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 3; j++) {
        const px = x0 + 0.1 + i * 0.37;
        const py = 0.15 + j * 0.65;
        c.bloco('fosco', '#86603f', px, py, LZ - 0.055, px + 0.33, py + 0.55, LZ - 0.045);
      }
    }
    c.esfera('metal', LATAO, x0 + 0.08, 1.0, LZ - 0.07, 0.028);
    c.cilindro('metal', LATAO, x0 + 0.08, 1.0, LZ - 0.055, 0.03, 0.01);
    // Ganchos com aventais azuis ao lado da porta.
    c.bloco('fosco', CARVALHO, -2.35, 1.62, LZ - 0.03, -1.55, 1.7, LZ);
    for (const [ax, cor] of [[-2.15, '#2f5c9a'], [-1.78, '#7fb0d6']] as const) {
      c.cilindro('metal', LATAO, ax, 1.66, LZ - 0.05, 0.008, 0.04);
      c.add('fosco', new THREE.BoxGeometry(0.3, 0.62, 0.012), cor, M(ax, 1.26, LZ - 0.05));
      c.add('fosco', new THREE.BoxGeometry(0.17, 0.2, 0.014), cor, M(ax, 1.64, LZ - 0.052));
      c.add('fosco', new THREE.BoxGeometry(0.17, 0.12, 0.016), BRANCO, M(ax, 1.15, LZ - 0.06));
    }
  }

  /* ---------------- Bancada do fundo (fogão) ---------------- */
  const ZFR = -2.86; // frente dos armários do fundo
  const XFIM = 3.0;
  c.com(M(-LX, 0, ZFR), () => {
    armarioBaixo(c, XFIM + LX, 0.62, [
      { w: 0.64, tipo: 'cego' },
      { w: 0.8, tipo: 'portas' },
      { w: 0.6, tipo: 'gavetas', n: 3 },
      { w: 0.9, tipo: 'portas' },
      { w: 0.6, tipo: 'porta' },
      { w: 0.56, tipo: 'porta' },
      { w: 0.8, tipo: 'gavetas', n: 2 },
      { w: 0.8, tipo: 'portas' },
      { w: 0.6, tipo: 'gavetas', n: 3 },
      { w: 0.8, tipo: 'portas' },
      { w: 0.4, tipo: 'porta' },
    ]);
  });
  c.bloco('brilho', PEDRA, -LX, 0.86, -LZ, XFIM + 0.02, BANC, ZFR + 0.025);
  c.bloco('fosco', MARINHO, XFIM, 0.1, -LZ, XFIM + 0.02, 0.86, ZFR);
  bloqueio(-LX, -LZ, XFIM + 0.03, ZFR + 0.03);

  // Armários superiores e prateleiras abertas.
  c.com(M(-LX, 1.5, -3.15), () => armarioAlto(c, 1.9, 0.35, 0.75, 3));
  c.com(M(1.7, 1.5, -3.15), () => armarioAlto(c, XFIM - 1.7, 0.35, 0.75, 2));
  for (const y of [1.45, 1.85, 2.22]) {
    c.bloco('fosco', CARVALHO, -2.5, y - 0.035, -LZ, -0.55, y, -3.22);
    for (const x of [-2.35, -0.7]) {
      c.bloco('metal', LATAO, x - 0.008, y - 0.12, -LZ, x + 0.008, y - 0.035, -3.42);
      c.add('metal', new THREE.BoxGeometry(0.016, 0.012, 0.13), LATAO, M(x, y - 0.08, -3.43, PI / 4));
    }
  }
  // Prateleira 1: potes de mantimentos.
  {
    const cont: Cor[] = ['#7a4a2a', '#f2ede0', '#e2b54a', '#d0692f', '#5c3a26', '#c9a26a'];
    cont.forEach((cc, i) => pote(c, -2.38 + i * 0.3, 1.45, -3.35, 0.055 + (i % 2) * 0.01, 0.15 + (i % 3) * 0.03, cc, i % 2 ? LATAO : INOX));
  }
  // Prateleira 2: louça.
  pratos(c, -2.25, 1.85, -3.36, 9);
  pratos(c, -1.95, 1.85, -3.36, 6, 0.1);
  for (let i = 0; i < 3; i++) tigela(c, -1.6, 1.85 + i * 0.045, -3.35, 0.085 - i * 0.004, LOUCA);
  {
    // Bule azul.
    c.esfera('brilho', '#3b6fb6', -1.2, 1.94, -3.36, 0.085, 1, 0.82, 1, 2);
    c.add('brilho', new THREE.CylinderGeometry(0.012, 0.02, 0.1, 8), '#3b6fb6', M(-1.1, 1.96, -3.36, 0, 0, -0.9));
    c.add('brilho', new THREE.TorusGeometry(0.045, 0.01, 6, 12, PI), '#3b6fb6', M(-1.3, 1.95, -3.36, 0, 0, PI / 2));
    c.esfera('brilho', '#3b6fb6', -1.2, 2.02, -3.36, 0.018);
    for (let i = 0; i < 3; i++) {
      const x = -0.95 + i * 0.12;
      c.add('brilho', lathe([[0.001, 0], [0.03, 0], [0.04, 0.07], [0.036, 0.07], [0.026, 0.006], [0.001, 0.006]], 14), i === 1 ? '#7fb0d6' : LOUCA, M(x, 1.85, -3.36));
    }
  }
  // Prateleira 3: garrafas, cesto e planta pendente.
  {
    const cores: Cor[] = ['#5f8fd0', '#7fb48a', '#3d6cb8', '#9fc7e6'];
    cores.forEach((cc, i) => garrafa(c, -2.4 + i * 0.11, 2.22, -3.36, 0.2 + (i % 2) * 0.05, cc));
    c.add('fosco', lathe([[0.001, 0], [0.12, 0], [0.13, 0.11], [0.125, 0.11], [0.001, 0.01]], 12), '#b48a55', M(-1.6, 2.22, -3.36));
    vaso(c, -0.85, 2.22, -3.36, 0.06, 0.1, 9, '#e9e6de');
    const s = sorteador(5);
    for (let i = 0; i < 10; i++) {
      c.esfera('fosco', FOLHA[i % 4], -0.85 + (s() - 0.5) * 0.18, 2.2 - i * 0.04, -3.3 + s() * 0.05, 0.03, 1, 0.6, 1, 0);
    }
  }

  // Barra de panelas à direita da coifa.
  {
    const y = 1.62;
    c.add('metal', new THREE.CylinderGeometry(0.008, 0.008, 1.05, 10), LATAO, M(1.1, y, -3.42, 0, 0, PI / 2));
    for (const x of [0.6, 1.6]) c.add('metal', new THREE.CylinderGeometry(0.006, 0.006, 0.08, 6), LATAO, M(x, y, -3.46, PI / 2));
    panelaPendurada(c, 0.72, y, -3.44, 0.11);
    panelaPendurada(c, 1.02, y, -3.44, 0.085);
    concha(c, 1.25, y, -3.44);
    panelaPendurada(c, 1.45, y, -3.44, 0.07);
  }

  // Relógio de parede sobre as prateleiras.
  const relogioCentro = new THREE.Vector3(-1.5, 2.62, -3.47);
  c.add('atlas', uvAtlas(new THREE.CircleGeometry(0.15, 32), ATLAS.relogio, 0.04, 0.96), 0xffffff, M(relogioCentro.x, relogioCentro.y, relogioCentro.z));
  c.add('fosco', new THREE.TorusGeometry(0.155, 0.014, 8, 32), MARINHO, M(relogioCentro.x, relogioCentro.y, relogioCentro.z));

  /* ---------------- Fogão de 4 bocas ---------------- */
  const bocas = [
    new THREE.Vector3(-0.17, 0, -3.04),
    new THREE.Vector3(0.17, 0, -3.04),
    new THREE.Vector3(-0.17, 0, -3.3),
    new THREE.Vector3(0.17, 0, -3.3),
  ];
  const bocaAtiva = bocas[0];
  const YQ = BANC + 0.035; // topo do queimador
  const YG = BANC + 0.068; // topo da grelha
  {
    c.bloco('metal', INOX, -0.39, BANC, -3.44, 0.39, BANC + 0.02, -2.88);
    c.bloco('fosco', '#15171b', -0.37, BANC + 0.02, -3.42, 0.37, BANC + 0.022, -2.9);
    for (const b of bocas) {
      const r = b === bocaAtiva ? 0.052 : 0.045;
      c.cilindro('metal', '#8b9096', b.x, BANC + 0.026, b.z, r + 0.018, 0.008, 20);
      c.cilindro('fosco', '#2b2c30', b.x, BANC + 0.03, b.z, r, 0.012, 20);
      c.cilindro('fosco', '#0e0f12', b.x, YQ - 0.002, b.z, r * 0.68, 0.006, 18);
    }
    // Grelhas de ferro fundido (uma para cada par de bocas).
    for (const gx of [-0.17, 0.17]) {
      const z0 = -3.42;
      const z1 = -2.91;
      const x0 = gx - 0.17;
      const x1 = gx + 0.17;
      const e = 0.011;
      const yb = YG - 0.012;
      c.bloco('fosco', FERRO, x0, yb, z0, x1, YG, z0 + e);
      c.bloco('fosco', FERRO, x0, yb, z1 - e, x1, YG, z1);
      c.bloco('fosco', FERRO, x0, yb, z0, x0 + e, YG, z1);
      c.bloco('fosco', FERRO, x1 - e, yb, z0, x1, YG, z1);
      for (const zc of [-3.04, -3.3]) {
        c.bloco('fosco', FERRO, x0, yb, zc - e / 2, x1, YG, zc + e / 2);
        c.bloco('fosco', FERRO, gx - e / 2, yb, zc - 0.12, gx + e / 2, YG, zc + 0.12);
        for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) c.bloco('fosco', FERRO, px - 0.008, BANC + 0.02, pz - 0.008, px + 0.008, yb, pz + 0.008);
      }
    }
    // Botões na faixa frontal.
    for (let i = 0; i < 4; i++) {
      const x = -0.27 + i * 0.18;
      c.add('fosco', new THREE.CylinderGeometry(0.022, 0.024, 0.025, 16), '#1a1b1e', M(x, 0.8, ZFR + 0.03, PI / 2));
      c.add('metal', new THREE.BoxGeometry(0.006, 0.03, 0.006), INOX, M(x, 0.8, ZFR + 0.045));
    }
    c.bloco('metal', INOX, -0.4, 0.765, ZFR, 0.4, 0.835, ZFR + 0.012);

    // Panela azul com tampa na boca de trás à direita (de onde sai o vapor).
    const p = bocas[3];
    c.add('brilho', lathe([[0.001, 0], [0.1, 0], [0.105, 0.13], [0.11, 0.135], [0.1, 0.135], [0.095, 0.01], [0.001, 0.01]], 24), '#2f62a8', M(p.x, YG, p.z));
    c.add('brilho', lathe([[0.108, 0], [0.1, 0.004], [0.04, 0.025], [0.001, 0.03]], 24), '#2f62a8', M(p.x, YG + 0.135, p.z, 0.04, 0, 0));
    c.esfera('fosco', NOGUEIRA, p.x, YG + 0.17, p.z, 0.016);
    for (const sx of [-1, 1]) c.add('brilho', new THREE.TorusGeometry(0.025, 0.007, 6, 10, PI), '#2f62a8', M(p.x + sx * 0.11, YG + 0.11, p.z, 0, 0, sx > 0 ? -PI / 2 : PI / 2));
    // Chaleira esmaltada na boca de trás à esquerda.
    const k = bocas[2];
    c.add('brilho', lathe([[0.001, 0], [0.085, 0], [0.095, 0.06], [0.07, 0.14], [0.03, 0.165], [0.001, 0.17]], 22), '#e9f1f7', M(k.x, YG, k.z));
    c.add('brilho', new THREE.CylinderGeometry(0.008, 0.016, 0.12, 8), '#e9f1f7', M(k.x + 0.11, YG + 0.1, k.z, 0, 0, -0.9));
    c.add('fosco', new THREE.TorusGeometry(0.06, 0.008, 6, 14, PI), NOGUEIRA, M(k.x, YG + 0.17, k.z));
    c.add('brilho', new THREE.TorusGeometry(0.093, 0.004, 4, 22), FILETE, M(k.x, YG + 0.05, k.z, PI / 2));
  }
  // Coifa de inox.
  {
    c.bloco('metal', INOX, -0.42, 1.62, -LZ, 0.42, 1.7, -2.98);
    const tronco = new THREE.CylinderGeometry(0.36 * Math.SQRT1_2, Math.SQRT1_2, 0.28, 4, 1);
    tronco.rotateY(PI / 4);
    c.add('metal', tronco, INOX, M(0, 1.84, -3.24, 0, 0, 0, 0.84, 1, 0.52));
    c.bloco('metal', INOX, -0.15, 1.97, -LZ, 0.15, PE, -3.15);
    c.bloco('fosco', '#3a3d42', -0.38, 1.618, -3.46, 0.38, 1.622, -3.02);
    c.bloco('emissivo', [2.6, 2.1, 1.5], -0.25, 1.614, -3.2, -0.15, 1.618, -3.15);
    c.bloco('emissivo', [2.6, 2.1, 1.5], 0.15, 1.614, -3.2, 0.25, 1.618, -3.15);
  }

  // Objetos da bancada do fundo.
  {
    // Latas de mantimento brancas com faixa azul no canto.
    [[0.075, 0.2], [0.065, 0.16], [0.055, 0.12]].forEach(([r, h], i) => {
      const x = -4.25 + i * 0.17;
      const z = -3.3 + i * 0.03;
      c.cilindro('brilho', BRANCO, x, BANC + h / 2, z, r, h, 18);
      c.cilindro('brilho', FILETE, x, BANC + h * 0.55, z, r + 0.001, h * 0.18, 18);
      c.cilindro('metal', INOX, x, BANC + h + 0.008, z, r * 1.02, 0.016, 18);
    });
    // Porta-utensílios com colheres de pau ao lado do fogão.
    c.add('brilho', lathe([[0.001, 0], [0.06, 0], [0.065, 0.16], [0.06, 0.16], [0.001, 0.01]], 14), '#2f62a8', M(0.62, BANC, -3.3));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      c.add('fosco', new THREE.CylinderGeometry(0.007, 0.007, 0.32, 6), CARVALHO, M(0.62 + Math.cos(a) * 0.02, BANC + 0.2, -3.3 + Math.sin(a) * 0.02, Math.sin(a) * 0.15, 0, Math.cos(a) * 0.15));
      c.esfera('fosco', CARVALHO, 0.62 + Math.cos(a) * 0.045, BANC + 0.36, -3.3 + Math.sin(a) * 0.045, 0.022, 1, 1.4, 0.5, 0);
    }
    // Azeite e sal do lado esquerdo do fogão.
    garrafa(c, -0.55, BANC, -3.3, 0.24, '#b7b84e');
    c.add('brilho', lathe([[0.001, 0], [0.05, 0], [0.055, 0.06], [0.045, 0.1], [0.001, 0.11]], 14), LOUCA, M(-0.7, BANC, -3.32));
    // Tábua de pão encostada no azulejo.
    c.add('fosco', new THREE.BoxGeometry(0.38, 0.5, 0.025), CARVALHO, M(-1.3, BANC + 0.25, -3.44, -0.12));
    c.add('fosco', new THREE.BoxGeometry(0.28, 0.4, 0.02), NOGUEIRA, M(-1.65, BANC + 0.2, -3.44, -0.1));
  }

  /* ---------------- Balança no canto da bancada ---------------- */
  const balanca = new THREE.Vector3(-3.0, 0, -3.15);
  {
    const b = balanca;
    c.add('brilho', new RoundedBoxGeometry(0.2, 0.12, 0.2, 2, 0.025), '#8fc3df', M(b.x, BANC + 0.06, b.z));
    c.add('atlas', uvAtlas(new THREE.CircleGeometry(0.05, 28), ATLAS.balanca, 0.05, 0.95), 0xffffff, M(b.x, BANC + 0.06, b.z + 0.1015));
    c.add('metal', new THREE.TorusGeometry(0.052, 0.005, 6, 28), INOX, M(b.x, BANC + 0.06, b.z + 0.101));
    c.cilindro('metal', INOX, b.x, BANC + 0.125, b.z, 0.012, 0.01, 10);
    c.add('metal', lathe([[0.001, 0], [0.11, 0], [0.12, 0.012], [0.115, 0.014], [0.001, 0.004]], 28), INOX, M(b.x, BANC + 0.13, b.z));
  }
  const YBAL = BANC + 0.134;

  /* ---------------- Livro de receitas num suporte ---------------- */
  {
    const x = 2.3;
    const z = -3.32;
    c.com(M(x, BANC, z, -0.35), () => {
      c.bloco('fosco', NOGUEIRA, -0.22, 0, -0.03, 0.22, 0.3, -0.01);
      c.bloco('fosco', NOGUEIRA, -0.22, 0.0, -0.01, 0.22, 0.03, 0.05);
      c.bloco('fosco', '#7a2f22', -0.21, 0.03, -0.01, 0.21, 0.27, 0.0);
      c.add('atlas', uvAtlas(new THREE.PlaneGeometry(0.2, 0.235), ATLAS.receita, 0, 0.5), 0xffffff, M(-0.1, 0.152, 0.008, 0, 0.1));
      c.add('atlas', uvAtlas(new THREE.PlaneGeometry(0.2, 0.235), ATLAS.receita, 0.5, 1), 0xffffff, M(0.1, 0.152, 0.008, 0, -0.1));
    });
  }

  /* ---------------- Bancada da pia (sob a janela) ---------------- */
  const XPF = -3.86; // frente
  c.com(M(XPF, 0, 1.22, 0, PI / 2, 0), () => {
    armarioBaixo(c, 1.22 - ZFR, 0.62, [
      { w: 0.6, tipo: 'gavetas', n: 3 },
      { w: 0.7, tipo: 'portas' },
      { w: 0.8, tipo: 'portas' },
      { w: 0.9, tipo: 'portas' },
      { w: 0.5, tipo: 'gavetas', n: 2 },
      { w: 0.56, tipo: 'porta' },
    ], [1.37, 2.07]);
  });
  const CUBA = { x0: -4.32, x1: -3.95, z0: -0.82, z1: -0.18, fundo: 0.68 };
  {
    const F = XPF + 0.025;
    c.bloco('brilho', PEDRA, -LX, 0.86, ZFR + 0.025, F, BANC, CUBA.z0);
    c.bloco('brilho', PEDRA, -LX, 0.86, CUBA.z1, F, BANC, 1.24);
    c.bloco('brilho', PEDRA, -LX, 0.86, CUBA.z0, CUBA.x0, BANC, CUBA.z1);
    c.bloco('brilho', PEDRA, CUBA.x1, 0.86, CUBA.z0, F, BANC, CUBA.z1);
    c.bloco('fosco', MARINHO, -LX, 0.1, 1.22, F, 0.86, 1.24);
    // Cuba de inox.
    const { x0, x1, z0, z1, fundo } = CUBA;
    c.plano('metal', fundo, 1, x0, x1, z0, z1, 1, INOX);
    c.paredeX('metal', x0, 1, z0, z1, fundo, BANC, 1, INOX);
    c.paredeX('metal', x1, -1, z0, z1, fundo, BANC, 1, INOX);
    c.paredeZ('metal', z0, 1, x0, x1, fundo, BANC, 1, INOX);
    c.paredeZ('metal', z1, -1, x0, x1, fundo, BANC, 1, INOX);
    c.add('metal', new THREE.TorusGeometry(0.035, 0.006, 6, 18), '#9aa0a6', M((x0 + x1) / 2, fundo + 0.003, (z0 + z1) / 2, PI / 2));
    c.cilindro('fosco', '#2a2c30', (x0 + x1) / 2, fundo + 0.002, (z0 + z1) / 2, 0.03, 0.002, 14);
    // Torneira bica alta.
    const zt = (z0 + z1) / 2;
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.41, BANC, zt),
      new THREE.Vector3(-4.41, BANC + 0.25, zt),
      new THREE.Vector3(-4.38, BANC + 0.36, zt),
      new THREE.Vector3(-4.28, BANC + 0.37, zt),
      new THREE.Vector3(-4.2, BANC + 0.3, zt),
      new THREE.Vector3(-4.19, BANC + 0.24, zt),
    ]);
    c.add('metal', new THREE.TubeGeometry(curva, 28, 0.012, 10), INOX);
    c.cilindro('metal', INOX, -4.41, BANC + 0.02, zt, 0.025, 0.04, 16);
    c.add('metal', new THREE.CylinderGeometry(0.007, 0.007, 0.09, 8), INOX, M(-4.41, BANC + 0.1, zt + 0.05, PI / 2 - 0.4));
    // Sabão, esponja e escorredor com pratos.
    c.add('brilho', lathe([[0.001, 0], [0.03, 0], [0.032, 0.12], [0.012, 0.14], [0.001, 0.15]], 12), '#5d8fc9', M(-4.38, BANC, -1.0));
    c.add('fosco', new RoundedBoxGeometry(0.09, 0.03, 0.06, 1, 0.008), '#f2c94c', M(-4.25, BANC + 0.015, -1.02));
    c.bloco('metal', INOX, -4.45, BANC, 0.05, -4.0, BANC + 0.012, 0.6);
    for (let i = 0; i < 5; i++) pratoEmPe(c, M(-4.22, BANC + 0.012, 0.12 + i * 0.09, 0, 0, 0), 0.11);
    for (let i = 0; i < 6; i++) c.bloco('metal', INOX, -4.44, BANC + 0.012, 0.08 + i * 0.09, -4.0, BANC + 0.07, 0.085 + i * 0.09);
  }
  bloqueio(-LX, ZFR, XPF + 0.03, 1.24);

  /* ---------------- Ilha central com tábua ---------------- */
  const ILHA = { x0: -1.12, x1: 1.12, z0: -1.78, z1: -0.84 };
  const ilhaZ = (ILHA.z0 + ILHA.z1) / 2;
  {
    c.com(M(-1.07, 0, -0.89), () => {
      c.bloco('fosco', RODAPE, 0, 0, -0.8, 2.14, 0.1, -0.06);
      c.bloco('fosco', MARINHO, 0, 0.1, -0.84, 2.14, 0.86, -0.02);
      frentes(c, [
        { w: 0.7, tipo: 'portas' },
        { w: 0.74, tipo: 'gavetas', n: 3 },
        { w: 0.7, tipo: 'portas' },
      ]);
    });
    c.com(M(1.07, 0, -1.73, 0, PI, 0), () => {
      frentes(c, [
        { w: 0.535, tipo: 'porta' },
        { w: 0.535, tipo: 'porta' },
        { w: 0.535, tipo: 'porta' },
        { w: 0.535, tipo: 'porta' },
      ]);
    });
    c.bloco('brilho', PEDRA, ILHA.x0, 0.86, ILHA.z0, ILHA.x1, BANC, ILHA.z1);
    // Tábua grande de madeira.
    c.add('atlas', uvAtlas(new RoundedBoxGeometry(0.8, 0.032, 0.5, 2, 0.01), ATLAS.madeira), 0xffffff, M(0, BANC + 0.016, ilhaZ));
    // Cepo de facas.
    c.com(M(-0.92, BANC, ilhaZ - 0.2, 0, 0.3), () => {
      c.add('fosco', new THREE.BoxGeometry(0.11, 0.2, 0.15), NOGUEIRA, M(0, 0.1, 0, -0.35));
      for (let i = 0; i < 4; i++) c.add('fosco', new THREE.BoxGeometry(0.018, 0.1, 0.026), '#151515', M(-0.033 + i * 0.022, 0.24, -0.04 + (i % 2) * 0.03, -0.35));
    });
    // Fruteira com laranjas e limões.
    tigela(c, 0.88, BANC, ilhaZ - 0.18, 0.13, LOUCA);
    {
      const s = sorteador(12);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2;
        const d = i === 6 ? 0 : 0.06;
        c.esfera('fosco', i % 3 ? '#e8892e' : '#e9d44a', 0.88 + Math.cos(a) * d, BANC + 0.07 + (i === 6 ? 0.05 : s() * 0.01), ilhaZ - 0.18 + Math.sin(a) * d, 0.035, 1, 0.95, 1, 2);
      }
    }
    // Saleiro e garrafa de azeite.
    c.add('brilho', lathe([[0.001, 0], [0.04, 0], [0.045, 0.06], [0.03, 0.09], [0.001, 0.095]], 14), '#2f62a8', M(0.95, BANC, ilhaZ + 0.22));
    garrafa(c, 0.8, BANC, ilhaZ + 0.26, 0.22, '#c1c065');
  }
  bloqueio(ILHA.x0, ILHA.z0, ILHA.x1, ILHA.z1);

  /* ---------------- Tapete azul ---------------- */
  {
    const y = 0.004;
    c.bloco('fosco', '#24467a', -1.35, 0, -0.7, 1.35, y, 1.15);
    c.bloco('fosco', '#e9e2cf', -1.27, y, -0.62, 1.27, y + 0.001, 1.07);
    c.bloco('fosco', '#3c6aa8', -1.22, y + 0.001, -0.57, 1.22, y + 0.002, 1.02);
    c.bloco('fosco', '#88b6dc', -0.9, y + 0.002, -0.3, 0.9, y + 0.003, 0.75);
    c.bloco('fosco', '#2f5c96', -0.85, y + 0.003, -0.25, 0.85, y + 0.004, 0.7);
    for (let i = 0; i < 7; i++) {
      const x = -0.75 + i * 0.25;
      c.add('fosco', new THREE.BoxGeometry(0.09, 0.0012, 0.09), '#e9e2cf', M(x, y + 0.0045, 0.225, 0, PI / 4));
    }
  }

  /* ---------------- Parede celeste: geladeira, forno, confeitaria ---------------- */
  // As portas da geladeira e do forno ficam fechadas e abrem quando o passo pede.
  const cPortaGel = new Construtor();
  const cPortaForno = new Construtor();
  const pivoGel = new THREE.Vector3();
  const pivoForno = new THREE.Vector3();
  const XD = 3.86; // frente dos móveis da parede celeste
  // Geladeira retrô.
  const GEL = { x0: 3.76, x1: 4.46, z0: -3.44, z1: -2.74 };
  const gelZ = (GEL.z0 + GEL.z1) / 2;
  const prateleiraY = 1.0;
  {
    const { x0, x1, z0, z1 } = GEL;
    for (const [px, pz] of [[x0 + 0.06, z0 + 0.06], [x0 + 0.06, z1 - 0.06], [x1 - 0.06, z0 + 0.06], [x1 - 0.06, z1 - 0.06]]) c.cilindro('metal', INOX, px, 0.03, pz, 0.018, 0.06, 10);
    c.bloco('brilho', GELADEIRA, x0, 0.06, z0, x1, 0.2, z1);
    c.bloco('brilho', GELADEIRA, x1 - 0.05, 0.2, z0, x1, 1.6, z1);
    c.bloco('brilho', GELADEIRA, x0, 0.2, z0, x1, 1.6, z0 + 0.045);
    c.bloco('brilho', GELADEIRA, x0, 0.2, z1 - 0.045, x1, 1.6, z1);
    c.add('brilho', new RoundedBoxGeometry(x1 - x0, 0.22, z1 - z0, 3, 0.07), GELADEIRA, M((x0 + x1) / 2, 1.62, (z0 + z1) / 2));
    c.bloco('metal', INOX, x0 - 0.005, 0.12, z0 + 0.04, x0, 0.16, z1 - 0.04);
    // Forro interno branco.
    const xi0 = x0 + 0.005;
    const xi1 = x1 - 0.05;
    const zi0 = z0 + 0.045;
    const zi1 = z1 - 0.045;
    c.paredeX('brilho', xi1 - 0.001, -1, zi0, zi1, 0.2, 1.51, 1, BRANCO);
    c.paredeZ('brilho', zi0 + 0.001, 1, xi0, xi1, 0.2, 1.51, 1, BRANCO);
    c.paredeZ('brilho', zi1 - 0.001, -1, xi0, xi1, 0.2, 1.51, 1, BRANCO);
    c.plano('brilho', 0.201, 1, xi0, xi1, zi0, zi1, 1, BRANCO);
    c.plano('brilho', 1.509, -1, xi0, xi1, zi0, zi1, 1, BRANCO);
    // Congelador no alto.
    c.bloco('brilho', '#dfe8ee', xi0 + 0.22, 1.4, zi0, xi1, 1.5, zi1);
    c.bloco('metal', INOX, xi0 + 0.21, 1.43, gelZ - 0.08, xi0 + 0.22, 1.445, gelZ + 0.08);
    c.bloco('emissivo', [2.2, 2.3, 2.4], xi0 + 0.05, 1.502, gelZ - 0.05, xi0 + 0.12, 1.507, gelZ + 0.05);
    // Prateleira de vidro embaixo e prateleira de trabalho branca.
    c.bloco('vidro', '#dff1fa', xi0 + 0.02, 0.55, zi0, xi1, 0.558, zi1);
    c.bloco('brilho', BRANCO, xi0 + 0.01, 0.544, zi0, xi0 + 0.025, 0.562, zi1);
    c.bloco('brilho', '#eef3f6', xi0 + 0.01, prateleiraY - 0.012, zi0, xi1, prateleiraY, zi1);
    c.bloco('brilho', '#cfdde6', xi0 + 0.005, prateleiraY - 0.02, zi0, xi0 + 0.02, prateleiraY + 0.006, zi1);
    // Gavetas de legumes.
    c.bloco('vidro', '#cfe7f3', xi0 + 0.02, 0.21, zi0 + 0.01, xi1 - 0.02, 0.43, gelZ - 0.01);
    c.bloco('vidro', '#cfe7f3', xi0 + 0.02, 0.21, gelZ + 0.01, xi1 - 0.02, 0.43, zi1 - 0.01);
    {
      const s = sorteador(33);
      for (let i = 0; i < 6; i++) c.esfera('fosco', i % 2 ? '#5f9a3f' : '#d9632f', xi0 + 0.1 + s() * 0.25, 0.26, zi0 + 0.05 + s() * 0.5, 0.04, 1, 0.9, 1, 1);
    }
    // Itens na prateleira de baixo.
    c.add('vidro', lathe([[0.001, 0], [0.04, 0], [0.04, 0.16], [0.02, 0.2], [0.02, 0.23]], 12), '#f4f6f8', M(xi0 + 0.25, 0.558, zi0 + 0.1));
    c.cilindro('brilho', BRANCO, xi0 + 0.25, 0.64, zi0 + 0.1, 0.036, 0.15, 12);
    c.cilindro('metal', '#3a74c0', xi0 + 0.25, 0.795, zi0 + 0.1, 0.022, 0.02, 10);
    pote(c, xi0 + 0.3, 0.558, zi0 + 0.3, 0.045, 0.09, '#b23a48', '#d8c06a');
    c.bloco('brilho', '#f6e7a8', xi0 + 0.15, 0.558, zi1 - 0.2, xi0 + 0.3, 0.6, zi1 - 0.08);
    // Caixa de ovos no fundo da prateleira de trabalho (o meio fica livre).
    c.bloco('fosco', '#cdb894', xi1 - 0.14, prateleiraY, zi0 + 0.02, xi1 - 0.02, prateleiraY + 0.045, zi0 + 0.25);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.esfera('brilho', '#f3e6d0', xi1 - 0.11 + j * 0.06, prateleiraY + 0.06, zi0 + 0.06 + i * 0.075, 0.022, 0.9, 1.2, 0.9, 1);

    // Porta (dobradiça junto à parede do fundo): construída à parte para abrir e fechar.
    pivoGel.set(x0, 0, z0);
    {
      const c = cPortaGel;
      const L = z1 - z0;
      c.add('brilho', new RoundedBoxGeometry(0.055, 1.5, L, 3, 0.022), GELADEIRA, M(-0.0285, 0.88, L / 2));
      c.bloco('brilho', BRANCO, -0.002, 0.2, 0.04, 0.004, 1.55, L - 0.04);
      // Prateleiras da porta com garrafas.
      for (const y of [0.45, 0.85, 1.25]) {
        c.bloco('brilho', BRANCO, 0, y, 0.05, 0.09, y + 0.01, L - 0.05);
        c.bloco('vidro', '#e6f2f8', 0.085, y, 0.05, 0.09, y + 0.07, L - 0.05);
      }
      garrafa(c, 0.045, 0.46, 0.18, 0.22, '#8fc6a0');
      garrafa(c, 0.045, 0.46, 0.3, 0.2, '#e9eef2');
      c.cilindro('brilho', '#e7c64f', 0.045, 0.9, 0.45, 0.03, 0.08, 10);
      c.cilindro('brilho', '#d6492f', 0.045, 0.9, 0.55, 0.028, 0.09, 10);
      // Puxador cromado e emblema.
      c.add('metal', new RoundedBoxGeometry(0.03, 0.34, 0.03, 2, 0.01), INOX, M(-0.085, 1.05, L - 0.06));
      c.bloco('metal', INOX, -0.07, 0.9, L - 0.08, -0.06, 0.92, L - 0.04);
      c.bloco('metal', INOX, -0.07, 1.2, L - 0.08, -0.06, 1.22, L - 0.04);
      c.bloco('metal', INOX, -0.062, 1.42, L / 2 - 0.08, -0.058, 1.45, L / 2 + 0.08);
    }
    bloqueio(x0, z0, LX, z1);
  }

  // Coluna do forno de parede.
  const FOR = { z0: -2.72, z1: -1.98, y0: 0.72, y1: 1.52, cz0: -2.63, cz1: -2.07, cy0: 0.8, cy1: 1.32, fundo: 4.38 };
  const fornoZ = (FOR.cz0 + FOR.cz1) / 2;
  const fornoGradeY = 0.94;
  {
    const { z0, z1 } = FOR;
    c.bloco('fosco', RODAPE, XD + 0.04, 0, z0, LX, 0.1, z1);
    c.bloco('fosco', MARINHO, XD + 0.02, 0.1, z0, LX, FOR.y0, z1);
    c.bloco('fosco', MARINHO, XD + 0.02, FOR.y1, z0, LX, 2.25, z1);
    c.bloco('fosco', MARINHO, FOR.fundo, FOR.y0, z0, LX, FOR.y1, z1);
    c.bloco('fosco', MARINHO, XD, FOR.y0, z0, LX, FOR.y1, FOR.cz0);
    c.bloco('fosco', MARINHO, XD, FOR.y0, FOR.cz1, LX, FOR.y1, z1);
    c.bloco('fosco', MARINHO, XD, FOR.y0, FOR.cz0, LX, FOR.cy0, FOR.cz1);
    c.bloco('fosco', MARINHO, XD, FOR.cy1, FOR.cz0, LX, FOR.y1, FOR.cz1);
    c.bloco('fosco', MARINHO3, XD - 0.01, 2.25, z0 - 0.01, LX, 2.29, z1 + 0.01);
    // Frentes: gaveta embaixo e porta em cima (montadas em espaço local voltado para -x).
    c.com(M(XD, 0, z0, 0, -PI / 2, 0), () => {
      porta(c, 0.004, 0.12, z1 - z0 - 0.008, 0.56);
      puxador(c, (z1 - z0) / 2, 0.6, true, 0.2);
      porta(c, 0.004, 1.55, z1 - z0 - 0.008, 0.68);
      puxador(c, (z1 - z0) / 2, 1.62, true, 0.2);
    });
    // Moldura de inox e painel de comando.
    const xf = XD - 0.02;
    c.bloco('metal', INOX, xf, FOR.y0, z0 + 0.02, XD, FOR.cy0 - 0.005, z1 - 0.02);
    c.bloco('metal', INOX, xf, FOR.cy1 + 0.005, z0 + 0.02, XD, FOR.y1, z1 - 0.02);
    c.bloco('metal', INOX, xf, FOR.cy0 - 0.005, z0 + 0.02, XD, FOR.cy1 + 0.005, FOR.cz0 - 0.005);
    c.bloco('metal', INOX, xf, FOR.cy0 - 0.005, FOR.cz1 + 0.005, XD, FOR.cy1 + 0.005, z1 - 0.02);
    for (const dz of [-0.2, -0.1, 0.1, 0.2]) c.add('fosco', new THREE.CylinderGeometry(0.018, 0.02, 0.02, 14), '#1b1c20', M(xf - 0.01, 1.43, fornoZ + dz, 0, 0, PI / 2));
    c.bloco('fosco', '#0d1420', xf - 0.002, 1.4, fornoZ - 0.045, xf, 1.46, fornoZ + 0.045);
    c.bloco('emissivo', [0.5, 1.4, 2.6], xf - 0.003, 1.42, fornoZ - 0.03, xf - 0.002, 1.44, fornoZ + 0.03);
    // Interior do forno (material que acende).
    const { cz0, cz1, cy0, cy1, fundo } = FOR;
    const d = 0.003;
    c.paredeX('forno', fundo - d, -1, cz0, cz1, cy0, cy1, 1, [1, 1, 1]);
    c.paredeZ('forno', cz0 + d, 1, XD, fundo, cy0, cy1, 1, [0.55, 0.55, 0.55]);
    c.paredeZ('forno', cz1 - d, -1, XD, fundo, cy0, cy1, 1, [0.55, 0.55, 0.55]);
    c.plano('forno', cy0 + d, 1, XD, fundo, cz0, cz1, 1, [0.4, 0.4, 0.4]);
    c.plano('forno', cy1 - d, -1, XD, fundo, cz0, cz1, 1, [0.75, 0.75, 0.75]);
    // Resistência no teto e grade.
    for (let i = 0; i < 3; i++) c.bloco('metal', '#5a4a40', XD + 0.08 + i * 0.12, cy1 - 0.02, cz0 + 0.04, XD + 0.09 + i * 0.12, cy1 - 0.012, cz1 - 0.04);
    for (const zz of [cz0 + 0.005, cz1 - 0.005]) for (const y of [0.9, 0.94, 1.1]) c.bloco('metal', '#8e949a', XD + 0.03, y - 0.006, zz - 0.006, fundo - 0.01, y, zz + 0.006);
    const g0 = XD + 0.04;
    const g1 = fundo - 0.02;
    c.bloco('metal', INOX, g0, fornoGradeY - 0.008, cz0 + 0.01, g0 + 0.008, fornoGradeY, cz1 - 0.01);
    c.bloco('metal', INOX, g1 - 0.008, fornoGradeY - 0.008, cz0 + 0.01, g1, fornoGradeY, cz1 - 0.01);
    for (let i = 0; i < 9; i++) {
      const zz = cz0 + 0.03 + i * ((cz1 - cz0 - 0.06) / 8);
      c.add('metal', new THREE.CylinderGeometry(0.003, 0.003, g1 - g0, 6), INOX, M((g0 + g1) / 2, fornoGradeY - 0.004, zz, 0, 0, PI / 2));
    }
    // Porta de vidro basculante (dobradiça embaixo): construída à parte para abrir e fechar.
    const hd = cy1 - cy0 + 0.04;
    pivoForno.set(XD - 0.02, cy0 - 0.012, 0);
    {
      const c = cPortaForno;
      c.bloco('vidro', '#3a3026', -0.018, 0.045, cz0 + 0.03, -0.012, hd - 0.05, cz1 - 0.03);
      c.bloco('metal', INOX, -0.03, 0, cz0 - 0.005, 0, 0.045, cz1 + 0.005);
      c.bloco('metal', INOX, -0.03, hd - 0.05, cz0 - 0.005, 0, hd, cz1 + 0.005);
      c.bloco('metal', INOX, -0.03, 0.045, cz0 - 0.005, 0, hd - 0.05, cz0 + 0.03);
      c.bloco('metal', INOX, -0.03, 0.045, cz1 - 0.03, 0, hd - 0.05, cz1 + 0.005);
      c.add('metal', new THREE.CylinderGeometry(0.009, 0.009, cz1 - cz0 - 0.06, 10), INOX, M(-0.075, hd - 0.03, fornoZ, PI / 2));
      for (const dz of [-0.22, 0.22]) c.add('metal', new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6), INOX, M(-0.05, hd - 0.03, fornoZ + dz, 0, 0, PI / 2));
    }
    // Pano de prato pendurado no puxador da gaveta.
    c.add('fosco', new THREE.BoxGeometry(0.008, 0.26, 0.2), '#e9eef5', M(XD - 0.045, 0.49, fornoZ + 0.12));
    for (let i = 0; i < 3; i++) c.add('fosco', new THREE.BoxGeometry(0.009, 0.02, 0.2), FILETE, M(XD - 0.045, 0.57 - i * 0.07, fornoZ + 0.12));
    bloqueio(XD - 0.1, z0, LX, z1);
  }
  // Painel de fechamento entre forno e confeitaria.
  c.bloco('fosco', MARINHO, XD + 0.02, 0, FOR.z1, LX, 2.25, -1.8);

  // Bancada de confeitaria com tampo de mármore.
  const CONF = { z0: -1.8, z1: 0.9 };
  const confZ = -0.45;
  {
    c.com(M(XD, 0, CONF.z0, 0, -PI / 2, 0), () => {
      armarioBaixo(c, CONF.z1 - CONF.z0, 0.62, [
        { w: 0.8, tipo: 'portas' },
        { w: 0.6, tipo: 'gavetas', n: 3 },
        { w: 0.8, tipo: 'portas' },
        { w: 0.5, tipo: 'porta' },
      ]);
    });
    const tampo = new THREE.BoxGeometry(CONF.z1 - CONF.z0 + 0.03, 0.04, LX - XD + 0.03);
    tampo.rotateY(PI / 2);
    c.add('marmore', tampo, 0xffffff, M((XD - 0.03 + LX) / 2, 0.88, (CONF.z0 + CONF.z1) / 2));
    // Potes de farinha e açúcar, rolo, boleira com bolo, batedor.
    [[0.07, 0.24, 'FARINHA'], [0.065, 0.2, 'AÇÚCAR'], [0.055, 0.16, '']].forEach(([r, h], i) => {
      const z = -1.64 + i * 0.15;
      const rr = r as number;
      const hh = h as number;
      c.cilindro('brilho', BRANCO, 4.32, BANC + hh / 2, z, rr, hh, 18);
      c.cilindro('brilho', '#7fb0d6', 4.32, BANC + hh * 0.5, z, rr + 0.001, hh * 0.25, 18);
      c.esfera('brilho', BRANCO, 4.32, BANC + hh, z, rr * 0.95, 1, 0.35, 1, 1);
      c.esfera('metal', LATAO, 4.32, BANC + hh + rr * 0.33, z, 0.014);
    });
    c.add('fosco', new THREE.CylinderGeometry(0.03, 0.03, 0.32, 14), '#d8b98c', M(4.33, BANC + 0.03, 0.15, PI / 2, 0.2));
    for (const s of [-1, 1]) c.add('fosco', new THREE.CylinderGeometry(0.013, 0.013, 0.08, 8), '#b48a5a', M(4.33 + s * 0.04, BANC + 0.03, 0.15 + s * 0.2, PI / 2, 0.2));
    // Boleira com bolo azul.
    c.cilindro('brilho', LOUCA, 4.25, BANC + 0.05, 0.55, 0.03, 0.1, 14, 0.02);
    c.cilindro('brilho', LOUCA, 4.25, BANC + 0.105, 0.55, 0.14, 0.01, 28);
    c.cilindro('fosco', '#f6efe1', 4.25, BANC + 0.17, 0.55, 0.11, 0.12, 28);
    c.cilindro('fosco', '#8fc0e6', 4.25, BANC + 0.235, 0.55, 0.113, 0.014, 28);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI * 2;
      c.esfera('fosco', '#8fc0e6', 4.25 + Math.cos(a) * 0.09, BANC + 0.25, 0.55 + Math.sin(a) * 0.09, 0.016, 1, 1, 1, 0);
    }
    c.esfera('fosco', '#c0392b', 4.25, BANC + 0.255, 0.55, 0.02, 1, 1, 1, 1);
    c.add('vidro', lathe([[0.15, 0], [0.15, 0.16], [0.12, 0.24], [0.05, 0.27], [0.001, 0.275]], 24), '#eef5fa', M(4.25, BANC + 0.11, 0.55));
    c.esfera('vidro', '#eef5fa', 4.25, BANC + 0.395, 0.55, 0.02);
    // Tigela grande com batedor.
    tigela(c, 4.18, BANC, -0.98, 0.12, '#e7eff6');
    for (let i = 0; i < 5; i++) {
      c.add('metal', new THREE.TorusGeometry(0.04, 0.0015, 4, 14, PI), INOX, M(4.2, BANC + 0.16, -0.97, 0.5, (i / 5) * PI, PI));
    }
    c.add('metal', new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), INOX, M(4.2, BANC + 0.24, -0.93, 0.5));
    bloqueio(XD - 0.03, CONF.z0, LX, CONF.z1 + 0.02);

    // Quadro-negro com moldura e calha para giz.
    const qz = confZ;
    const qy = 1.82;
    c.add('atlas', uvAtlas(new THREE.PlaneGeometry(1.3, 0.65), ATLAS.quadro), 0xffffff, M(LX - 0.025, qy, qz, 0, -PI / 2));
    c.bloco('fosco', CARVALHO, LX - 0.04, qy - 0.36, qz - 0.7, LX - 0.01, qy - 0.325, qz + 0.7);
    c.bloco('fosco', CARVALHO, LX - 0.04, qy + 0.325, qz - 0.7, LX - 0.01, qy + 0.36, qz + 0.7);
    c.bloco('fosco', CARVALHO, LX - 0.04, qy - 0.36, qz - 0.7, LX - 0.01, qy + 0.36, qz - 0.65);
    c.bloco('fosco', CARVALHO, LX - 0.04, qy - 0.36, qz + 0.65, LX - 0.01, qy + 0.36, qz + 0.7);
    c.bloco('fosco', CARVALHO, LX - 0.09, qy - 0.38, qz - 0.6, LX - 0.01, qy - 0.36, qz + 0.6);
    c.add('fosco', new THREE.CylinderGeometry(0.005, 0.005, 0.06, 6), BRANCO, M(LX - 0.06, qy - 0.355, qz + 0.3, PI / 2, 0.4));
    c.add('fosco', new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6), '#8fc0e6', M(LX - 0.05, qy - 0.355, qz + 0.4, PI / 2, -0.2));
  }

  /* ---------------- Cristaleira na parede da porta ---------------- */
  {
    const x0 = 0.4;
    const x1 = 2.0;
    const L = x1 - x0;
    c.com(M(x1, 0, LZ - 0.45, 0, PI, 0), () => {
      c.bloco('fosco', RODAPE, 0, 0, -0.42, L, 0.1, -0.06);
      c.bloco('fosco', MARINHO, 0, 0.1, -0.45, L, 0.82, -0.02);
      frentes(c, [{ w: 0.5, tipo: 'porta' }, { w: 0.6, tipo: 'gavetas', n: 2 }, { w: 0.5, tipo: 'porta' }], 0.12, 0.8);
      c.bloco('fosco', CARVALHO, -0.02, 0.82, -0.47, L + 0.02, 0.86, 0.02);
      // Parte de cima aberta com pratos em pé.
      c.bloco('fosco', MARINHO, 0, 0.86, -0.45, L, 2.1, -0.42);
      c.bloco('fosco', MARINHO, 0, 0.86, -0.45, 0.03, 2.1, -0.2);
      c.bloco('fosco', MARINHO, L - 0.03, 0.86, -0.45, L, 2.1, -0.2);
      c.bloco('fosco', MARINHO3, -0.02, 2.1, -0.47, L + 0.02, 2.16, -0.18);
      for (const y of [1.3, 1.72]) {
        c.bloco('fosco', MARINHO, 0.03, y - 0.025, -0.42, L - 0.03, y, -0.2);
        c.bloco('fosco', CARVALHO, 0.03, y + 0.02, -0.25, L - 0.03, y + 0.035, -0.235);
      }
      for (let i = 0; i < 6; i++) pratoEmPe(c, M(0.18 + i * 0.25, 1.3, -0.36, 0, 0, 0), 0.11);
      for (let i = 0; i < 7; i++) pratoEmPe(c, M(0.15 + i * 0.22, 1.72, -0.36, 0, 0, 0), 0.09);
      for (let i = 0; i < 5; i++) {
        c.add('brilho', lathe([[0.001, 0], [0.03, 0], [0.04, 0.07], [0.036, 0.07], [0.026, 0.006], [0.001, 0.006]], 14), i % 2 ? '#7fb0d6' : LOUCA, M(0.2 + i * 0.3, 0.86, -0.3));
      }
      tigela(c, 0.3, 0.86, -0.15, 0.1, '#3b6fb6', false);
      vaso(c, L - 0.25, 0.86, -0.25, 0.07, 0.13, 21, '#e9e6de');
    });
    bloqueio(x0 - 0.03, LZ - 0.48, x1 + 0.03, LZ);
  }

  /* ---------------- Planta grande no canto ---------------- */
  {
    const px = 3.95;
    const pz = 3.0;
    c.add('fosco', lathe([[0.001, 0], [0.16, 0], [0.2, 0.42], [0.22, 0.44], [0.001, 0.44]], 18), '#2e5383', M(px, 0, pz));
    c.cilindro('fosco', '#3b2a1e', px, 0.43, pz, 0.19, 0.02, 18);
    const s = sorteador(55);
    for (let i = 0; i < 14; i++) {
      const a = s() * PI * 2;
      const h = 0.6 + s() * 0.9;
      const d = 0.08 + s() * 0.25;
      c.add('fosco', new THREE.CylinderGeometry(0.006, 0.008, h, 5), '#55733a', M(px + Math.cos(a) * d * 0.4, 0.44 + h / 2, pz + Math.sin(a) * d * 0.4, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25));
      c.esfera('fosco', FOLHA[i % 4], px + Math.cos(a) * d, 0.44 + h, pz + Math.sin(a) * d, 0.11 + s() * 0.05, 1.3, 0.25, 0.8, 1);
    }
    bloqueio(px - 0.3, pz - 0.3, LX, LZ);
  }

  /* ---------------- Planta pendurada perto da janela ---------------- */
  {
    const px = -3.95;
    const pz = 1.75;
    const y = 2.15;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      const ox = Math.cos(a) * 0.1;
      const oz = Math.sin(a) * 0.1;
      const comp = PE - 0.18 - y - 0.1;
      c.add('fosco', new THREE.CylinderGeometry(0.003, 0.003, comp + 0.02, 4), '#d9cbb0', M(px + ox / 2, y + 0.1 + comp / 2, pz + oz / 2, oz * 0.6, 0, -ox * 0.6));
    }
    c.add('fosco', lathe([[0.001, 0], [0.07, 0], [0.11, 0.12], [0.001, 0.12]], 14), '#efe9dd', M(px, y, pz));
    const s = sorteador(71);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI * 2;
      for (let i = 0; i < 7; i++) {
        c.esfera('fosco', FOLHA[(i + k) % 4], px + Math.cos(a) * (0.1 + s() * 0.03), y + 0.1 - i * 0.07, pz + Math.sin(a) * (0.1 + s() * 0.03), 0.03, 1, 0.55, 1, 1);
      }
    }
  }

  /* ---------------- Púlpito com o caderno de técnicas ---------------- */
  const PUL = new THREE.Vector3(2.55, 0, 1.25);
  const inclPul = 0.42;
  const topoPul = 1.08;
  {
    c.com(M(PUL.x, 0, PUL.z), () => {
      c.add('fosco', new THREE.BoxGeometry(0.5, 0.04, 0.08), NOGUEIRA, M(0, 0.02, 0));
      c.add('fosco', new THREE.BoxGeometry(0.08, 0.04, 0.42), NOGUEIRA, M(0, 0.02, 0));
      c.add('fosco', new THREE.CylinderGeometry(0.035, 0.045, topoPul - 0.06, 12), NOGUEIRA, M(0, (topoPul - 0.06) / 2 + 0.03, 0));
      c.add('metal', new THREE.CylinderGeometry(0.05, 0.05, 0.02, 14), LATAO, M(0, 0.06, 0));
      c.com(M(0, topoPul, 0, inclPul), () => {
        c.add('fosco', new THREE.BoxGeometry(0.6, 0.025, 0.44), CARVALHO, M(0, 0, 0));
        c.add('fosco', new THREE.BoxGeometry(0.6, 0.04, 0.02), CARVALHO, M(0, 0.02, 0.22));
        // Livro: capa, miolo e páginas abertas.
        c.add('atlas', uvAtlas(new THREE.BoxGeometry(0.56, 0.01, 0.38), ATLAS.lombada), 0xffffff, M(0, 0.018, 0));
        for (const s of [-1, 1]) {
          c.add('fosco', new THREE.BoxGeometry(0.26, 0.02, 0.35), '#efe6d2', M(s * 0.135, 0.03, 0, 0, 0, s * 0.06));
          const pg = uvAtlas(new THREE.PlaneGeometry(0.265, 0.35), ATLAS.caderno, s < 0 ? 0 : 0.5, s < 0 ? 0.5 : 1);
          c.add('atlas', pg, 0xffffff, M(s * 0.135, 0.0415, 0, 0, 0, s * 0.06).multiply(M(0, 0, 0, -PI / 2)));
        }
        c.add('fosco', new THREE.BoxGeometry(0.006, 0.12, 0.004), '#c0392b', M(0.02, 0.0, 0.2, 0.3));
      });
    });
    bloqueio(PUL.x - 0.3, PUL.z - 0.25, PUL.x + 0.3, PUL.z + 0.25);
  }
  const superficieCaderno = new THREE.Vector3(PUL.x, topoPul + 0.045, PUL.z);

  /* ---------------- Paredes como colisores ---------------- */
  bloqueio(-LX - 1, -LZ - 1, LX + 1, -LZ);
  bloqueio(-LX - 1, LZ, LX + 1, LZ + 1);
  bloqueio(-LX - 1, -LZ, -LX, LZ);
  bloqueio(LX, -LZ, LX + 1, LZ);

  /* ---------------- Malhas estáticas ---------------- */
  const malhas = c.construir(mats.porChave);
  let rendererVisto: THREE.WebGLRenderer | null = null;
  for (const m of malhas) {
    const chave = m.name.replace('cozinha_', '');
    if (chave === 'piso') m.onBeforeRender = (r) => { rendererVisto = r; };
    m.castShadow = !['vidro', 'emissivo', 'piso', 'atlas'].includes(chave);
    m.receiveShadow = !['vidro', 'emissivo'].includes(chave);
    if (chave === 'vidro') m.renderOrder = 2;
    grupo.add(m);
  }

  /* ---------------- Portas que abrem ---------------- */
  const montarPorta = (cp: Construtor, pivo: THREE.Vector3) => {
    const g = new THREE.Group();
    g.position.copy(pivo);
    for (const m of cp.construir(mats.porChave)) {
      const chave = m.name.replace('cozinha_', '');
      m.castShadow = !['vidro', 'emissivo'].includes(chave);
      m.receiveShadow = !['vidro', 'emissivo'].includes(chave);
      if (chave === 'vidro') m.renderOrder = 2;
      g.add(m);
    }
    grupo.add(g);
    return g;
  };
  const portaGel = montarPorta(cPortaGel, pivoGel);
  const portaForno = montarPorta(cPortaForno, pivoForno);
  const ABERTA_GEL = -1.54;
  const ABERTA_FORNO = 1.5;
  let alvoGel = 0;
  let alvoForno = 0;
  let abertGel = 0;
  let abertForno = 0;
  function abrirPorta(qual: 'forno' | 'geladeira', aberta: boolean): void {
    if (qual === 'forno') alvoForno = aberta ? 1 : 0;
    else alvoGel = aberta ? 1 : 0;
  }
  const suaveAbrir = (x: number) => x * x * (3 - 2 * x);

  /* ---------------- Janela: vidro com chuva e céu lá fora ---------------- */
  const largJ = J.z1 - J.z0;
  const altJ = J.y1 - J.y0;
  const matJanela = materialJanela(largJ, altJ);
  const vidro = new THREE.Mesh(new THREE.PlaneGeometry(largJ, altJ), matJanela);
  vidro.position.set(XC - 0.005, (J.y0 + J.y1) / 2, (J.z0 + J.z1) / 2);
  vidro.rotation.y = PI / 2;
  vidro.renderOrder = 3;
  grupo.add(vidro);
  const matCeu = materialCeu();
  const ceu = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), matCeu);
  ceu.position.set(-16, 6, -1);
  ceu.rotation.y = PI / 2;
  grupo.add(ceu);

  /* ---------------- Luminárias pendentes (instanciadas) ---------------- */
  const pendentes = [
    new THREE.Vector3(-0.6, PE, ilhaZ),
    new THREE.Vector3(0.6, PE, ilhaZ),
    new THREE.Vector3(2.55, PE, 1.05),
  ];
  const fio = 0.85;
  const cp = new Construtor();
  {
    cp.cilindro('brilho', MARINHO2, 0, -0.012, 0, 0.06, 0.024, 18);
    cp.add('brilho', new THREE.CylinderGeometry(0.004, 0.004, fio, 5), '#1a1a1a', M(0, -fio / 2, 0));
    cp.cilindro('brilho', LATAO, 0, -fio - 0.02, 0, 0.022, 0.05, 14);
    const perfil: [number, number][] = [[0.024, 0], [0.05, -0.02], [0.11, -0.07], [0.16, -0.13], [0.185, -0.19]];
    cp.add('brilho', lathe(perfil, 28), '#fbf6ea', M(0, -fio - 0.04, 0));
    const dentro = perfil.slice().reverse().map(([r, y]) => [r * 0.97, y + 0.004] as [number, number]);
    cp.add('brilho', lathe(dentro, 28), '#1f3f72', M(0, -fio - 0.04, 0));
    cp.add('brilho', new THREE.TorusGeometry(0.185, 0.005, 6, 28), LATAO, M(0, -fio - 0.23, 0, PI / 2));
    cp.esfera('emissivo', [5.5, 4.2, 2.6], 0, -fio - 0.13, 0, 0.055, 1, 1, 1, 2);
  }
  const pendGeoA = cp.geometria('brilho');
  const pendGeoB = cp.geometria('emissivo');
  const pendA = new THREE.InstancedMesh(pendGeoA, mats.porChave.brilho, pendentes.length);
  const pendB = new THREE.InstancedMesh(pendGeoB, mats.porChave.emissivo, pendentes.length);
  pendA.name = 'pendentes';
  pendB.name = 'pendentes_luz';
  pendA.frustumCulled = false;
  pendB.frustumCulled = false;
  grupo.add(pendA, pendB);
  const auxM = new THREE.Matrix4();
  const auxQ = new THREE.Quaternion();
  const auxE = new THREE.Euler();
  const umV = new THREE.Vector3(1, 1, 1);
  function posicionarPendentes(t: number): void {
    pendentes.forEach((p, i) => {
      auxE.set(Math.sin(t * 0.55 + i * 1.7) * 0.012, 0, Math.cos(t * 0.43 + i * 2.3) * 0.012);
      auxQ.setFromEuler(auxE);
      auxM.compose(p, auxQ, umV);
      pendA.setMatrixAt(i, auxM);
      pendB.setMatrixAt(i, auxM);
    });
    pendA.instanceMatrix.needsUpdate = true;
    pendB.instanceMatrix.needsUpdate = true;
  }
  posicionarPendentes(0);

  /* ---------------- Ponteiros do relógio ---------------- */
  const geoHora = new THREE.BoxGeometry(0.012, 0.075, 0.004).translate(0, 0.03, 0);
  const geoMin = new THREE.BoxGeometry(0.008, 0.11, 0.004).translate(0, 0.045, 0);
  const pHora = new THREE.Mesh(geoHora, mats.porChave.fosco);
  const pMin = new THREE.Mesh(geoMin, mats.porChave.fosco);
  for (const p of [pHora, pMin]) {
    p.position.copy(relogioCentro).add(new THREE.Vector3(0, 0, p === pHora ? 0.004 : 0.008));
    grupo.add(p);
  }
  const corPonteiro = new THREE.Color(MARINHO);
  for (const g of [geoHora, geoMin]) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) corPonteiro.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  }

  /* ---------------- Chama, vapor ---------------- */
  const chama = criarChama(0.05);
  chama.malha.position.set(bocaAtiva.x, YQ, bocaAtiva.z);
  grupo.add(chama.malha);
  const vapor = criarVapor(new THREE.Vector3(bocas[3].x, YG + 0.15, bocas[3].z));
  grupo.add(vapor.pontos);

  /* ---------------- Luzes ---------------- */
  const hemi = new THREE.HemisphereLight('#bcd0ee', '#806048', 0.6);
  grupo.add(hemi);
  const sol = new THREE.DirectionalLight('#ffc48a', 5.0);
  sol.position.set(-12, 5.2, -4.2);
  sol.target.position.set(0, 0.6, 0);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -6;
  sc.right = 6;
  sc.top = 4.5;
  sc.bottom = -4.5;
  sc.near = 4;
  sc.far = 22;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  grupo.add(sol, sol.target);

  const luzIlha = new THREE.PointLight('#ffcf98', 4.0, 0, 2);
  luzIlha.position.set(0, 1.86, ilhaZ);
  grupo.add(luzIlha);
  const luzChama = new THREE.PointLight('#5b8cff', 0.5, 2.0, 2);
  luzChama.position.set(bocaAtiva.x, YG + 0.06, bocaAtiva.z + 0.05);
  grupo.add(luzChama);

  /* ---------------- Estações ---------------- */
  const est = (id: CenaEstacao, superficie: THREE.Vector3, camera: THREE.Vector3, olhar?: THREE.Vector3): Estacao => ({
    id,
    superficie,
    camera,
    olhar: olhar ?? superficie.clone(),
  });
  /** Câmera 0,55 m acima e 0,45 m para trás (no sentido `tras`) da superfície. */
  const atras = (s: THREE.Vector3, tras: THREE.Vector3, sobe = 0.55, recua = 0.45) =>
    s.clone().add(new THREE.Vector3(0, sobe, 0)).add(tras.clone().multiplyScalar(recua));
  const MAIS_Z = new THREE.Vector3(0, 0, 1);
  const MENOS_X = new THREE.Vector3(-1, 0, 0);

  const sCorte = new THREE.Vector3(0, BANC + 0.032, ilhaZ);
  const sFogao = new THREE.Vector3(bocaAtiva.x, YG, bocaAtiva.z);
  const sForno = new THREE.Vector3((XD + FOR.fundo) / 2, fornoGradeY, fornoZ);
  const sPia = new THREE.Vector3((CUBA.x0 + CUBA.x1) / 2, CUBA.fundo, (CUBA.z0 + CUBA.z1) / 2);
  const sConf = new THREE.Vector3((XD + LX) / 2 - 0.03, BANC, confZ);
  const sGel = new THREE.Vector3(GEL.x0 + 0.32, prateleiraY, gelZ);
  const sBal = new THREE.Vector3(balanca.x, YBAL, balanca.z);

  const estacoes: Record<CenaEstacao, Estacao> = {
    corte: est('corte', sCorte, atras(sCorte, MAIS_Z)),
    fogao: est('fogao', sFogao, atras(sFogao, MAIS_Z)),
    forno: est('forno', sForno, new THREE.Vector3(XD - 0.45, fornoGradeY + 0.5, fornoZ)),
    pia: est('pia', sPia, new THREE.Vector3(sPia.x + 0.55, BANC + 0.55, sPia.z)),
    confeitaria: est('confeitaria', sConf, atras(sConf, MENOS_X)),
    geladeira: est('geladeira', sGel, new THREE.Vector3(GEL.x0 - 0.22, prateleiraY + 0.47, gelZ)),
    caderno: est('caderno', superficieCaderno, atras(superficieCaderno, MAIS_Z, 0.55, 0.42)),
    balanca: est('balanca', sBal, atras(sBal, MAIS_Z)),
  };

  const inicio = {
    posicao: new THREE.Vector3(0, 1.65, 2.3),
    olhar: new THREE.Vector3(0, 1.05, -2.6),
  };

  /* ---------------- Controles ---------------- */
  let intChama = 0.6;
  let intForno = 0;
  function definirChama(v: number): void {
    intChama = THREE.MathUtils.clamp(v, 0, 1);
    chama.uniforms.uInt.value = intChama;
    chama.malha.visible = intChama > 0.01;
    luzChama.visible = intChama > 0.01;
  }
  function definirForno(v: number): void {
    intForno = THREE.MathUtils.clamp(v, 0, 1);
    mats.forno.emissiveIntensity = intForno * 1.7;
  }
  definirChama(intChama);
  definirForno(0);

  function atualizar(dt: number, t: number): void {
    // portas: abrem e fecham devagar, com uma leve desaceleração no fim
    const passo = Math.min(1, dt * 1.6);
    abertGel += Math.sign(alvoGel - abertGel) * Math.min(Math.abs(alvoGel - abertGel), passo);
    abertForno += Math.sign(alvoForno - abertForno) * Math.min(Math.abs(alvoForno - abertForno), passo);
    portaGel.rotation.y = ABERTA_GEL * suaveAbrir(abertGel);
    portaForno.rotation.z = ABERTA_FORNO * suaveAbrir(abertForno);
    if (rendererVisto) {
      mats.aplicarAmbiente(rendererVisto);
      rendererVisto = null;
    }
    matJanela.uniforms.uTempo.value = t;
    matCeu.uniforms.uTempo.value = t;
    chama.uniforms.uTempo.value = t;
    vapor.uniforms.uTempo.value = t;
    luzChama.intensity = intChama * (0.45 + 0.08 * Math.sin(t * 21) + 0.05 * Math.sin(t * 33.7));
    posicionarPendentes(t);
    const agora = new Date();
    const min = agora.getMinutes() + agora.getSeconds() / 60;
    const hora = (agora.getHours() % 12) + min / 60;
    pMin.rotation.z = -(min / 60) * PI * 2;
    pHora.rotation.z = -(hora / 12) * PI * 2;
  }
  atualizar(0, 0);

  return { grupo, estacoes, colisores, inicio, atualizar, definirChama, definirForno, abrirPorta };
}
