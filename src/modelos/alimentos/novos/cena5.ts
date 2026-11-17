// Alimentos novos e refeitos pedidos pela revisão das cenas (cena5):
// - alga nori refeita (folha fina verde-escura quase preta, com leve brilho; por estar num lote,
//   o prato não pinta crosta de cozido por cima, o que a deixava marrom);
// - os passos do rolo de sushi: nori com arroz, com wasabi e tira de atum, o rolo fechado e a rodela;
// - pão-de-ló de cacau inteiro e em disco;
// - torrada grelhada simples e as bruschettas das técnicas (tomate e manjericão, camarão e
//   tomate-cereja, pera e queijo de cabra, presunto e figo, legumes tostados e pinoli);
// - as rosquinhas e o bagel crus, para os passos de modelagem antes do forno.
// Ostra, amêijoa e vieira fechadas foram refeitas na família (fam_mar.ts), o fígado em fam_carnes.ts
// e a gremolada em carnes.ts, nos próprios lugares onde já eram gerados.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, caixa, tf, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { folha, contornos, type Gerador } from '../pecas';
import { gBolo } from '../fam_doces';
import { gPao } from '../fam_padaria';
import { gRosca } from './paes_massas';
import { vis, type K } from './frutas_enfeites';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* utilidades                                                           */
/* ------------------------------------------------------------------ */

const frac = (v: number) => v - Math.floor(v);
const tom = (c: RGB, amp: number, f: number, s: number): CorFn => (x, y, z) => mul(c, 1 + amp * fbm(x * f, y * f, z * f, s));

/* ------------------------------------------------------------------ */
/* nori e sushi enrolado                                                */
/* ------------------------------------------------------------------ */

const NORI = rgb('#141c14'), NORI_V = rgb('#26361f');
const ARROZ = rgb('#f3f0e8'), ATUM = rgb('#a81e2c'), WASABI = rgb('#8eaa3e');

/** Alga nori: quase preta com reflexo verde, fibras finas e pintinhas mais claras da prensagem. */
function corNori(s: number): CorFn {
  return (x, y, z) => {
    let c = mix(NORI, NORI_V, suave(0.2, 0.9, fbm(x * 40, 0, z * 40, s)) * 0.6);
    c = mul(c, 0.85 + 0.3 * Math.abs(ruido(x * 700, y * 50, z * 90, s + 1)));
    return mix(c, mul(NORI_V, 1.35), (1 - suave(0.05, 0.12, celula(x * 260, 0, z * 260, s + 2))) * 0.45);
  };
}

/** Folha de nori deitada (X no comprido, Z na largura), apoiada em y = 0, levemente ondulada. */
function folhaNori(L: number, W: number, e: number, s: number, onda = 0.0012): THREE.BufferGeometry {
  const cor = corNori(s);
  return corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 36, exp: 12, tampa: true, linear: true, cor, corTampa: cor,
    perfil: () => ({ ry: e / 2, rz: W / 2, cy: e / 2 }),
    desloc: (p) => { p.y += onda * (0.5 + 0.5 * Math.sin(p.x * 38 + 1.3) * Math.sin(p.z * 31 + 0.4)); },
  });
}

/** Arroz de sushi: grãos brancos com o brilho do vinagre e as sombras entre eles. */
function corArroz(s: number): CorFn {
  return (x, y, z) => {
    const c = celula(x * 650, y * 650, z * 650, s);
    return mul(mix(ARROZ, rgb('#d6d0c2'), suave(0.32, 0.6, c) * 0.65), 0.95 + 0.07 * ruido(x * 2200, y * 2200, z * 2200, s));
  };
}

/** Grãos de arroz soltos espalhados por uma área (borda viva da camada). */
function graosSoltos(k: K, n: number, onde: (i: number) => [number, number, number], giroY?: number): Parte[] {
  const out: Parte[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, z] = onde(i);
    const g = elipsoide(0.0024, 0.0009, 0.0011, (xx, yy, zz) => mul(ARROZ, 0.94 + 0.08 * ruido(xx * 3000, yy * 3000, zz * 3000, k.s)), 3, 5);
    tf(g, [x, y, z], [k.r.f(-0.5, 0.5), giroY ?? k.r.f(0, TAU), k.r.f(-0.4, 0.4)]);
    out.push(parte(g, 'acetinado'));
  }
  return out;
}

/** Alga nori inteira (21 x 19 cm), fina, verde-escura quase preta, com leve brilho. */
const gAlgaNori: Gerador = (k) => {
  const L = k.T, W = L * k.L;
  return [parte(folhaNori(L, W, 0.0006, k.s), 'acetinado', true)];
};

