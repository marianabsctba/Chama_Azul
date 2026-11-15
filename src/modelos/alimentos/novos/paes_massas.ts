// Alimentos novos do grupo pães e massas: massas frescas coloridas e com ervas prensadas,
// gnocchi alla romana, ravióli de bordas recortadas, tortellino, nhoque vincado no garfo,
// trouxinha de wonton torcida, pasteizinhos chineses de pregas, pastel de borda dentada,
// rolinhos primavera fritos, pão com piques em X, baguete riscada, as rosquinhas do livro
// (palmier, caracol, tourelle, Parker House, colheita e nó), espirais de parmesão e tamale.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, tf, parte, mix, mul, rgb, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import type { Ctx, Gerador } from '../pecas';
import { laje, type P3 } from './ovos_queijos';
import type { Lote } from './tipos';

/** Pó de farinha salpicado por cima. */
function farinha(c: RGB, x: number, y: number, z: number, s: number, q = 0.4): RGB {
  return mix(c, [0.94, 0.92, 0.88], suave(1 - q * 0.6, 1, ruido(x * 700, y * 700, z * 700, s + 50) * 0.5 + 0.5) * 0.85);
}

/** Massa fresca crua: tom liso com pontinhos e um pouco de farinha. */
function corMassa(base: RGB, s: number, q = 0.35): CorFn {
  return (x, y, z) => farinha(mul(base, 0.95 + 0.07 * fbm(x * 120, y * 120, z * 120, s)), x, y, z, s, q);
}

/** Crosta de pão pincelado com ovo: dourada no alto, clara embaixo e nas dobras. */
function corPincelado(k: Ctx, H: number): CorFn {
  const { c1, c2, s } = k;
  return (x, y, z) => {
    let c = mix(c2, c1, suave(H * 0.15, H * 0.85, y) * 0.9 + 0.2 * fbm(x * 40, y * 40, z * 40, s));
    c = mul(c, 1 + 0.07 * fbm(x * 120, y * 120, z * 120, s + 1));
    return mix(c, mul(c1, 0.75), suave(0.4, 0.9, fbm(x * 60, y * 60, z * 60, s + 2)) * 0.25);
  };
}

/* ------------------------------------------------------------------ */
/* massas frescas                                                       */
/* ------------------------------------------------------------------ */

/** Folhas de massa fresca em leque: de ovos, de espinafre, de tomate e de tinta de lula. */
const gMassaColorida: Gerador = (k) => {
  const { s } = k;
  const out: Parte[] = [];
  const L = k.T * 0.82, W = L * 0.5, E = 0.0012;
  const cores: [RGB, number][] = [[rgb('#1f1e22'), 0.15], [rgb('#c9502a'), 0.3], [rgb('#4f7f2a'), 0.35], [k.c1, 0.4]];
  cores.forEach(([base, q], i) => {
    const pint = (x: number, y: number, z: number): RGB => {
      let c = mul(base, 0.93 + 0.1 * fbm(x * 90, y * 90, z * 90, s + i));
      // espinafre e tomate deixam pontinhos mais escuros na massa
      if (i === 1 || i === 2) c = mix(c, mul(base, 0.65), (1 - suave(0.04, 0.1, celula(x * 500, y * 500, z * 500, s + i))) * 0.6);
      return farinha(c, x, y, z, s + i, q);
    };
    const g = laje(26, 10, (u, v, lado) => {
      const x = (u - 0.5) * L, z = v * (W / 2) * (1 + 0.02 * fbm(u * 6, i, 0, s));
      const y = 0.0018 * Math.sin(x * 38 + i) * Math.sin(PI * u) + 0.0008 * fbm(x * 30, 0, z * 30, s + i) + lado * E;
      return [x, y, z];
    }, (x, y, z) => pint(x, y, z));
    g.rotateY(-0.42 + i * 0.27);
    g.translate(i * 0.01, i * 0.0022 + 0.002, -i * 0.006);
    out.push(parte(g, k.ac, i === 3));
  });
  return out;
};

/** Raio da folha de salsa lisa (três lóbulos serrilhados) na direção phi, a partir do cabinho. */
function raioSalsa(phi: number, Lf: number): number {
  let r = Lf * 0.12;
  for (const [ang, esc] of [[-0.8, 0.8], [0, 1], [0.8, 0.8]] as [number, number][]) {
    const d = (phi - ang) / 0.5;
    if (Math.abs(d) < 1) r = Math.max(r, Lf * esc * Math.cos((d * PI) / 2) ** 0.55);
  }
  return r * (1 - 0.13 * Math.abs(Math.sin(phi * 34)));
}

