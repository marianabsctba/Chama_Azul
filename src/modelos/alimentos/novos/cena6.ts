// Sobremesas e confeitaria refeitas pela revisão 11 (cena6):
// - rocambole fatiado (tora com a ponta em diagonal e duas fatias com a espiral para cima) e a folha
//   de pão-de-ló recheada antes de enrolar;
// - granita em cristais raspados (monte granuloso) e a camada raspada que cobre a assadeira;
// - tuiles: rodelas cruas espalhadas na assadeira, lace tuile plana e curva rendadas, brandy snap
//   enrolado como charuto rendado; pennants de maracujá em triângulos compridos com sementes;
// - croquembouche montado de ponta-cabeça dentro do cone (o desenformar vira e ele fica em pé);
// - tortas de tampa inteira pincelada de gema, bolo em camadas todo coberto, bolo de chantilly
//   pronto, cheesecakes lisos (assado dourado e gelado rosa) sem nada no centro;
// - pudim de arroz com os grãos aparentes (cozido em monte e assado com a pele dourada);
// - operetta em placa com as camadas na lateral e a folhinha de ouro para decorar;
// - strudel reto, ainda cru, antes de virar ferradura.
// Os ids sem prefixo (granita, lace-tuile, brandy-snap, pennant-maracuja, arroz_pudding, operetta,
// cheesecake-gelado, cheesecake-assado) já existiam na tabela visual com o desenho genérico da
// família; aqui ganham gerador próprio, e o nome continua o do catálogo.
import * as THREE from 'three';
import {
  corpo, torno, tornoAnel, elipsoide, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { disco, type Gerador } from '../pecas';
import { gChoux } from '../fam_doces';
import { vis, chapa, bloco } from './frutas_enfeites';
import { toraRocambole, fatiaRocambole, telhaCurva } from './cena4';
import { gTortaCrua, gBoloChantilly } from './doces';
import type { Lote } from './tipos';

/* ------------------------------------------------------------------ */
/* utilidades                                                           */
/* ------------------------------------------------------------------ */

const frac = (v: number) => v - Math.floor(v);
const hash = (i: number, s = 0) => frac(Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453);
const pinta = (x: number, y: number, z: number, f: number, tam: number, s: number) => 1 - suave(tam * 0.6, tam, celula(x * f, y * f, z * f, s));
const cl = (c: RGB): RGB => [clamp(c[0]), clamp(c[1]), clamp(c[2])];

/* ------------------------------------------------------------------ */
/* rocambole                                                            */
/* ------------------------------------------------------------------ */

const gRocamboleFatiado: Gerador = (k) => {
  // rocambole servido: a tora com a ponta aparada em diagonal virada para a frente e duas fatias
  // deitadas na frente, com a espiral de pão-de-ló, pele dourada e recheio branco para cima
  const { s } = k;
  const R = 0.036;
  const tora = toraRocambole(0.15, R, s, 0.75);
  tora.translate(-0.045, 0, 0);
  const out: Parte[] = [parte(tora, 'fosco', true)];
  const fatias: [number, number][] = [[0.098, -0.008], [0.058, 0.074]];
  fatias.forEach(([x, z], i) => {
    for (const g of fatiaRocambole(R, 0.017, s + i)) {
      g.rotateY(i * 1.3);
      g.translate(x, 0, z);
      out.push(parte(g, 'fosco', true));
    }
  });
  return out;
};

const gPaoDeLoRecheado: Gerador = (k) => {
  // folha de pão-de-ló sobre o papel açucarado, já com o recheio branco espalhado por igual até
  // 1 cm das bordas e o vinco a 2 cm da borda curta, por onde a massa começa a enrolar
  const { s } = k;
  const Lx = 0.28, Lz = 0.2, h = 0.011;
  const esponja = bloco(Lx, h, Lz, (x, y, z) => {
    if (y > h / 2 - 1e-4) {
      const vinco = 1 - suave(0.0008, 0.0025, Math.abs(x - (-Lx / 2 + 0.02)));
      return mix(mix(rgb('#d8a048'), rgb('#e8c070'), suave(0.3, 0.8, fbm(x * 40, 0, z * 40, s)) * 0.7), rgb('#a86a2a'), vinco * 0.8);
    }
    return mix(rgb('#f4dc98'), rgb('#e8c878'), pinta(x, y, z, 900, 0.3, s) * 0.5);
  }, [28, 2, 20]);
  esponja.translate(0, h / 2 + 0.0006, 0);
  const papel = bloco(Lx + 0.03, 0.0006, Lz + 0.03, (x, y, z) => mix(mix(rgb('#f2eee4'), rgb('#fdfcf8'), suave(0.4, 0.8, fbm(x * 80, 0, z * 80, s + 1))), rgb('#ffffff'), pinta(x, y, z, 500, 0.3, s + 2) * 0.6), [10, 1, 8]);
  papel.translate(0, 0.0003, 0);
  // recheio: placa de bordas arredondadas, com a superfície marcada pela espátula
  const Lr = Lx - 0.05, Wr = Lz - 0.02, hr = 0.0045;
  const recheio = corpo({
    x0: -Lr / 2, x1: Lr / 2, n: 30, m: 40, exp: 6, tampa: true, linear: true,
    perfil: () => ({ ry: hr / 2, rz: Wr / 2, cy: hr / 2 }),
    desloc: (p) => { if (p.y > hr * 0.6) p.y += 0.0012 * (0.5 + 0.5 * Math.sin(p.x * 70 + 3 * fbm(p.x * 20, 0, p.z * 20, s))) * fbm(p.x * 30, 0, p.z * 30, s + 4); },
    cor: (x, y, z) => mul(rgb('#fdf9ee'), 0.95 + 0.05 * fbm(x * 90, y * 90, z * 90, s + 3)),
  });
  recheio.translate(0.012, h + 0.0005, 0);
  return [parte(esponja, 'fosco', true), parte(papel, 'fosco'), parte(recheio, 'acetinado')];
};

/* ------------------------------------------------------------------ */
/* granita                                                              */
/* ------------------------------------------------------------------ */

const CAFE: RGB[] = [rgb('#2e1c10'), rgb('#4a2e1a'), rgb('#62402a'), rgb('#86644c'), rgb('#a8907e')];

/** Lasca de gelo raspado: bipirâmide irregular de 16 triângulos, tom de café que clareia na geada. */
function lasca(tam: number, s: number, i: number): THREE.BufferGeometry {
  const t = hash(i, 7);
  const c = t < 0.15 ? CAFE[0] : t < 0.42 ? CAFE[1] : t < 0.7 ? CAFE[2] : t < 0.9 ? CAFE[3] : CAFE[4];
  const g = elipsoide(tam * (0.7 + 0.6 * hash(i, 1)), tam * (0.3 + 0.3 * hash(i, 2)), tam * (0.5 + 0.5 * hash(i, 3)), (x, y, z) => mul(c, 0.9 + 0.25 * ruido(x * 2000, y * 2000, z * 2000, s + i)), 3, 4);
  g.rotateX(hash(i, 4) * TAU);
  g.rotateY(hash(i, 5) * TAU);
  g.rotateZ(hash(i, 6) * TAU);
  return g;
}

const gGranita: Gerador = (k) => {
  // granita de café raspada com o garfo: monte baixo e granuloso de cristais soltos, marrom-escuro
  // com lascas mais claras de geada, sem nenhuma superfície lisa
  const { s } = k;
  const R = 0.055, H = 0.034, l = 0.82;
  // altura do monte de base (o mesmo perfil do torno abaixo), onde as lascas se assentam
  const alt = (r: number) => (r >= 1 ? 0 : H * 0.8 * Math.sqrt(1 - r ** 2.4));
  const altura = (x: number, z: number) => alt(Math.hypot(x / (R * 0.9), z / (R * 0.9 * l)));
  const out: Parte[] = [parte(torno({
    caminho: (u) => (u < 0.25 ? [R * 0.9 * (u / 0.25), 0] : [R * 0.9 * (1 - (u - 0.25) / 0.75), alt(1 - (u - 0.25) / 0.75)]),
    n: 16, m: 30, l,
    desloc: (p) => { p.y += 0.003 * ruido(p.x * 300, p.y * 300, p.z * 300, s); if (p.y < 0) p.y = 0; },
    cor: (x, y, z) => {
      const c = celula(x * 600, y * 600, z * 600, s);
      return mix(mix(CAFE[2], CAFE[0], suave(0.3, 0.75, c)), CAFE[4], (1 - suave(0.1, 0.3, c)) * 0.7);
    },
  }), 'acetinado', true)];
  for (let i = 0; i < 340; i++) {
    const rr = Math.sqrt(hash(i, 11)) * 0.97, a = hash(i, 12) * TAU;
    const x = Math.cos(a) * rr * R * 0.92, z = Math.sin(a) * rr * R * l * 0.92;
    const tam = 0.0034 + 0.003 * hash(i, 13);
    const g = lasca(tam, s, i);
    g.translate(x, Math.max(0.0015, altura(x, z) + tam * (0.1 + 0.4 * hash(i, 14))), z);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

const gGranitaAssadeira: Gerador = (k) => {
  // café congelado cobrindo o fundo da assadeira, já esmagado e raspado: camada fina e granulosa com
  // sulcos do garfo e montinhos de cristais soltos
  const { s } = k;
  const Lx = 0.33, Lz = 0.21, h = 0.006;
  const out: Parte[] = [parte(corpo({
    x0: -Lx / 2, x1: Lx / 2, n: 24, m: 28, exp: 10, tampa: true, linear: true,
    perfil: () => ({ ry: h / 2, rz: Lz / 2, cy: h / 2 }),
    desloc: (p) => { if (p.y > h * 0.6) p.y += 0.0025 * Math.abs(Math.sin(p.z * 160 + 2 * fbm(p.x * 30, 0, p.z * 30, s))) + 0.0015 * ruido(p.x * 200, 0, p.z * 200, s); },
    cor: (x, y, z) => {
      const c = celula(x * 450, y * 450, z * 450, s);
      return mix(mix(CAFE[2], CAFE[0], suave(0.3, 0.75, c)), CAFE[4], (1 - suave(0.1, 0.3, c)) * 0.6 * suave(h * 0.5, h, y));
    },
  }), 'acetinado', true)];
  for (let i = 0; i < 300; i++) {
    const x = (hash(i, 21) - 0.5) * Lx * 0.94, z = (hash(i, 22) - 0.5) * Lz * 0.92;
    const g = lasca(0.0035 + 0.003 * hash(i, 23), s, i + 400);
    g.translate(x, h + 0.0015 + 0.002 * hash(i, 24), z);
    out.push(parte(g, 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* tuiles, lace tuiles, brandy snaps e pennants                          */
/* ------------------------------------------------------------------ */

const gTuileRodelas: Gerador = (k) => {
  // seis rodelas finas de 5 cm de massa de tuile espalhadas com o garfo na assadeira, bem separadas,
  // com os riscos do garfo na superfície e a borda um pouco mais fina
  const { s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 6; i++) {
    const R = 0.025 * (0.96 + 0.08 * hash(i, 1));
    const ang = hash(i, 2) * PI;
    const g = disco(R, 0.0013, (x, y, z) => {
      const risco = Math.abs(Math.sin((x * Math.cos(ang) + z * Math.sin(ang)) * 900 + 2 * fbm(x * 90, 0, z * 90, s + i))) ** 6;
      const c = mix(rgb('#f2e2b6'), rgb('#e2c88e'), risco * 0.6 + 0.3 * suave(R * 0.75, R, Math.hypot(x, z)));
      return mul(c, 0.96 + 0.06 * fbm(x * 200, y * 200, z * 200, s + i));
    }, { n: 6, m: 30, borda: 0.8, mod: (t, a) => 1 + 0.03 * Math.sin(a * 5 + i) + 0.02 * Math.sin(a * 11 + i * 2) });
    g.translate(((i % 3) - 1) * 0.075, 0, (Math.floor(i / 3) - 0.5) * 0.07);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

/** Renda de caramelo: fios mais escuros em volta dos furinhos claros (r = 0 no centro, 1 na borda). */
function renda(x: number, z: number, r: number, s: number, escuro: RGB, claro: RGB): RGB {
  // os furos são o miolo das células; os fios de caramelo, as bordas entre elas
  const fio = suave(0.62, 0.82, celula(x * 170, 0.5, z * 170, s));
  const c = mix(claro, escuro, fio);
  // borda mais tostada
  return mul(mix(c, mul(escuro, 0.8), suave(0.75, 1, r) * 0.6), 0.95 + 0.08 * fbm(x * 300, 0, z * 300, s));
}

const RENDA_ESC = rgb('#9a5216'), RENDA_CLA = rgb('#f2d79a');

const gLaceTuile: Gerador = (k) => {
  // lace tuile de laranja assada e ainda plana: disco fino e rendado, de borda recortada, com os
  // furinhos que a massa abre no forno
  return [parte(telhaCurva(0.036, 6, k.s, (x, _y, z, r) => renda(x, z, r, k.s, RENDA_ESC, RENDA_CLA), 0.07, [44, 30]), 'brilhante', true)];
};

const gLaceTuileCurva: Gerador = (k) => {
  // lace tuile curvada sobre o rolo ainda quente: telha rendada em arco, vista de frente
  return [parte(telhaCurva(0.036, 0.028, k.s, (x, _y, z, r) => renda(x, z, r, k.s, RENDA_ESC, RENDA_CLA), 0.07, [44, 30]), 'brilhante', true)];
};

const gBrandySnap: Gerador = (k) => {
  // brandy snap: biscoito rendado enrolado no cabo da colher, um charuto oco de 9 cm com a volta e
  // meia da folha aparecendo nas pontas e os furinhos da renda por toda a casca
  const { s } = k;
  const L = 0.09, r0 = 0.0105, voltas = 1.4;
  return [parte(chapa(26, 44, (u, v, lado) => {
    const th = ((v + 1) / 2) * voltas * TAU;
    const r = r0 * (0.8 + 0.2 * th / (voltas * TAU)) + (lado ? 0.00035 : -0.00035);
    const borda = 0.0018 * fbm(th * 3, u * 4, 0, s);
    const x = lerp(-L / 2 + borda, L / 2 - borda, u);
    return [x, r0 + r * Math.sin(th + 0.6), r * Math.cos(th + 0.6)];
  }, (x, y, z, u, v, lado) => {
    const c = renda(x, ((v + 1) / 2) * voltas * TAU * r0, Math.abs(2 * u - 1) * 0.6, s, rgb('#9a5014'), rgb('#e8b868'));
    return lado ? c : mul(c, 0.85);
  }), 'brilhante', true)];
};

/**
 * Pennant: triângulo comprido de massa de tuile (base em -X, ponta em +X), largura Wb na base.
 * Com Rb > 0, dobrado sobre o rolo (arco ao longo de X).
 */
function pennant(Lp: number, Wb: number, Rb: number, s: number, cor: (x: number, y: number, z: number) => RGB): THREE.BufferGeometry {
  const ang = Rb > 0 ? Lp / 2 / Rb : 0;
  return chapa(26, 8, (u, v, lado) => {
    const xd = lerp(-Lp / 2, Lp / 2, u);
    const meia = (Wb / 2) * (1 - u * 0.97) * (1 + 0.025 * Math.sin(u * 19 + s));
    const zd = v * meia;
    const e = lado ? 0.0005 : -0.0005;
    if (Rb <= 0) return [xd, 0.0006 + e, zd];
    const th = xd / Rb, rr = Rb + e;
    return [rr * Math.sin(th), rr * Math.cos(th) - Rb * Math.cos(ang) + 0.0006, zd];
  }, (x, y, z) => cor(x, y, z));
}

/** Massa de pennant com sementes pretas de maracujá; `assado` doura as bordas. */
function corPennant(s: number, assado: boolean): (x: number, y: number, z: number) => RGB {
  return (x, y, z) => {
    let c = assado ? mix(rgb('#ecc878'), rgb('#c88a38'), suave(0.3, 0.8, fbm(x * 120, y * 120, z * 120, s)) * 0.5) : mix(rgb('#f0dcae'), rgb('#e6cc92'), fbm(x * 120, y * 120, z * 120, s) * 0.5 + 0.5);
    // sementes pretas com o halo de polpa
    const cel = celula(x * 230, 0, z * 230, s + 7);
    const sem = 1 - suave(0.36, 0.48, cel);
    c = mix(c, assado ? rgb('#b0782a') : rgb('#d8b060'), (1 - suave(0.42, 0.6, cel)) * 0.5);
    return mix(c, rgb('#120e0a'), sem);
  };
}

const gPennant: Gerador = (k) => {
  // pennant de maracujá assado e curvado no rolo: triângulo comprido e fino (11 cm por 3,5 cm na
  // base), dourado, salpicado de sementes pretas, em arco
  const g = pennant(0.11, 0.035, 0.075, k.s, (x, y, z) => {
    const c = corPennant(k.s, true)(x, y, z);
    return mix(c, rgb('#9a5e1e'), suave(0.012, 0.0175, Math.abs(z)) * 0.6);
  });
  // meio de lado, para o arco e o triângulo aparecerem juntos
  g.rotateY(0.55);
  return [parte(g, 'acetinado', true)];
};

const gPennantsAssadeira: Gerador = (k) => {
  // seis bandeirinhas de pasta de estêncil com sementes de maracujá, retas na assadeira, de pontas
  // alternadas, prontas para o forno
  const { s } = k;
  const out: Parte[] = [];
  for (let i = 0; i < 6; i++) {
    const g = pennant(0.11, 0.035, 0, s + i, corPennant(s + i, false));
    if (i % 2) g.rotateY(PI);
    g.translate(0, 0, (i - 2.5) * 0.04);
    out.push(parte(g, 'acetinado', true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* bolos cobertos e cheesecakes                                         */
/* ------------------------------------------------------------------ */

const gBoloCamadasCoberto: Gerador = (k) => {
  // bolo em camadas todo coberto: creme alisado no topo e em toda a lateral, com as marcas da
  // espátula em espiral por cima e um cordão de conchinhas na borda de cima e na base
  const { c1, s } = k;
  const R = 0.1, H = 0.095;
  const creme: CorFn = (x, y, z) => {
    const rr = Math.hypot(x, z), th = Math.atan2(z, x);
    return mul(c1, 0.96 + 0.04 * fbm(x * 60, y * 60, z * 60, s) - (y > H * 0.97 ? 0.05 * Math.abs(Math.sin(rr * 150 + th * 2)) ** 3 : 0));
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R + 0.003, 0.004], [R + 0.003, H - 0.007], [R - 0.003, H - 0.0005], [R - 0.012, H], [0, H * 1.003]],
    n: 16, m: 56, cor: creme,
    mod: (t, a) => 1 + 0.004 * fbm(Math.cos(a) * 3, t * 5, Math.sin(a) * 3, s),
  }), k.ac, true)];
  const cordao = (rc: number, yc: number, rs: number) => {
    const cam: [number, number][] = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; cam.push([rc + Math.cos(a) * rs, yc + Math.sin(a) * rs]); }
    return tornoAnel({ caminho: cam, n: 8, m: 120, cor: creme, mod: (t, a) => 1 + (0.035 * rs / rc) * Math.abs(Math.sin(a * 30)) });
  };
  out.push(parte(cordao(R - 0.007, H + 0.002, 0.0055), k.ac));
  out.push(parte(cordao(R + 0.004, 0.0045, 0.0045), k.ac));
  return out;
};

const gCheesecake: Gerador = (k) => {
  // cheesecake desenformado: base de biscoito esfarelado embaixo, creme liso e alto, topo liso
  // (assado: dourado, mais escuro na beirada; gelado: rosa com veios de framboesa). Nada no centro.
  const { c1, c2, c3, s } = k;
  const gelado = k.tem('gelado');
  const R = k.T / 2, H = R * 0.55, hb = 0.012;
  const cor: CorFn = (x, y, z) => {
    const rr = Math.hypot(x, z) / R;
    if (y < hb) {
      // farelo de biscoito: grânulos marrons de tons diferentes
      const cel = celula(x * 420, y * 420, z * 420, s);
      return mul(mix(c3, mul(c3, 0.7), suave(0.2, 0.7, cel)), 0.95 + 0.1 * ruido(x * 900, y * 900, z * 900, s));
    }
    if (y < H * 0.985) {
      // lateral de creme: alisada pelo aro, um pouco mais corada perto do topo no assado
      return mul(mix(c2, c1, gelado ? 0.2 : suave(H * 0.75, H, y) * 0.5), 0.97 + 0.04 * fbm(x * 70, y * 70, z * 70, s));
    }
    let c = mul(c1, 0.97 + 0.05 * fbm(x * 50, 0, z * 50, s));
    if (gelado) {
      const veio = Math.abs(Math.sin(Math.atan2(z, x) * 2 + rr * 9 + 3 * fbm(x * 25, 0, z * 25, s + 2))) ** 10;
      c = mix(c, rgb('#c8506a'), veio * 0.7);
    } else c = mix(c, mul(c1, 0.72), suave(0.72, 1, rr) * 0.8);
    return c;
  };
  return [parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.003], [R, H - 0.004], [R * 0.985, H - 0.0005], [R * 0.6, H], [0, H * (gelado ? 1 : 1.01)]],
    n: 18, m: 56, cor,
    mod: (t, a) => 1 + 0.004 * fbm(Math.cos(a) * 3, t * 6, Math.sin(a) * 3, s),
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* pudim de arroz                                                       */
/* ------------------------------------------------------------------ */

/** Grão de arroz cozido, macio e inchado. */
function graoArroz(i: number, s: number, cor: RGB): THREE.BufferGeometry {
  const g = elipsoide(0.0032 + 0.0006 * hash(i, 1), 0.0013, 0.00135, (x, y, z) => mul(cor, 0.94 + 0.08 * ruido(x * 3000, y * 3000, z * 3000, s + i)), 3, 5);
  g.rotateZ((hash(i, 2) - 0.5) * 0.8);
  g.rotateY(hash(i, 3) * TAU);
  return g;
}

const gArrozPudding: Gerador = (k) => {
  // arroz-doce cremoso: monte de grãos de arroz inchados e brancos, bem visíveis, presos num creme
  // de leite um pouco mais amarelado, com pontinhos de baunilha
  const { s } = k;
  const R = 0.045, H = 0.022;
  const alt = (r: number) => (r >= 1 ? 0 : H * Math.sqrt(1 - r ** 2.2));
  const out: Parte[] = [parte(torno({
    caminho: (u) => (u < 0.25 ? [R * (u / 0.25), 0] : [R * (1 - (u - 0.25) / 0.75), alt(1 - (u - 0.25) / 0.75)]),
    n: 16, m: 30,
    cor: (x, y, z) => mix(mul(rgb('#dcc28c'), 0.95 + 0.06 * fbm(x * 90, y * 90, z * 90, s)), rgb('#2a1a10'), pinta(x, y, z, 700, 0.18, s + 3) * 0.8),
  }), 'acetinado', true)];
  for (let i = 0; i < 150; i++) {
    const rr = Math.sqrt(hash(i, 11)) * 0.94, a = hash(i, 12) * TAU;
    const x = Math.cos(a) * rr * R, z = Math.sin(a) * rr * R;
    const g = graoArroz(i, s, rgb('#fffbf2'));
    g.translate(x, alt(rr) + 0.0004, z);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gPudimArrozAssado: Gerador = (k) => {
  // pudim de arroz assado visto na cumbuca: a pele dourada da manteiga derretida e do leite, com
  // manchas tostadas, os grãos de arroz marcando a superfície e a noz-moscada ralada por cima
  const { s } = k;
  const R = 0.065, H = 0.012;
  const pele: CorFn = (x, y, z) => {
    let c = mix(rgb('#e0b468'), rgb('#b07432'), suave(0.2, 0.8, 0.5 + 0.5 * fbm(x * 45, 0, z * 45, s)) * 0.85);
    c = mix(c, rgb('#9a5e26'), (1 - suave(0.1, 0.28, celula(x * 70, 0, z * 70, s + 1))) * 0.55);
    c = mix(c, rgb('#5a3420'), pinta(x, y, z, 800, 0.2, s + 2) * 0.9);
    return mix(c, rgb('#d8a050'), suave(R * 0.85, R, Math.hypot(x, z)) * 0.5);
  };
  const out: Parte[] = [parte(torno({
    caminho: [[0, 0], [R * 0.98, 0], [R, 0.004], [R * 0.98, H * 0.8], [R * 0.7, H * 0.98], [0, H]],
    n: 12, m: 40, cor: pele,
    desloc: (p) => { if (p.y > H * 0.6) p.y += 0.0007 * ruido(p.x * 500, 0, p.z * 500, s); },
  }), 'acetinado', true)];
  for (let i = 0; i < 80; i++) {
    const rr = Math.sqrt(hash(i, 21)) * 0.9 * R, a = hash(i, 22) * TAU;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const g = graoArroz(i, s, mix(rgb('#f0dca8'), rgb('#d8aa62'), hash(i, 23)));
    g.translate(x, H * 0.99 + 0.0002, z);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* operetta                                                             */
/* ------------------------------------------------------------------ */

const gOperettaPlaca: Gerador = (k) => {
  // placa de operetta montada: camadas finas de pão-de-ló embebido, ganache escura e creme de
  // manteiga de café bem marcadas na lateral, e o fondant de chocolate liso e brilhante por cima
  const { s } = k;
  const Lx = 0.2, Lz = 0.15, H = 0.028;
  const camadas: [number, RGB][] = [[0.005, rgb('#c89a58')], [0.007, rgb('#3a1e12')], [0.0095, rgb('#d8bc8c')], [0.0145, rgb('#c89a58')], [0.0165, rgb('#3a1e12')], [0.019, rgb('#d8bc8c')], [0.024, rgb('#c89a58')], [0.03, rgb('#3a1e12')]];
  const corpoO = bloco(Lx, H, Lz, (x, y, z) => {
    const yy = y + H / 2;
    const c = (camadas.find(([lim]) => yy <= lim) ?? camadas[camadas.length - 1])[1];
    return mul(c, 0.95 + 0.08 * fbm(x * 300, y * 300, z * 300, s));
  }, [4, 28, 4]);
  corpoO.translate(0, H / 2, 0);
  const fondant = bloco(Lx * 1.003, 0.0022, Lz * 1.003, (x, y, z) => mix(rgb('#24120a'), rgb('#3a2014'), suave(0.4, 0.8, fbm(x * 40, 0, z * 40, s)) * 0.4), [6, 1, 6]);
  fondant.translate(0, H + 0.0011, 0);
  return [parte(corpoO, 'acetinado', true), parte(fondant, 'brilhante')];
};

const gFolhaOuro: Gerador = (k) => {
  // pedacinho de folha de ouro amassada, para pôr em cima de cada operetta
  const { s } = k;
  const g = disco(0.006, 0.0008, (x, y, z) => mix(rgb('#d8a830'), rgb('#f8e070'), suave(0.3, 0.8, fbm(x * 900, y * 900, z * 900, s))), { n: 4, m: 14, mod: (t, a) => 0.7 + 0.3 * Math.abs(Math.sin(a * 3.5 + s)) + 0.1 * Math.sin(a * 9) });
  return [parte(g, 'brilhante', true)];
};

/* ------------------------------------------------------------------ */
/* strudel reto                                                         */
/* ------------------------------------------------------------------ */

const gStrudelReto: Gerador = (k) => {
  // strudel recém-enrolado pelo lado longo, ainda reto e cru: massa esticada fina, quase
  // translúcida, deixando ver o volume irregular do recheio de maçã, emenda por baixo e a espiral de
  // massa e maçã nas pontas
  const { s } = k;
  const L = 0.3, ry = 0.021, rz = 0.031;
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 36, tampa: true, aneisTampa: 10, linear: true,
    perfil: (t) => { const p = 1 - 0.15 * suave(0.06, 0, Math.min(t, 1 - t)); return { ry: ry * p, rz: rz * p, cy: ry }; },
    mod: (t, a) => 1 + 0.06 * fbm(t * 14, Math.cos(a) * 2, Math.sin(a) * 2, s) * (Math.sin(a) > -0.3 ? 1 : 0.3),
    desloc: (p) => { if (p.y < ry * 0.15) p.y = ry * 0.15 - (ry * 0.15 - p.y) * 0.25; },
    cor: (x, y, z) => {
      const c = mix(rgb('#f0e0bc'), rgb('#d8bc84'), suave(0.2, 0.8, fbm(x * 40, y * 40, z * 40, s)) * 0.6);
      // dobrinhas da massa fina
      return mul(c, 1 - 0.08 * Math.abs(Math.sin(x * 260 + 4 * fbm(x * 20, y * 20, z * 20, s + 1))) ** 8);
    },
    corTampa: (x, y, z) => {
      const u = (y - ry) / ry, w = z / rz;
      const r = Math.hypot(u, w), a = Math.atan2(u, w);
      if (r > 0.9) return rgb('#ead6aa');
      const f = frac(r * 2.4 - a / TAU);
      if (r > 0.1 && f < 0.18) return rgb('#f2e4c2');
      return cl(mix(rgb('#d8b46a'), rgb('#b8823a'), suave(0.4, 0.8, fbm(y * 300, z * 300, 0, s + 2))));
    },
  }), 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* registro                                                             */
/* ------------------------------------------------------------------ */

const CHEESE_ASSADO = vis('bolo', 'cheesecake-assado', 0.22, 'ecd2a0 f3e4bc f6e8c0 d8a856 a8743a', { d: 'assado', ac: 'acetinado' });
const CHEESE_GELADO = vis('bolo', 'cheesecake-gelado', 0.2, 'f0b8c4 f4d0d6 f4d8dc d8a0a8 a8743a', { d: 'gelado', ac: 'acetinado' });

export const LOTE: Lote = {
  'c6-rocambole-fatiado': { visual: vis('bolo', 'c6-rocambole-fatiado', 0.25, 'c88a40 a86a2a f4d88a b87a30'), gerar: gRocamboleFatiado },
  'c6-pao-de-lo-recheado': { visual: vis('bolo', 'c6-pao-de-lo-recheado', 0.3, 'd8a048 e8c070 f4dc98 b87a30'), gerar: gPaoDeLoRecheado },
  granita: { visual: vis('recipiente', 'granita', 0.11, '4a2e1c 6a4a30 6a4a30 4a3020', { a: 0.3, l: 0.82, ac: 'acetinado' }), gerar: gGranita },
  'c6-granita-assadeira': { visual: vis('recipiente', 'c6-granita-assadeira', 0.33, '4a2e1c 6a4a30 6a4a30 4a3020', { a: 0.04, l: 0.64, ac: 'acetinado' }), gerar: gGranitaAssadeira },
  'c6-tuile-rodelas': { visual: vis('confeito', 'c6-tuile-rodelas', 0.2, 'f2e2b6 e2c88e f2e2b6 c88a3a'), gerar: gTuileRodelas },
  'lace-tuile': { visual: vis('confeito', 'lace-tuile', 0.072, 'd8a040 b87a20 f0d080 a86a20', { a: 0.02, ac: 'brilhante' }), gerar: gLaceTuile },
  'c6-lace-tuile-curva': { visual: vis('confeito', 'c6-lace-tuile-curva', 0.06, 'd8a040 b87a20 f0d080 a86a20', { ac: 'brilhante' }), gerar: gLaceTuileCurva },
  'brandy-snap': { visual: vis('confeito', 'brandy-snap', 0.09, 'c88a30 a86a20 e0b060 8a4a10', { a: 0.23, ac: 'brilhante' }), gerar: gBrandySnap },
  'pennant-maracuja': { visual: vis('confeito', 'pennant-maracuja', 0.1, 'e8b050 c08a30 f0d080 a86a20', { a: 0.3, l: 0.35 }), gerar: gPennant },
  'c6-pennants-assadeira': { visual: vis('confeito', 'c6-pennants-assadeira', 0.11, 'f0dcae e6cc92 f0dcae c88a3a', { a: 0.01 }), gerar: gPennantsAssadeira },
  'c6-croquembouche-invertido': { visual: vis('choux', 'croquembouche', 0.24, 'c88a3a e8c080 f6eedc 9a5a20 b8701e', { a: 1.45, d: 'invertido' }), gerar: gChoux },
  'c6-torta-funil-pincelada': { visual: { f: 'torta', v: 'funil', t: 0.25, a: 0.32, c1: '#e0a032', c2: '#eedcae', c3: '#f2efe8', ci: '#c0703a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'c6-torta-dupla-pincelada': { visual: { f: 'torta', v: 'dupla', t: 0.25, a: 0.32, c1: '#e0a032', c2: '#eedcae', c3: '#f2efe8', ci: '#a8344a', cc: '#c88a3a', ac: 'brilhante' }, gerar: gTortaCrua },
  'c6-bolo-camadas-coberto': { visual: vis('bolo', 'c6-bolo-camadas-coberto', 0.21, 'f8f1e2 f0e4cc f0d890 c89a50', { ac: 'acetinado' }), gerar: gBoloCamadasCoberto },
  'c6-bolo-chantilly-pronto': { visual: { f: 'bolo', v: 'chantilly-castanhas', t: 0.21, a: 0.45, c1: '#faf8f2', c2: '#a8743a', ci: '#f2d888', cc: '#faf8f2', ac: 'acetinado' }, gerar: gBoloChantilly },
  'cheesecake-assado': { visual: CHEESE_ASSADO, gerar: gCheesecake },
  'c6-cheesecake-assado-pronto': { visual: { ...CHEESE_ASSADO, v: 'c6-cheesecake-assado-pronto', c1: '#d8a456' }, gerar: gCheesecake },
  'cheesecake-gelado': { visual: CHEESE_GELADO, gerar: gCheesecake },
  'c6-cheesecake-gelado-pronto': { visual: { ...CHEESE_GELADO, v: 'c6-cheesecake-gelado-pronto' }, gerar: gCheesecake },
  arroz_pudding: { visual: vis('monte', 'arroz_pudding', 0.09, 'f4f0e6 e8d6ae f6f4ee f0e8d8', { a: 0.25, ac: 'acetinado' }), gerar: gArrozPudding },
  // o mesmo arroz-doce, numa família que não é preparo: o prato põe a peça na tigelinha por cima do creme
  'c6-arroz-doce-graos': { visual: vis('confeito', 'c6-arroz-doce-graos', 0.09, 'f4f0e6 e8d6ae f6f4ee f0e8d8', { a: 0.25, ac: 'acetinado' }), gerar: gArrozPudding },
  'c6-pudim-arroz-assado': { visual: vis('bolo', 'c6-pudim-arroz-assado', 0.13, 'e6c482 c08a42 f2e8d0 c8903a', { a: 0.1, ac: 'acetinado' }), gerar: gPudimArrozAssado },
  operetta: { visual: vis('bolo', 'operetta', 0.2, '24120a 3a1e12 c89a58 2a1408', { a: 0.15, l: 0.75, ac: 'brilhante' }), gerar: gOperettaPlaca },
  'c6-folha-ouro': { visual: vis('confeito', 'c6-folha-ouro', 0.012, 'e8c048 d8a830 f8e070 d8a830', { a: 0.07, ac: 'brilhante' }), gerar: gFolhaOuro },
  'c6-strudel-reto': { visual: vis('folhado', 'c6-strudel-reto', 0.3, 'f0e0bc d8bc84 d8b46a d8a040'), gerar: gStrudelReto },
};