/** Meia folha de nori com a camada de arroz espalhada, deixando livre a faixa da ponta de longe. */
function noriComArroz(k: K, comRecheio: boolean): Parte[] {
  const L = k.T, W = L * k.L;
  const eN = 0.0006, eA = 0.0055;
  const out: Parte[] = [parte(folhaNori(L, W, eN, k.s, 0.0004), 'acetinado', true)];
  const zA = -0.006, wA = W - 0.014;
  const arroz = corpo({
    x0: -L / 2 + 0.002, x1: L / 2 - 0.002, n: 34, m: 30, exp: 3.2, linear: true, cor: corArroz(k.s),
    perfil: () => ({ ry: eA / 2, rz: wA / 2, cy: eN + eA / 2, cz: zA }),
    desloc: (p) => {
      if (p.y > eN + eA * 0.6) p.y += eA * 0.35 * (1 - suave(0.25, 0.6, celula(p.x * 650, 0, p.z * 650, k.s)));
      if (p.y < eN) p.y = eN;
    },
  });
  out.push(parte(arroz, 'acetinado', true));
  out.push(...graosSoltos(k, 46, (i) => {
    const borda = i % 2 ? 1 : -1;
    return [k.r.f(-L / 2, L / 2) * 0.97, eN + eA * k.r.f(0.6, 1.1), zA + borda * (wA / 2) * k.r.f(0.85, 1.05)];
  }));
  if (comRecheio) {
    // linha fina de wasabi coberta por uma tira de atum de 1 cm, no meio da camada
    const yT = eN + eA;
    out.push(parte(tubo([V(-L * 0.46, yT + 0.0008, zA - 0.009), V(0, yT + 0.001, zA - 0.0092), V(L * 0.46, yT + 0.0008, zA - 0.009)], {
      raio: 0.0014, achata: 0.7, m: 6, n: 12, cor: tom(WASABI, 0.1, 900, k.s),
    }), 'umido'));
    out.push(parte(tf(caixa(L * 0.94, 0.011, 0.011, (x, y, z) => {
      const veio = Math.abs(Math.sin(x * 60 + z * 400 + fbm(x * 90, y * 900, z * 900, k.s) * 2)) ** 6;
      return mul(mix(ATUM, rgb('#d05058'), veio * 0.4), 0.94 + 0.08 * fbm(x * 300, y * 900, z * 900, k.s + 1));
    }), [0, yT + 0.0055, zA + 0.002]), 'umido'));
  }
  return out;
}

/** Rolo de sushi fechado (hosomaki): cilindro de nori levemente prensado, arroz e atum à mostra nas pontas. */
function rolo(k: K, comp: number): Parte[] {
  const R = 0.0125, s = k.s;
  const sq = 2.7;
  const raioSec = (dy: number, dz: number) => (Math.abs(dy) ** sq + Math.abs(dz) ** sq) ** (1 / sq) / R;
  const nori = corNori(s), arroz = corArroz(s);
  const cor: CorFn = (x, y, z) => {
    // costura da alga embaixo, um pouco mais escura e brilhante
    const c = nori(x, y, z, 0, 0);
    return mix(c, mul(c, 0.7), (1 - suave(0.0005, 0.0018, Math.abs(z - R * 0.15))) * (y < R * 0.4 ? 1 : 0));
  };
  const corPonta: CorFn = (x, y, z) => {
    const rr = raioSec(y - R, z);
    if (rr > 0.9) return nori(x, y, z, 0, 0);
    return arroz(x, y, z, 0, 0);
  };
  const out: Parte[] = [];
  const g = corpo({
    x0: -comp / 2, x1: comp / 2, n: Math.max(4, Math.round(comp / 0.008)), m: 40, exp: sq, tampa: true, aneisTampa: 6, linear: true,
    cor, corTampa: corPonta,
    perfil: () => ({ ry: R, rz: R, cy: R }),
    desloc: (p) => {
      // ponta: grãos em relevo; corpo: assenta um pouco na tábua
      const naPonta = Math.abs(Math.abs(p.x) - comp / 2) < 1e-6 && raioSec(p.y - R, p.z) < 0.88;
      if (naPonta) p.x += Math.sign(p.x) * 0.0012 * (1 - suave(0.25, 0.6, celula(p.y * 650, p.z * 650, 0.5, s)));
      if (p.y < R * 0.25) p.y = R * 0.25 - (R * 0.25 - p.y) * 0.6;
    },
  });
  out.push(parte(g, 'acetinado', true));
  // tira de atum no centro e linha de wasabi ao lado, aparecendo nas duas pontas
  out.push(parte(tf(caixa(comp + 0.0012, 0.0085, 0.0085, (x, y, z) => mul(mix(ATUM, rgb('#d05058'), Math.abs(Math.sin(y * 900 + z * 500)) ** 6 * 0.35), 0.94 + 0.08 * fbm(x * 300, y * 900, z * 900, s + 1))), [0, R * 1.02, 0]), 'umido'));
  out.push(parte(tf(caixa(comp + 0.0008, 0.0016, 0.0085, tom(WASABI, 0.1, 900, s)), [0, R * 1.02 + 0.0052, 0]), 'umido'));
  return out;
}