/** Quadrado de massa cozida com uma folha de salsa prensada aparecendo através da massa fina. */
const gMassaErvas: Gerador = (k) => {
  const { c1, c3, s } = k;
  const out: Parte[] = [];
  const S = k.T, E = 0.0013, Lf = S * 0.46;
  const altura = (x: number, z: number) => {
    const e = Math.max(Math.abs(x), Math.abs(z)) / (S / 2);
    return 0.003 - 0.0025 * e ** 3 + 0.0009 * Math.sin(x * 120 + z * 40) * e ** 2;
  };
  out.push(parte(laje(24, 24, (u, v, lado) => {
    const x = (u - 0.5) * S, z = v * S / 2;
    const e = Math.max(Math.abs(x), Math.abs(z)) / (S / 2);
    const ond = 1 + 0.015 * fbm(x * 40, 0, z * 40, s + 2) * e;
    return [x * ond, altura(x, z) + lado * E, z * ond];
  }, (x, y, z) => mul(c1, 0.95 + 0.06 * fbm(x * 100, y * 100, z * 100, s))), k.ac, true));
  // a folha prensada entre as duas camadas: verde velado pela massa, nervuras claras
  const bx = -S * 0.22, bz = -S * 0.04, giro = 0.25;
  const verde = mix(c3, c1, 0.3);
  out.push(parte(laje(14, 30, (u, v, lado) => {
    const phi = v * 1.35;
    const r = u * raioSalsa(phi, Lf);
    const lx = Math.cos(phi) * r, lz = Math.sin(phi) * r;
    const x = bx + lx * Math.cos(giro) - lz * Math.sin(giro), z = bz + lx * Math.sin(giro) + lz * Math.cos(giro);
    return [x, altura(x, z) + E + 0.00012 + lado * 0.0001, z];
  }, (x, _y, z, u, v) => {
    const phi = v * 1.35;
    const nerv = Math.max(...[-0.8, 0, 0.8].map((a) => 1 - suave(0, 0.05, Math.abs(phi - a)))) * (1 - u * 0.6);
    return mix(mul(verde, 0.92 + 0.12 * fbm(x * 200, 0, z * 200, s + 3)), mix(verde, c1, 0.5), nerv * 0.6);
  }), 'acetinado'));
  // cabinho
  out.push(parte(laje(8, 2, (u, v, lado) => {
    const t = -u * Lf * 0.5;
    const x = bx + t * Math.cos(giro), z = bz + t * Math.sin(giro) + v * 0.0006;
    return [x, altura(x, z) + E + 0.00012 + lado * 0.0001, z];
  }, () => verde), 'acetinado'));
  return out;
};

/** Gnocchi alla romana: discos de semolina sobrepostos, gratinados com manteiga e parmesão. */
const gGnocchiRomana: Gerador = (k) => {
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const R = 0.022, H = 0.0105, n = 5, passo = 0.026, incl = 0.26;
  for (let i = 0; i < n; i++) {
    const cor: CorFn = (x, y, z) => {
      const topo = suave(H * 0.7, H, y);
      let c = mul(ci, 0.95 + 0.06 * fbm(x * 90, y * 90, z * 90, s + i));
      // topo gratinado em manchas, borda mais tostada e queijo derretido
      const dour = clamp(0.35 + suave(-0.3, 0.4, fbm(x * 45, 0, z * 45, s + i + 3)) * 0.7 + suave(R * 0.6, R, Math.hypot(x, z)) * 0.7);
      c = mix(c, mix(c1, c2, suave(0.3, 0.9, fbm(x * 80, 0, z * 80, s + i + 5))), topo * dour);
      return mix(c, rgb('#f6e6b4'), topo * (1 - suave(0.05, 0.13, celula(x * 420, y * 420, z * 420, s + i))) * 0.6);
    };
    const g = torno({
      caminho: [[0, 0], [R * 0.95, 0], [R, H * 0.12], [R * 1.0, H * 0.82], [R * 0.95, H], [R * 0.5, H * 1.06], [0, H * 1.08]],
      n: 14, m: 36, cor,
      mod: (_t, a) => 1 + 0.012 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, i, s),
      desloc: (p) => { if (p.y > H * 0.9) p.y += 0.0008 * fbm(p.x * 90, 0, p.z * 90, s + i + 7); },
    });
    g.rotateZ(-incl);
    g.rotateY(0.15 * Math.sin(i * 2.1));
    g.computeBoundingBox();
    g.translate(i * passo, -g.boundingBox!.min.y + (i ? 0.002 : 0), 0.003 * Math.sin(i * 1.7));
    out.push(parte(g, k.ac, true));
  }
  return out;
};

/** Ravióli: almofadinha de recheio com a borda recortada (zigue-zague no quadrado, canelada no redondo). */
const gRaviolo: Gerador = (k) => {
  const { c1, c3, s } = k;
  const redondo = k.v.v === 'raviolo-redondo';
  const S = k.T, E = 0.0011, Hm = S * 0.25;
  const base = corMassa(c1, s, 0.45);
  const cor: CorFn = (x, y, z) => {
    const c = base(x, y, z, 0, 0);
    // o recheio sombreia a massa fina por baixo
    const d = Math.hypot(x, z) / (S * 0.34);
    return mix(c, mix(c1, c3, 0.5), (1 - suave(0.6, 1, d)) * 0.12);
  };
  const tri = (q: number) => Math.abs(((q % 1) + 1) % 1 - 0.5) * 2;
  return [parte(laje(30, 30, (u, v, lado) => {
    let x: number, z: number, e: number;
    if (redondo) {
      const a = v * PI, R = S / 2 * (1 - 0.05 * (1 - Math.abs(Math.sin(a * 12)) ** 0.6));
      x = Math.cos(a) * u * R;
      z = Math.sin(a) * u * R;
      e = u;
    } else {
      x = (u - 0.5) * S;
      z = v * S / 2;
      e = Math.max(Math.abs(x), Math.abs(z)) / (S / 2);
      // a carretilha deixa a borda em zigue-zague
      const zz = 0.0011 * (tri((Math.abs(x) > Math.abs(z) ? z : x) / 0.004) - 0.5) * suave(0.93, 1, e);
      if (Math.abs(x) > Math.abs(z)) x += Math.sign(x) * zz;
      else z += Math.sign(z) * zz;
    }
    const d = Math.hypot(x, z) / (S * 0.34);
    const monte = d < 1 ? Hm * Math.pow(1 - d * d, 0.55) * (1 + 0.04 * fbm(x * 200, 0, z * 200, s)) : 0;
    // vinco de selar em volta do recheio
    const selo = -0.0004 * Math.exp(-(((d - 1.12) / 0.07) ** 2));
    const y = (lado ? E + monte + selo : monte * 0.15) + 0.0002 * fbm(x * 300, 0, z * 300, s + 1);
    return [x, y, z];
  }, cor), k.ac, true)];
};