const gNoriArroz: Gerador = (k) => noriComArroz(k, false);
const gNoriArrozAtum: Gerador = (k) => noriComArroz(k, true);
const gMakiRolo: Gerador = (k) => rolo(k, k.T);

/** Rodela de maki em pé, com o corte para cima: anel de nori, arroz branco e o quadrado de atum. */
const gMakiRodela: Gerador = (k) => {
  const partes = rolo(k, 0.02);
  for (const p of partes) p.g.rotateZ(PI / 2);
  // alguns grãos em relevo no corte de cima (o eixo do rolo, depois de girado, passa em x = -R)
  partes.push(...graosSoltos(k, 10, () => {
    const a = k.r.f(0, TAU), r = k.r.f(0.0065, 0.0105);
    return [-0.0125 + Math.cos(a) * r, 0.0106, Math.sin(a) * r];
  }));
  return partes;
};

/* ------------------------------------------------------------------ */
/* pão-de-ló de cacau                                                   */
/* ------------------------------------------------------------------ */

const gPaoDeLoCacau: Gerador = (k) => gBolo(k);

/* ------------------------------------------------------------------ */
/* torrada e bruschettas                                                */
/* ------------------------------------------------------------------ */

const MIOLO = rgb('#e8d2a0'), TOSTADO = rgb('#c99048'), CASCA = rgb('#86501f'), GRELHA = rgb('#3a2010');
const FATIA = { L: 0.11, W: 0.072, H: 0.014 };

/** Meia-largura da fatia oval no ponto x. */
const meiaLarg = (x: number) => (FATIA.W / 2) * Math.sqrt(Math.max(0, 1 - (2 * x / FATIA.L) ** 2)) ** 0.7;

/** Fatia de pão rústico tostada na grelha: casca escura em volta, miolo dourado com alvéolos,
 * riscas da grelha em diagonal e manchas mais escuras do azeite. */
function fatiaPao(k: K): THREE.BufferGeometry {
  const { L, W, H } = FATIA;
  const s = k.s;
  const cor: CorFn = (x, y, z) => {
    const rr = Math.abs(z) / Math.max(1e-5, meiaLarg(x));
    const poro = 1 - suave(0.08, 0.22, celula(x * 260, y * 260, z * 260, s));
    let c = mix(MIOLO, TOSTADO, clamp(0.45 + 0.6 * fbm(x * 45, y * 45, z * 45, s)));
    c = mul(c, 1 - poro * 0.3);
    if (y > H * 0.8) {
      // riscas da grelha
      const q = frac((x * Math.cos(0.55) + z * Math.sin(0.55)) / (L * 0.2));
      c = mix(c, GRELHA, (1 - suave(0.05, 0.12, Math.abs(q - 0.5))) * 0.85);
      // azeite: manchas mais escuras e quentes
      c = mix(c, mul(rgb('#b8823a'), 0.95), suave(0.35, 0.75, fbm(x * 30, 0, z * 30, s + 7)) * 0.35);
    } else if (y < H * 0.2) c = mix(c, TOSTADO, 0.5);
    // casca em volta da fatia
    return mix(c, mul(CASCA, 0.9 + 0.15 * fbm(x * 90, y * 90, z * 90, s + 3)), suave(0.84, 0.95, rr));
  };
  return corpo({
    x0: -L / 2, x1: L / 2, n: 26, m: 36, exp: 6, cor,
    perfil: (t) => {
      const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.7;
      return { ry: (H / 2) * (0.6 + 0.4 * Math.sqrt(e)), rz: Math.max(1e-4, (W / 2) * e), cy: H / 2 };
    },
    desloc: (p) => {
      if (p.y > H * 0.75) {
        p.y += H * 0.08 * fbm(p.x * 40, 0, p.z * 40, s + 1);
        p.y -= H * 0.12 * (1 - suave(0.08, 0.22, celula(p.x * 260, p.y * 260, p.z * 260, s)));
      }
    },
  });
}