/** Tortellino: meia-lua enrolada no dedo, barriga cheia, aba virada para cima e pontas cruzadas. */
const gTortellino: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const Ra = k.T * 0.26, rb = k.T * 0.17;
  const cor = corMassa(c1, s, 0.3);
  const pts: THREE.Vector3[] = [];
  const a0 = 0.18, a1 = TAU + 0.18;
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, a = lerp(a0, a1, t);
    // as pontas se cruzam na frente: uma passa por cima da outra
    const sobe = rb * 0.55 * suave(0.85, 1, t) - rb * 0.1 * suave(0.15, 0, t);
    pts.push(V(Math.cos(a) * Ra * (1 - 0.12 * suave(0.85, 1, t)), rb * 0.95 + sobe, Math.sin(a) * Ra));
  }
  out.push(parte(tubo(pts, { raio: (t) => rb * (0.4 + 0.6 * Math.sin(PI * t) ** 0.6), achata: 1.1, cima: V(0, 1, 0), m: 14, n: 44, cor }), k.ac, true));
  // aba fina da costura virada para cima e para fora, ondulada
  out.push(parte(laje(30, 3, (u, v, lado) => {
    const a = lerp(a0 + 0.6, a1 - 0.6, u);
    const w = (v + 1) / 2;
    const r = Ra + rb * 0.45 + w * rb * 0.45;
    const y = rb * 1.55 + w * rb * 0.45 + 0.0006 * Math.sin(u * 26) * w + lado * 0.0008;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }, cor), k.ac));
  return out;
};

/** Nhoque de batata rolado no garfo: oval arqueado com estrias de um lado. */
const gNhoqueVincado: Gerador = (k) => {
  const { c1, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const cor = corMassa(c1, s, 0.5);
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 44, m: 22,
    cor: (x, y, z, t, a) => mul(cor(x, y, z, t, a), 1 - 0.12 * (0.5 + 0.5 * Math.cos(t * TAU * 7)) ** 3 * Math.max(0, Math.cos(a))),
    perfil: (t) => { const e = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) ** 0.8; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 + H * 0.12 * Math.sin(PI * t) }; },
    mod: (t, a) => 1 - 0.08 * (0.5 + 0.5 * Math.cos(t * TAU * 7)) ** 3 * Math.max(0, Math.cos(a)) ** 0.7 - 0.12 * Math.max(0, -Math.cos(a)) ** 4 * Math.sin(PI * t),
    desloc: (p) => { if (p.y < H * 0.18) p.y = H * 0.18 - (H * 0.18 - p.y) * 0.4; },
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* massas orientais e rolinhos                                          */
/* ------------------------------------------------------------------ */

/** Trouxinha de wonton: o recheio numa bolsinha, a massa apertada no pescoço e torcida em pétalas. */
const gWonton: Gerador = (k) => {
  const { c1, c3, s } = k;
  const R = k.T * 0.3;
  const rho0 = 0.55, th0 = 0.72 * PI;
  const rb = R * Math.sin(th0), yb = R * (1 - Math.cos(th0)), rn = R * 0.3;
  const ponto = (sx: number, sz: number, lado: number): P3 => {
    const rho = Math.hypot(sx, sz), phi = Math.atan2(sz, sx);
    if (rho <= rho0) {
      const th = (rho / rho0) * th0, rr = R + lado * 0.0006;
      return [rr * Math.sin(th) * Math.cos(phi), R - rr * Math.cos(th), rr * Math.sin(th) * Math.sin(phi)];
    }
    const rmax = 1 / Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi)));
    const q = clamp((rho - rho0) / (rmax - rho0));
    const canto = (rmax - 1) / 0.414;
    const rf = R * (0.45 + 0.75 * canto);
    const r = q < 0.35 ? lerp(rb, rn, suave(0, 0.35, q)) : lerp(rn, rf, suave(0.35, 1, q) ** 0.85);
    const ph = phi + 0.9 * suave(0.12, 0.5, q);
    const y = yb + q * R * (0.85 + 0.25 * canto) - R * 0.35 * suave(0.7, 1, q) * canto + R * 0.07 * Math.sin(phi * 6) * suave(0.5, 1, q);
    return [Math.cos(ph) * (r + lado * 0.0005), y + lado * 0.0003, Math.sin(ph) * (r + lado * 0.0005)];
  };
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.95 + 0.07 * fbm(x * 120, y * 120, z * 120, s));
    // no vapor a massa fica translúcida e o recheio rosado transparece na bolsa
    c = mix(c, c3, suave(yb * 1.05, yb * 0.5, y) * 0.32);
    return mix(c, mul(c1, 1.08), suave(yb + R * 0.5, yb + R * 1.1, y) * 0.3);
  };
  return [parte(laje(30, 30, (u, v, lado) => ponto(2 * u - 1, v, lado), cor), k.ac, true)];
};

/** Pasteizinhos chineses: meia-lua gorda com 4 ou 5 pregas na costura e base frita. */
const gPastelzinho: Gerador = (k) => {
  const { c1, c2, s } = k;
  const L = k.T, Rc = L * 0.62, R0 = L * 0.17;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) { const a = lerp(-0.85, 0.85, i / 12); pts.push(V(Math.sin(a) * Rc, R0 * 0.85, Rc - Math.cos(a) * Rc)); }
  const y0 = R0 * 0.25;
  const cor: CorFn = (x, y, z, t, a) => {
    let c = mul(c1, 0.95 + 0.06 * fbm(x * 120, y * 120, z * 120, s));
    const prega = Math.cos(t * PI * 9) ** 2 * Math.exp(-((a - 0.5) ** 2) / 0.15);
    c = mul(c, 1 - prega * 0.22);
    // base frita dourada e crocante
    return mix(c, mix(c2, mul(c2, 0.7), suave(0.2, 0.8, fbm(x * 90, 0, z * 90, s + 1))), suave(y0 * 1.6, y0 * 0.6, y));
  };
  return [parte(tubo(pts, {
    raio: (t) => R0 * (0.35 + 0.65 * Math.sin(PI * t) ** 0.55), achata: 1.15, cima: V(0, 1, 0), m: 30, n: 48, cor,
    mod: (t, a) => {
      const crista = 0.42 * Math.exp(-(a * a) / 0.05) * (0.85 + 0.15 * Math.sin(t * PI * 9));
      const prega = 0.2 * Math.sin(t * PI * 9) ** 2 * Math.exp(-((a - 0.5) ** 2) / 0.15);
      return 1 + crista + prega;
    },
    desloc: (p) => { if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.15; },
  }), k.ac, true)];
};

/** Pastel em meia-lua da fôrma: dobra redonda de um lado e borda dentada do outro. */
const gPastelMeiaLua: Gerador = (k) => {
  const { c1, s } = k;
  const out: Parte[] = [];
  const R = k.T / 2, Hb = R * 0.32, b = R * 0.17, Rc = R - b;
  const base = corMassa(c1, s, 0.4);
  // corpo estufado do recheio
  out.push(parte(laje(30, 16, (u, v, lado) => {
    const x = (u - 0.5) * 2 * Rc * 0.995;
    const w = Math.sqrt(Math.max(0, Rc * Rc - x * x));
    const z = ((v + 1) / 2) * w;
    const dArc = Rc - Math.hypot(x, z);
    const topo = 0.0016 + (Hb - 0.0016) * Math.sqrt(clamp(dArc / (Rc * 0.55)));
    const zr = Hb * 0.9, f = Math.sqrt(Math.max(0, 1 - (1 - Math.min(1, z / zr)) ** 2));
    const yTop = Hb / 2 + (topo - Hb / 2) * f;
    const yBot = (Hb / 2) * (1 - f);
    return [x, lado ? Math.max(yTop, yBot + 0.0012) : yBot, z];
  }, base), k.ac, true));
  // borda selada com os dentes da fôrma
  const nd = 30;
  out.push(parte(laje(150, 3, (u, v, lado) => {
    const a = u * PI, w = (v + 1) / 2;
    const r = lerp(Rc - 0.004, R * (1 + 0.012 * Math.sin(a * nd * 2)), w);
    const dente = Math.abs(Math.cos(a * nd)) ** 2;
    const y = (lado ? 0.0013 + 0.0009 * dente * (1 - w * 0.3) : 0) + 0.0004;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  }, (x, y, z) => mul(base(x, y, z, 0, 0), 1 - 0.18 * (1 - Math.abs(Math.cos(Math.atan2(z, x) * nd)) ** 2))), k.ac));
  return out;
};

/** Rolinho primavera frito: cilindro de massa estourada em bolhas douradas, emenda e pontas dobradas. */
const gRolinho: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const L = k.T, R = (L * k.L) / 2;
  const emenda = (t: number) => 2.1 + (t - 0.5) * 1.4;
  const cor: CorFn = (x, y, z, t, a) => {
    const b = celula(t * L * 260, Math.cos(a) * R * 260, Math.sin(a) * R * 260, s);
    let c = mix(c1, c3, (1 - suave(0.15, 0.45, b)) * 0.55);
    c = mix(c, c2, suave(0.15, 0.75, fbm(x * 60, y * 60, z * 60, s + 1)) * 0.6);
    c = mix(c, mul(c2, 0.75), (1 - suave(0, 0.08, Math.abs(a - emenda(t)))) * 0.6);
    // pontas dobradas: as abas fazem raios mais escuros
    const ponta = suave(0.12, 0.02, Math.min(t, 1 - t));
    return mul(c, 1 - ponta * 0.25 * Math.abs(Math.sin(a * 2)) ** 2);
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 70, m: 36, cor,
    perfil: (t) => { const e = Math.sqrt(suave(0, 0.07, t)) * Math.sqrt(suave(1, 0.93, t)); return { ry: R * e * 0.95, rz: R * e, cy: R * 0.95 }; },
    mod: (t, a) => 1 + 0.07 * (1 - celula(t * L * 260, Math.cos(a) * R * 260, Math.sin(a) * R * 260, s)) + 0.07 * Math.exp(-((a - emenda(t)) ** 2) / 0.012) * suave(0.05, 0.15, Math.min(t, 1 - t)),
    desloc: (p) => { const y0 = R * 0.2; if (p.y < y0) p.y = y0 - (y0 - p.y) * 0.4; },
  }), k.ac, true)];
};