/** Ponto sorteado sobre a fatia (dentro de `f` da largura), com a altura do topo. */
function sobre(k: K, f = 0.75): [number, number, number] {
  const x = k.r.f(-1, 1) * FATIA.L * 0.5 * f;
  const z = k.r.f(-1, 1) * meiaLarg(x) * f;
  return [x, FATIA.H * 1.02, z];
}

function folhaManjericao(k: K, tam: number, onde: [number, number, number], giro: number): Parte {
  const g = folha(tam, tam * 0.6, rgb('#2e6a1e'), rgb('#5a9a3e'), { contorno: contornos.oval, concha: 0.18, curva: 0.12, s: k.s });
  return parte(tf(g, onde, [0, giro, 0]), 'brilhante');
}

/** Rodela fina de tomate-cereja: casca na borda, lóculos com gel e sementes, septos claros. */
function rodelaTomate(r: number, h: number, casca: RGB, s: number): THREE.BufferGeometry {
  const polpa = mix(casca, [1, 0.85, 0.6], 0.25), gel = mix(casca, [1, 0.95, 0.7], 0.45);
  return torno({
    caminho: [[0, 0], [r * 0.95, 0], [r, h * 0.5], [r * 0.95, h], [0, h]], n: 8, m: 22,
    cor: (x, y, z) => {
      const rr = Math.hypot(x, z) / r, a = Math.atan2(z, x);
      if (rr > 0.88 || y < h * 0.4) return casca;
      const septo = Math.abs(Math.cos(a * 1.5));
      let c = mix(gel, polpa, suave(0.75, 0.95, septo) + (1 - suave(0.15, 0.3, rr)));
      c = mix(c, rgb('#f2e0a0'), (1 - suave(0.04, 0.09, celula(x * 900, 0, z * 900, s))) * (1 - suave(0.6, 0.9, septo)) * suave(0.3, 0.5, rr) * 0.8);
      return c;
    },
  });
}

/** Camarão cozido e descascado em C, com o leque do rabo. */
function camarao(k: K, onde: [number, number, number], giro: number): Parte[] {
  const pts: THREE.Vector3[] = [];
  const Rc = 0.011;
  for (let i = 0; i <= 10; i++) {
    const a = lerp(-0.2, PI * 1.25, i / 10);
    pts.push(V(Math.cos(a) * Rc, 0.0045 + 0.001 * Math.sin(i), Math.sin(a) * Rc));
  }
  const corC: CorFn = (x, y, z, t) => {
    let c = mix(rgb('#f2a07a'), rgb('#e0603e'), suave(0.004, 0.008, y));
    c = mix(c, rgb('#fbe6da'), Math.abs(Math.sin(t * 34)) ** 8 * 0.5);
    return mul(c, 0.95 + 0.08 * ruido(x * 2000, y * 2000, z * 2000, k.s));
  };
  const corpoC = tubo(pts, { raio: (t) => 0.0052 * (1 - 0.65 * t), achata: 0.85, m: 10, n: 28, cor: corC });
  const fim = pts[pts.length - 1];
  const rabo = tf(elipsoide(0.006, 0.0012, 0.0045, () => rgb('#d0482c'), 4, 8), [fim.x - 0.003, fim.y, fim.z - 0.002], [0, 0.6, 0]);
  return [parte(tf(corpoC, onde, [0, giro, 0]), 'brilhante'), parte(tf(rabo, onde, [0, giro, 0]), 'brilhante')];
}

/** Fatia fina de pera cortada no comprido: contorno de pera, polpa creme e a casca na borda. */
function fatiaPera(k: K): THREE.BufferGeometry {
  const Lp = 0.048, Wp = 0.03, e = 0.0022;
  const larg = (t: number) => Math.max(0.03, Math.sin(PI * clamp(t)) ** 0.55 * (1 - 0.48 * suave(0.45, 0.88, t)));
  return corpo({
    x0: 0, x1: Lp, n: 18, m: 12, exp: 6, cor: (x, y, z) => {
      const t = clamp(x / Lp), rr = Math.abs(z) / ((Wp / 2) * larg(t));
      let c = mix(rgb('#f4eed4'), rgb('#ece0b8'), fbm(x * 200, y * 200, z * 200, k.s) * 0.5 + 0.2);
      c = mix(c, rgb('#e6dcae'), (1 - suave(0.0, 0.25, Math.hypot((t - 0.3) * 2, rr))) * 0.6);
      return mix(c, mix(rgb('#b8b04a'), rgb('#b8603a'), suave(0.3, 0.8, fbm(x * 60, 0, z * 60, k.s + 2)) * 0.4), suave(0.85, 0.97, rr));
    },
    perfil: (t) => ({ ry: e / 2, rz: (Wp / 2) * larg(t), cy: e / 2 }),
  });
}

/** Fatia de figo cortada no comprido: casca roxa, camada branca e miolo rosado com sementes. */
function fatiaFigo(k: K): THREE.BufferGeometry {
  const Lf = 0.04, Wf = 0.034, e = 0.0035;
  const larg = (t: number) => Math.max(0.03, Math.sin(PI * clamp(t)) ** 0.6 * (1 - 0.55 * suave(0.5, 0.95, t)));
  return corpo({
    x0: 0, x1: Lf, n: 18, m: 14, exp: 5, cor: (x, y, z) => {
      const t = clamp(x / Lf), rr = Math.max(Math.abs(z) / ((Wf / 2) * larg(t)), Math.abs(t - 0.45) * 2 * 0.9);
      let c = mix(rgb('#c83048'), rgb('#e86a70'), suave(0.2, 0.8, fbm(x * 300, y * 300, z * 300, k.s)) * 0.5);
      c = mix(c, rgb('#e8c060'), (1 - suave(0.05, 0.12, celula(x * 700, y * 700, z * 700, k.s + 1))) * 0.7 * suave(0.1, 0.4, rr));
      c = mix(c, rgb('#ecdcc0'), suave(0.74, 0.8, rr));
      return mix(c, rgb('#4a2442'), suave(0.87, 0.92, rr));
    },
    perfil: (t) => ({ ry: e / 2, rz: (Wf / 2) * larg(t), cy: e / 2 }),
  });
}

type Cobertura = 'nada' | 'tomate' | 'camarao' | 'pera' | 'figo' | 'legumes';