/* ------------------------------------------------------------------ */
/* pães: cortes no topo e rosquinhas modeladas                           */
/* ------------------------------------------------------------------ */

/** Pão redondo cru com dois piques de tesoura em X no topo, as pontas levantadas. */
const gPaoCruz: Gerador = (k) => {
  const { c1, c2, s } = k;
  const R = k.T / 2, H = k.T * k.A, w = R * 0.09;
  const marca = (x: number, z: number) => {
    const d = Math.min(Math.abs(x - z), Math.abs(x + z)) / Math.SQRT2;
    const rr = Math.hypot(x, z);
    const alcance = suave(R * 0.62, R * 0.45, rr);
    return { sulco: (1 - suave(0, w, d)) * alcance, labio: Math.exp(-(((d - w * 1.6) / (w * 0.7)) ** 2)) * alcance, ponta: suave(R * 0.25, 0, rr) };
  };
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.95 + 0.06 * fbm(x * 60, y * 60, z * 60, s));
    c = farinha(c, x, y, z, s, 0.45 * suave(H * 0.5, H, y));
    const m = marca(x, z);
    return mul(mix(c, c2, m.sulco * suave(H * 0.5, H, y)), 1 - 0.25 * m.sulco * suave(H * 0.5, H, y));
  };
  return [parte(torno({
    caminho: (u) => { const th = u * PI; return [R * Math.sin(th) ** 0.7, lerp(0.3, 1, suave(0.25, 0.75, u)) * H * (1 - Math.cos(th)) / 2]; },
    n: 34, m: 72, cor,
    desloc: (p) => {
      const m = marca(p.x, p.z);
      const topo = suave(H * 0.5, H, p.y);
      p.y += topo * (-H * 0.2 * m.sulco + H * 0.04 * m.labio + H * 0.05 * m.ponta * (1 - m.sulco));
    },
  }), k.ac, true)];
};

/** Baguete crua com os riscos paralelos no topo, bordas do corte levantadas. */
const gBagueteRiscada: Gerador = (k) => {
  const { c1, c2, s } = k;
  const L = k.T, W = L * k.L, H = L * k.A;
  const n = k.v.n ?? 7, esp = (L * 0.8) / n;
  const risco = (x: number, z: number) => {
    const q = (x - z * 1.4) / esp + n / 2;
    const f = q - Math.round(q);
    const dentro = Math.abs(Math.round(q) - n / 2) <= n / 2 - 0.5 ? 1 : 0;
    const larg = suave(W * 0.32, W * 0.18, Math.abs(z));
    return { sulco: (1 - suave(0, 0.07, Math.abs(f))) * larg * dentro, labio: Math.exp(-(((f - 0.1) / 0.04) ** 2)) * larg * dentro };
  };
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.95 + 0.06 * fbm(x * 50, y * 50, z * 50, s));
    c = farinha(c, x, y, z, s, 0.5 * suave(H * 0.4, H, y));
    return mul(mix(c, c2, risco(x, z).sulco * suave(H * 0.4, H, y)), 1 - 0.25 * risco(x, z).sulco * suave(H * 0.4, H, y));
  };
  return [parte(corpo({
    x0: -L / 2, x1: L / 2, n: 110, m: 28, exp: 2.2, linear: true, cor,
    perfil: (t) => { const e = Math.sqrt(suave(0, 0.1, t)) * Math.sqrt(suave(1, 0.9, t)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
    desloc: (p) => {
      if (p.y < H * 0.2) p.y = H * 0.2 - (H * 0.2 - p.y) * 0.35;
      const r = risco(p.x, p.z), topo = suave(H * 0.55, H, p.y);
      p.y += topo * (-H * 0.2 * r.sulco + H * 0.05 * r.labio);
    },
  }), k.ac, true)];
};

/** Espiral plana de Arquimedes: do centro para fora, `voltas` voltas, raio inicial r0 e passo b. */
function espiral(cx: number, cz: number, r0: number, b: number, voltas: number, ang0: number, sentido: number, n: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * voltas * TAU;
    const r = r0 + (b * th) / TAU;
    out.push([cx + Math.cos(ang0 + sentido * th) * r, cz + Math.sin(ang0 + sentido * th) * r, i / n]);
  }
  return out;
}

/** As rosquinhas do livro, cada uma na sua forma, pinceladas com ovo e assadas. */
const gRosca: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const v = k.v.v;
  const rt = k.T * 0.095;
  switch (v) {
    case 'rosca-palmier': {
      // tira enrolada pelas duas pontas até o meio: duas espirais que se encontram
      const voltas = 1.6, b = rt * 1.9, r0 = rt * 0.5;
      const ang = 0.25;
      const re = r0 + b * voltas;
      const cx = re * Math.cos(ang) * 0.97;
      const esq = espiral(-cx, 0, r0, b, voltas, ang - voltas * TAU, 1, 40);
      const pts = [...esq.map(([x, z]) => V(x, rt, z)), ...esq.slice(0, -1).reverse().map(([x, z]) => V(-x, rt, z))];
      const H = rt * 2;
      out.push(parte(tubo(pts, { raio: (t) => rt * (0.75 + 0.25 * Math.sin(PI * t) ** 0.2), achata: 1.12, cima: V(0, 1, 0), m: 12, n: 150, cor: corPincelado(k, H) }), 'brilhante', true));
      return out;
    }
    case 'rosca-caracol': {
      const voltas = 2.3, b = rt * 2.0, r0 = rt * 0.4;
      const esp = espiral(0, 0, r0, b, voltas, 0, 1, 60);
      const pts = esp.map(([x, z, t]) => V(x, rt * (1 + 0.55 * (1 - t)) - rt * 0.35 * suave(0.93, 1, t), z));
      const H = rt * 2.6;
      out.push(parte(tubo(pts, { raio: (t) => rt * (0.7 + 0.3 * Math.sin(PI * Math.min(1, t * 1.05)) ** 0.25), achata: 1.1, cima: V(0, 1, 0), m: 12, n: 150, cor: corPincelado(k, H) }), 'brilhante', true));
      return out;
    }
    case 'rosca-tourelle': {
      // três discos empilhados, do maior ao menor
      const H1 = k.T * 0.16;
      let y = 0;
      [0.5, 0.37, 0.24].forEach((f, i) => {
        const R = k.T * f, h = H1 * (1 - i * 0.08);
        const cor = corPincelado(k, h);
        const g = torno({
          caminho: [[0, 0], [R * 0.9, 0], [R, h * 0.3], [R * 0.97, h * 0.75], [R * 0.82, h], [R * 0.4, h * 1.08], [0, h * 1.1]],
          n: 12, m: 36,
          cor: (x, yy, z, t, a) => mix(cor(x, yy, z, t, a), c2, suave(h * 0.25, 0, yy) * 0.6),
          mod: (_t, a) => 1 + 0.025 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, i, s),
        });
        g.translate(0, y, 0);
        out.push(parte(g, 'brilhante', i === 0));
        y += h * 0.92;
      });
      return out;
    }
    case 'rosca-parker-house': {
      // círculo dobrado no vinco: a metade de cima, menor, deitada sobre a de baixo
      const R = k.T / 2, H = k.T * 0.2;
      const cor = corPincelado(k, H * 1.5);
      const baixo = torno({
        caminho: [[0, 0], [R * 0.92, 0], [R, H * 0.25], [R * 0.92, H * 0.6], [R * 0.6, H * 0.75], [0, H * 0.8]],
        n: 14, m: 40, l: 0.82, cor,
        mod: (_t, a) => 1 + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 0, s),
      });
      out.push(parte(baixo, 'brilhante', true));
      const cima = torno({
        caminho: [[0, 0], [R * 0.85, 0], [R * 0.92, H * 0.25], [R * 0.85, H * 0.6], [R * 0.55, H * 0.8], [0, H * 0.85]],
        n: 14, m: 40, l: 0.6,
        cor: (x, y, z, t, a) => mix(cor(x, y + H * 0.45, z, t, a), c2, suave(H * 0.2, 0, y) * 0.5),
        mod: (_t, a) => 1 + 0.02 * fbm(Math.cos(a) * 2, Math.sin(a) * 2, 1, s),
        desloc: (p) => { if (p.z < 0) p.y *= 1 - 0.35 * suave(0, -R * 0.5, p.z); },
      });
      cima.translate(0, H * 0.45, R * 0.16);
      out.push(parte(cima, 'brilhante', true));
      return out;
    }
    case 'rosca-colheita': {
      // grão de trigo: fuso largo no meio, pontas finas e três talhos paralelos no topo
      const L = k.T, W = L * 0.42, H = L * 0.3;
      const talho = (x: number, z: number) => {
        let m = 0;
        for (const xi of [-0.24, 0, 0.24]) m = Math.max(m, (1 - suave(0, L * 0.03, Math.abs(x - xi * L - z * 0.6))) * suave(W * 0.38, W * 0.22, Math.abs(z)));
        return m;
      };
      const cor = corPincelado(k, H);
      out.push(parte(corpo({
        x0: -L / 2, x1: L / 2, n: 60, m: 24,
        cor: (x, y, z, t, a) => mix(cor(x, y, z, t, a), mul(k.ci, 0.95), talho(x, z) * suave(H * 0.6, H, y) * 0.85),
        perfil: (t) => { const e = Math.sin(PI * t) ** 0.85; return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
        desloc: (p) => { if (p.y < H * 0.2) p.y = H * 0.2 - (H * 0.2 - p.y) * 0.3; p.y -= talho(p.x, p.z) * H * 0.22 * suave(H * 0.6, H, p.y); },
      }), 'brilhante', true));
      return out;
    }
    default: {
      // nó de padeiro: a tira amarrada num nó simples, pontas para fora
      const sc = k.T * 0.17, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 60; i++) {
        const t = lerp(0.3, TAU - 0.3, i / 60);
        pts.push(V((Math.sin(t) + 2 * Math.sin(2 * t)) * sc, rt * 1.05 - Math.sin(3 * t) * rt * 0.75, (Math.cos(t) - 2 * Math.cos(2 * t)) * sc));
      }
      const H = rt * 3.6;
      out.push(parte(tubo(pts, { raio: (t) => rt * (0.65 + 0.35 * Math.sin(PI * t) ** 0.3), cima: V(0, 1, 0), achata: 1.1, m: 12, n: 160, cor: corPincelado(k, H) }), 'brilhante', true));
      return out;
    }
  }
};