function bruschetta(cob: Cobertura): Gerador {
  return (k) => {
    const s = k.s, H = FATIA.H;
    const out: Parte[] = [parte(fatiaPao(k), 'acetinado', true)];
    const yT = H * 1.0;
    switch (cob) {
      case 'nada':
        break;
      case 'tomate': {
        // tomate em cubinhos com o suco, manjericão em tiras e duas folhas
        for (let i = 0; i < 26; i++) {
          const [x, , z] = sobre(k, 0.78);
          const a = k.r.f(0.006, 0.009);
          const g = caixa(a, a * 0.75, a * k.r.f(0.8, 1.1), (xx, yy, zz) => mix(rgb('#c4241a'), rgb('#e8604a'), suave(0.3, 0.8, fbm(xx * 500, yy * 500, zz * 500, s + i)) * 0.6), { n: 1, m: 8, aneisTampa: 1 });
          tf(g, [x, yT + a * 0.3 + (i > 18 ? a * 0.6 : 0), z], [k.r.f(-0.3, 0.3), k.r.f(0, TAU), k.r.f(-0.3, 0.3)]);
          out.push(parte(g, 'brilhante'));
        }
        for (let i = 0; i < 6; i++) {
          const [x, , z] = sobre(k, 0.6), d = k.r.f(0, TAU), l = 0.012;
          out.push(parte(tubo([V(x - Math.cos(d) * l, yT + 0.008, z - Math.sin(d) * l), V(x, yT + 0.0095, z), V(x + Math.cos(d) * l, yT + 0.008, z + Math.sin(d) * l)], { raio: 0.0012, achata: 0.3, m: 4, n: 6, cor: tom(rgb('#2e6a1e'), 0.15, 600, s) }), 'brilhante'));
        }
        out.push(folhaManjericao(k, 0.026, [-0.012, yT + 0.009, 0.004], 0.4), folhaManjericao(k, 0.022, [0.0, yT + 0.01, -0.002], 2.3));
        break;
      }
      case 'camarao': {
        // rodelas de tomate-cereja vermelhas e amarelas alternadas, um camarão por cima e coentro
        for (let i = 0; i < 8; i++) {
          const fila = i < 4 ? -1 : 1, j = i % 4;
          const x = (j - 1.5) * 0.02 + fila * 0.004, z = fila * 0.011;
          const casca = (i + (fila > 0 ? 1 : 0)) % 2 ? rgb('#f0b818') : rgb('#d0281c');
          const g = rodelaTomate(0.0115, 0.004, casca, s + i);
          tf(g, [x, yT + 0.001 + j * 0.0006, z], [0.12 * fila, k.r.f(0, TAU), 0.1]);
          out.push(parte(g, 'brilhante'));
        }
        out.push(...camarao(k, [0.004, yT + 0.004, 0], 0.3));
        for (let i = 0; i < 5; i++) {
          const g = folha(0.012, 0.012, rgb('#3a8a2a'), rgb('#5aa040'), { contorno: contornos.recortada, concha: 0.2, s: s + i });
          out.push(parte(tf(g, [k.r.f(-0.03, 0.03), yT + 0.011, k.r.f(-0.014, 0.014)], [0, k.r.f(0, TAU), 0]), 'brilhante'));
        }
        break;
      }
      case 'pera': {
        // queijo de cabra espalhado em camada fina, rúcula, fatias finas de pera e meia noz
        const queijo = corpo({
          x0: -FATIA.L * 0.42, x1: FATIA.L * 0.42, n: 18, m: 24, exp: 4,
          cor: (x, y, z) => mul(mix(rgb('#f6f2e8'), rgb('#e8e0cc'), suave(0.3, 0.8, fbm(x * 200, y * 200, z * 200, s)) * 0.5), 0.97 + 0.05 * ruido(x * 2000, y * 2000, z * 2000, s)),
          perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.7; return { ry: 0.0016, rz: Math.max(1e-4, FATIA.W * 0.4 * e), cy: yT + 0.0012 }; },
          mod: (t, a) => 1 + 0.12 * ruido(Math.cos(a) * 3, t * 6, 0.5, s),
          desloc: (p) => { p.y += 0.0012 * fbm(p.x * 150, 0, p.z * 150, s + 3); },
        });
        out.push(parte(queijo, 'fosco'));
        for (let i = 0; i < 4; i++) {
          const g = folha(0.03, 0.012, rgb('#2c5a1c'), rgb('#6a9a4a'), { contorno: contornos.recortada, concha: 0.15, curva: 0.08, ondula: 0.05, s: s + i });
          out.push(parte(tf(g, [k.r.f(-0.028, -0.004), yT + 0.0035 + i * 0.0006, k.r.f(-0.01, 0.01)], [0, k.r.f(-0.8, 0.8) + (i % 2) * PI, 0]), 'acetinado'));
        }
        for (let i = 0; i < 3; i++) {
          const g = fatiaPera(k);
          tf(g, [-0.024 + i * 0.006, yT + 0.006 + i * 0.002, -0.012 + i * 0.011], [0.18, -0.35 + i * 0.3, 0.06]);
          out.push(parte(g, 'brilhante'));
        }
        // meia noz: lobos marrons com sulcos
        const noz = elipsoide(0.012, 0.0055, 0.009, (x, y, z) => mul(mix(rgb('#a8743e'), rgb('#6a4422'), Math.abs(Math.sin(x * 900 + fbm(x * 400, y * 400, z * 400, s) * 3)) ** 3 * 0.7), 1), 8, 12,
          (t, a) => 1 + 0.12 * Math.abs(Math.sin(t * PI * 3)) + 0.06 * Math.sin(a * 6));
        out.push(parte(tf(noz, [0.012, yT + 0.012, 0.002], [0, 0.5, 0]), 'acetinado'));
        break;
      }
      case 'figo': {
        // fatia de presunto dobrada, figos fatiados na vertical, cebolinha em pedaços e pimenta
        const presunto = corpo({
          x0: -FATIA.L * 0.42, x1: FATIA.L * 0.42, n: 30, m: 16, exp: 6,
          cor: (x, y, z) => {
            let c = mix(rgb('#a83a44'), rgb('#8a2e3a'), suave(0.2, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.6);
            c = mix(c, rgb('#f2dcd2'), suave(FATIA.W * 0.22, FATIA.W * 0.3, z));
            return mix(c, rgb('#2a2018'), (1 - suave(0.02, 0.05, celula(x * 800, y * 800, z * 800, s + 5))) * 0.8);
          },
          perfil: (t) => ({ ry: 0.0012, rz: FATIA.W * 0.34 * (0.85 + 0.15 * Math.sin(PI * t)), cy: yT + 0.004 }),
          desloc: (p) => { p.y += 0.0045 * Math.abs(Math.sin(p.x * 95 + p.z * 30)) + 0.002 * Math.sin(p.z * 120); },
        });
        out.push(parte(presunto, 'acetinado'));
        for (let i = 0; i < 3; i++) {
          const g = fatiaFigo(k);
          tf(g, [-0.03 + i * 0.022, yT + 0.011, -0.012 + (i % 2) * 0.012], [0.22, -0.4 + i * 0.4, -0.08]);
          out.push(parte(g, 'umido'));
        }
        for (let i = 0; i < 5; i++) {
          const [x, , z] = sobre(k, 0.65), d = k.r.f(0, TAU), l = 0.01;
          out.push(parte(tubo([V(x - Math.cos(d) * l, yT + 0.013, z - Math.sin(d) * l), V(x + Math.cos(d) * l, yT + 0.014, z + Math.sin(d) * l)], {
            raio: 0.0013, m: 6, n: 3, cor: (xx, yy, zz) => mix(rgb('#3a7a2a'), rgb('#6aa84a'), 0.3 + 0.3 * ruido(xx * 1500, yy * 1500, zz * 1500, s)),
          }), 'brilhante'));
        }
        break;
      }
      case 'legumes': {
        // tiras finas de pimentão tostado, camadas de cebola roxa abertas, azeitona, pinoli,
        // manjericão e lascas de parmesão
        for (let i = 0; i < 7; i++) {
          const [x, , z] = sobre(k, 0.45), d = k.r.f(-0.6, 0.6) + (i % 2) * 0.3, l = k.r.f(0.012, 0.017);
          const base = i % 3 === 2 ? rgb('#e0821a') : rgb('#b81e16');
          out.push(parte(tubo([V(x - Math.cos(d) * l, yT + 0.002, z - Math.sin(d) * l), V(x, yT + 0.0045, z + 0.002), V(x + Math.cos(d) * l, yT + 0.002, z + Math.sin(d) * l)], {
            raio: 0.0034, achata: 0.22, cima: V(0, 1, 0), m: 8, n: 10,
            cor: (xx, yy, zz) => mix(base, rgb('#3a1a10'), (1 - suave(0.04, 0.1, celula(xx * 600, yy * 600, zz * 600, s + i))) * 0.5),
          }), 'brilhante'));
        }
        for (let i = 0; i < 3; i++) {
          const [x, , z] = sobre(k, 0.5), r = 0.012, a0 = k.r.f(0, TAU), pts: THREE.Vector3[] = [];
          for (let j = 0; j <= 6; j++) { const a = a0 + (j / 6) * 2.2; pts.push(V(x + Math.cos(a) * r, yT + 0.006, z + Math.sin(a) * r * 0.7)); }
          out.push(parte(tubo(pts, { raio: 0.0028, achata: 0.3, cima: V(0, 1, 0), m: 6, n: 14, cor: (xx, yy) => mix(rgb('#f2e4ec'), rgb('#7a2a5a'), suave(yT + 0.0055, yT + 0.0065, yy)) }), 'brilhante'));
        }
        for (let i = 0; i < 4; i++) {
          const [x, , z] = sobre(k, 0.6);
          out.push(parte(tf(elipsoide(0.0062, 0.0045, 0.0046, tom(rgb('#2a1a22'), 0.2, 300, s + i), 6, 10), [x, yT + 0.0075, z], [0, k.r.f(0, TAU), 0]), 'brilhante'));
        }
        for (let i = 0; i < 9; i++) {
          const [x, , z] = sobre(k, 0.65);
          out.push(parte(tf(elipsoide(0.0035, 0.0014, 0.0018, () => rgb('#efe0b4'), 3, 6), [x, yT + 0.008, z], [0, k.r.f(0, TAU), 0]), 'acetinado'));
        }
        out.push(folhaManjericao(k, 0.018, [-0.02, yT + 0.01, 0.006], 0.9), folhaManjericao(k, 0.016, [0.018, yT + 0.01, -0.008], 3.6));
        for (let i = 0; i < 3; i++) {
          const g = caixa(0.016, 0.0008, 0.011, (x, y, z) => mul(rgb('#efe2a8'), 0.95 + 0.08 * fbm(x * 400, y * 400, z * 400, s + i)), { exp: 3, n: 2, m: 10, aneisTampa: 1 });
          out.push(parte(tf(g, [k.r.f(-0.025, 0.025), yT + 0.011 + i * 0.001, k.r.f(-0.01, 0.01)], [k.r.f(-0.25, 0.25), k.r.f(0, TAU), k.r.f(-0.2, 0.2)]), 'acetinado'));
        }
        break;
      }
    }
    return out;
  };
}