/* ------------------------------------------------------------------ */
/* espirais de parmesão                                                 */
/* ------------------------------------------------------------------ */

/** Lâminas finas de parmesão que se enrolam em espiral ao serem puxadas do bloco. */
const gEspiralParmesao: Gerador = (k) => {
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const cristal: RGB = [0.97, 0.94, 0.86];
  const cor: CorFn = (x, y, z) => {
    let c = mul(c1, 0.94 + 0.08 * fbm(x * 150, y * 150, z * 150, s));
    c = mix(c, c2, suave(0.3, 0.9, fbm(x * 70, y * 70, z * 70, s + 1)) * 0.35);
    return mix(c, cristal, (1 - suave(0.04, 0.1, celula(x * 700, y * 700, z * 700, s + 2))) * 0.7);
  };
  const lamina = (Ls: number, ws: number, r0: number, voltas: number, si: number) => {
    const ua = 0.1, th = voltas * TAU;
    const xa = ua * Ls;
    return laje(40, 6, (u, v, lado) => {
      const z = v * (ws / 2) * (1 - 0.25 * u) * (1 + 0.08 * fbm(u * 8, si, 0, s));
      const e = 0.0007 * (1 - 0.3 * u);
      if (u <= ua) return [u * Ls, lado * e, z];
      const q = (u - ua) / (1 - ua);
      const ang = q * th, r = r0 * (1 - 0.6 * q);
      const rr = r - lado * e;
      return [xa + Math.sin(ang) * rr, r0 - Math.cos(ang) * rr + (1 - lado) * 0, z];
    }, cor);
  };
  const pecas: [number, number, number, number, number, P3][] = [
    [0.075, 0.024, 0.0075, 1.9, 0, [-0.03, 0, -0.01]],
    [0.06, 0.02, 0.006, 2.0, 1, [-0.01, 0, 0.018]],
    [0.05, 0.017, 0.005, 1.8, 2, [0.008, 0, -0.022]],
  ];
  for (const [Ls, ws, r0, vt, i, p] of pecas) {
    const g = lamina(Ls, ws, r0, vt, i);
    g.rotateY([0.2, -0.5, 0.6][i]);
    out.push(parte(tf(g, p), k.ac, true));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* tamale                                                               */
/* ------------------------------------------------------------------ */

/** Tamale fechado na palha de milho: pacotinho com as pontas dobradas para cima e amarrado. */
const gTamale: Gerador = (k) => {
  const { c1, c2, c3, s } = k;
  const out: Parte[] = [];
  const L = k.T, W = L * k.L, H = L * k.A;
  const palha: CorFn = (x, y, z, _t, a) => {
    const fibra = Math.abs(Math.sin(a * 46 + 2.5 * fbm(x * 30, 0, 0, s))) ** 3;
    let c = mix(c1, c2, fibra * 0.35 + suave(0.2, 0.9, fbm(x * 40, y * 40, z * 40, s + 1)) * 0.4);
    return mul(c, 0.95 + 0.08 * ruido(x * 400, y * 400, z * 400, s + 2));
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 40, exp: 3.2, tampa: true, cor: palha,
    perfil: (t) => { const e = 1 - 0.3 * suave(0.12, 0, Math.min(t, 1 - t)); return { ry: (H / 2) * e, rz: (W / 2) * e, cy: H / 2 }; },
    mod: (t, a) => 1 + 0.03 * Math.exp(-((a - 1.2) ** 2) / 0.01) + 0.015 * fbm(t * 6, Math.cos(a) * 2, Math.sin(a) * 2, s + 3),
  }), k.ac, true));
  // as pontas curtas da palha dobradas por cima
  const fibraLaje: CorFn = (x, y, z) => mix(c1, c2, Math.abs(Math.sin(z * 1400 + 2 * fbm(x * 30, 0, 0, s))) ** 3 * 0.4 + 0.2);
  for (const sg of [-1, 1]) {
    out.push(parte(laje(10, 6, (u, v, lado) => {
      const x = sg * (L / 2 - u * L * 0.24);
      const z = v * (W / 2) * (0.92 - 0.45 * u);
      const dobra = suave(0.0, 0.1, u);
      return [x + sg * 0.004 * (1 - dobra), H * (0.55 + 0.47 * dobra) + 0.0008 + lado * 0.0006 + 0.0006 * Math.sin(u * 9), z];
    }, fibraLaje), k.ac));
  }
  // tirinhas de palha amarrando
  for (const xr of [-0.3, 0.3]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      pts.push(V(xr * L, H / 2 + Math.cos(a) * (H / 2 + 0.0012), Math.sin(a) * (W / 2 + 0.0012)));
    }
    out.push(parte(tubo(pts, { raio: 0.0007, achata: 4, cima: V(1, 0, 0), m: 6, n: 40, fechado: true, cor: () => mul(c3, 0.95) }), 'fosco'));
    out.push(parte(tf(elipsoide(0.0032, 0.0018, 0.0028, () => mul(c3, 0.85), 5, 8), [xr * L, H + 0.0016, 0]), 'fosco'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* registro do lote                                                     */
/* ------------------------------------------------------------------ */

const ROSCA = { c1: '#c27a2a', c2: '#e6b46a', ci: '#f4e6c8', cc: '#9a5a1e', ac: 'brilhante' as const };
const MASSA = { c1: '#f0d88e', c2: '#e0c070', ci: '#f2dc98', cc: '#e0c070', ac: 'acetinado' as const };

export const LOTE: Lote = {
  'massa-colorida': { visual: { f: 'placa', v: 'massa-colorida', t: 0.17, a: 0.02, l: 0.6, ...MASSA }, gerar: gMassaColorida },
  'massa-ervas': { visual: { f: 'placa', v: 'massa-ervas', t: 0.065, a: 0.06, l: 1, ...MASSA, c1: '#f2de9c', c3: '#3a7224' }, gerar: gMassaErvas },
  'gnocchi-romana': { visual: { f: 'massa', v: 'gnocchi-romana', t: 0.15, c1: '#d8a448', c2: '#a8682a', ci: '#f0d890', cc: '#c08a3a', ac: 'acetinado' }, gerar: gGnocchiRomana },
  'raviolo-quadrado': { visual: { f: 'massa', v: 'raviolo-quadrado', t: 0.045, ...MASSA, c3: '#e8e0c8' }, gerar: gRaviolo },
  'raviolo-redondo': { visual: { f: 'massa', v: 'raviolo-redondo', t: 0.05, ...MASSA, c3: '#e8e0c8' }, gerar: gRaviolo },
  tortellino: { visual: { f: 'massa', v: 'tortellino', t: 0.034, ...MASSA }, gerar: gTortellino },
  'nhoque-vincado': { visual: { f: 'massa', v: 'nhoque-vincado', t: 0.026, a: 0.52, l: 0.62, c1: '#eedfb4', c2: '#e0cc98', ci: '#f2e6c4', cc: '#e6d4a4', ac: 'acetinado' }, gerar: gNhoqueVincado },
  wonton: { visual: { f: 'massa', v: 'wonton', t: 0.06, c1: '#efe2b4', c3: '#d89a88', ci: '#e8b0a0', cc: '#e8d4a0', ac: 'brilhante' }, gerar: gWonton },
  'pastelzinho-chines': { visual: { f: 'massa', v: 'pastelzinho-chines', t: 0.075, c1: '#f0e6c8', c2: '#b8742c', ci: '#d8a090', cc: '#c89048', ac: 'acetinado' }, gerar: gPastelzinho },
  'pastel-meia-lua': { visual: { f: 'massa', v: 'pastel-meia-lua', t: 0.1, c1: '#f0e0b0', ci: '#e8c8a0', cc: '#d8a050', ac: 'fosco' }, gerar: gPastelMeiaLua },
  'rolinho-primavera': { visual: { f: 'massa', v: 'rolinho-primavera', t: 0.12, l: 0.25, c1: '#d89a40', c2: '#a8642a', c3: '#f2c870', ci: '#c8d8a0', cc: '#b87a30', ac: 'brilhante' }, gerar: gRolinho },
  minirolinho: { visual: { f: 'massa', v: 'minirolinho', t: 0.065, l: 0.28, c1: '#d89a40', c2: '#a8642a', c3: '#f2c870', ci: '#c8d8a0', cc: '#b87a30', ac: 'brilhante' }, gerar: gRolinho },
  'pao-cruz': { visual: { f: 'pao', v: 'pao-cruz', t: 0.15, a: 0.42, c1: '#ecdcb8', c2: '#d8c08e', ci: '#f4ead4', cc: '#c07a30', ac: 'fosco' }, gerar: gPaoCruz },
  'baguete-riscada': { visual: { f: 'pao', v: 'baguete-riscada', t: 0.42, a: 0.1, l: 0.14, n: 7, c1: '#ecdcb6', c2: '#d6bc88', ci: '#f4ead4', cc: '#b8742a', ac: 'fosco' }, gerar: gBagueteRiscada },
  'rosca-palmier': { visual: { f: 'pao', v: 'rosca-palmier', t: 0.085, ...ROSCA }, gerar: gRosca },
  'rosca-caracol': { visual: { f: 'pao', v: 'rosca-caracol', t: 0.08, ...ROSCA }, gerar: gRosca },
  'rosca-tourelle': { visual: { f: 'pao', v: 'rosca-tourelle', t: 0.075, ...ROSCA }, gerar: gRosca },
  'rosca-parker-house': { visual: { f: 'pao', v: 'rosca-parker-house', t: 0.08, ...ROSCA }, gerar: gRosca },
  'rosca-colheita': { visual: { f: 'pao', v: 'rosca-colheita', t: 0.085, ...ROSCA }, gerar: gRosca },
  'rosca-no': { visual: { f: 'pao', v: 'rosca-no', t: 0.08, ...ROSCA }, gerar: gRosca },
  'espiral-parmesao': { visual: { f: 'queijo', v: 'espiral-parmesao', t: 0.07, c1: '#ecd07e', c2: '#d4ae58', ci: '#efd896', cc: '#e0b860', ac: 'acetinado' }, gerar: gEspiralParmesao },
  tamale: { visual: { f: 'massa', v: 'tamale', t: 0.13, a: 0.24, l: 0.4, c1: '#dccb94', c2: '#b8a46a', c3: '#c8b47e', ci: '#f0d278', cc: '#d0b878', ac: 'fosco' }, gerar: gTamale },
};