/* ------------------------------------------------------------------ */
/* rosquinhas e bagel crus                                              */
/* ------------------------------------------------------------------ */

// massa crua: clara, fosca, com farinha; a cor cozida é a da rosquinha assada
const CRUA = { c1: '#e6d0a6', c2: '#efe0c2', ci: '#f4e8d0', cc: '#c27a2a', ac: 'fosco' as const, d: 'crua' };

export const LOTE: Lote = {
  // sushi
  'alga-nori': { visual: vis('placa', 'folha', 0.21, '141c14 26361f 1e2a1a 1a2418', { a: 0.003, l: 0.9, ac: 'acetinado' }), gerar: gAlgaNori },
  'c5-nori-arroz': { visual: vis('placa', 'c5-nori-arroz', 0.2, '141c14 f3f0e8 f3f0e8 1a2418', { a: 0.04, l: 0.5, ac: 'acetinado' }), gerar: gNoriArroz },
  'c5-nori-arroz-atum': { visual: vis('placa', 'c5-nori-arroz-atum', 0.2, '141c14 a81e2c f3f0e8 1a2418', { a: 0.1, l: 0.5, ac: 'acetinado' }), gerar: gNoriArrozAtum },
  'c5-maki-rolo': { visual: vis('placa', 'c5-maki-rolo', 0.2, '141c14 f3f0e8 f3f0e8 1a2418 a81e2c', { a: 0.13, l: 0.13, ac: 'acetinado' }), gerar: gMakiRolo },
  'c5-maki-rodela': { visual: vis('placa', 'c5-maki-rodela', 0.026, '141c14 f3f0e8 f3f0e8 1a2418 a81e2c', { a: 0.8, l: 1, ac: 'acetinado' }), gerar: gMakiRodela },
  // pão-de-ló de cacau
  'c5-pao-de-lo-cacau': { visual: vis('bolo', 'cilindro', 0.2, '5a3422 3a2014 6e4630 4a2a18', { a: 0.28, d: 'crosta', ac: 'fosco' }), gerar: gPaoDeLoCacau },
  'c5-pao-de-lo-cacau-disco': { visual: vis('bolo', 'cilindro', 0.2, '4e2e1e 3a2014 5a3826 3e2416', { a: 0.1, ac: 'fosco' }), gerar: gPaoDeLoCacau },
  // torrada e bruschettas
  'c5-torrada-grelhada': { visual: vis('pao', 'c5-torrada-grelhada', 0.11, 'c99048 86501f e8d2a0 a86a2a', { a: 0.13, l: 0.66 }), gerar: bruschetta('nada') },
  'c5-bruschetta-tomate': { visual: vis('pao', 'c5-bruschetta-tomate', 0.11, 'c99048 86501f e8d2a0 a86a2a c4241a', { a: 0.25, l: 0.66 }), gerar: bruschetta('tomate') },
  'c5-bruschetta-camarao': { visual: vis('pao', 'c5-bruschetta-camarao', 0.11, 'c99048 86501f e8d2a0 a86a2a d0281c', { a: 0.3, l: 0.66 }), gerar: bruschetta('camarao') },
  'c5-bruschetta-pera-cabra': { visual: vis('pao', 'c5-bruschetta-pera-cabra', 0.11, 'c99048 86501f e8d2a0 a86a2a f6f2e8', { a: 0.3, l: 0.66 }), gerar: bruschetta('pera') },
  'c5-bruschetta-parma-figo': { visual: vis('pao', 'c5-bruschetta-parma-figo', 0.11, 'c99048 86501f e8d2a0 a86a2a c4505a', { a: 0.3, l: 0.66 }), gerar: bruschetta('figo') },
  'c5-bruschetta-legumes': { visual: vis('pao', 'c5-bruschetta-legumes', 0.11, 'c99048 86501f e8d2a0 a86a2a b81e16', { a: 0.25, l: 0.66 }), gerar: bruschetta('legumes') },
  // massa crua das rosquinhas e do bagel
  'c5-rosca-palmier-crua': { visual: { f: 'pao', v: 'rosca-palmier', t: 0.075, ...CRUA }, gerar: gRosca },
  'c5-rosca-caracol-crua': { visual: { f: 'pao', v: 'rosca-caracol', t: 0.07, ...CRUA }, gerar: gRosca },
  'c5-rosca-tourelle-crua': { visual: { f: 'pao', v: 'rosca-tourelle', t: 0.066, ...CRUA }, gerar: gRosca },
  'c5-rosca-parker-house-crua': { visual: { f: 'pao', v: 'rosca-parker-house', t: 0.07, ...CRUA }, gerar: gRosca },
  'c5-rosca-colheita-crua': { visual: { f: 'pao', v: 'rosca-colheita', t: 0.075, ...CRUA }, gerar: gRosca },
  'c5-rosca-no-cru': { visual: { f: 'pao', v: 'rosca-no', t: 0.07, ...CRUA }, gerar: gRosca },
  'c5-bagel-cru': { visual: vis('pao', 'bagel', 0.085, 'e6d0a6 efe0c2 f4e8d0 c0802e', { a: 0.28, ac: 'fosco' }), gerar: gPao },
  'c5-bagel-escaldado': { visual: vis('pao', 'bagel', 0.09, 'e2c896 ecd8b0 f4e8d0 c0802e', { a: 0.33, ac: 'brilhante' }), gerar: gPao },
};
