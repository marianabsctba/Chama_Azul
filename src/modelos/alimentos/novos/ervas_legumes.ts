// Alimentos novos do grupo ervas legumes: capim-limão, tamarindo, bouquet garni e saquinho de
// musselina, casca de limão picada, especiarias moídas em montinho, pickling spice, cubos de gelo
// com ervas; aspargos amarrados, talos e fundo de alcachofra, legumes torneados em barril de sete
// faces, batatas (hasselback, parisienne, gaufrette, rösti, ninho), tamale, berinjela riscada,
// pipoca e fatias de frango em chaudfroid. As peças de desenho vêm de frutas_enfeites.ts.
import * as THREE from 'three';
import {
  corpo, torno, tubo, elipsoide, parte, rgb, mix, mul, fbm, ruido, celula, suave, clamp, lerp, PI, TAU, V,
  type CorFn, type Parte, type RGB,
} from '../nucleo';
import { contornos, caule, type Gerador } from '../pecas';
import { vis, tomR, fixa, grade, orientar, bloco, petala, apontar, type K } from './frutas_enfeites';
import type { Lote } from './tipos';

/** Laço de barbante (ou cordão) em volta do eixo X, elíptico, na posição x. */
function amarra(x: number, yc: number, ry: number, rz: number, cor: CorFn, esp = 0.0009): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let q = 0; q < 20; q++) {
    const a = (q / 20) * TAU;
    pts.push(V(x + 0.0006 * Math.sin(a * 3), yc + Math.cos(a) * ry, Math.sin(a) * rz));
  }
  return tubo(pts, { fechado: true, raio: esp, m: 5, n: 36, cor });
}
const barbante = (s: number): CorFn => (x, y, z) => mul(rgb('#ece2c8'), 0.9 + 0.12 * Math.abs(Math.sin((x + y + z) * 3000)) + 0.04 * fbm(x * 900, y * 900, z * 900, s));

/** Montinho em pé (y para cima), raio R e altura H, de encosta macia. */
function montinho(R: number, H: number, cor: CorFn, o: { n?: number; m?: number; rug?: number; s?: number } = {}): THREE.BufferGeometry {
  const s = o.s ?? 0;
  return torno({
    caminho: (u) => {
      if (u < 0.2) return [R * (u / 0.2), 0];
      const r = R * (1 - (u - 0.2) / 0.8);
      return [r, H * (1 - (r / R) ** 1.5) ** 1.15];
    },
    n: o.n ?? 22, m: o.m ?? 36, cor,
    mod: (t, a) => 1 + (o.rug ?? 0.04) * fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, t * 3, s) * suave(0.2, 0.35, t),
  });
}

/** Espalha peças sobre um monte (raio R, altura H): cada uma apoiada na encosta. */
function sobreMonte(k: K, n: number, R: number, H: number, peca: (i: number) => THREE.BufferGeometry, soltas = 0): THREE.BufferGeometry[] {
  const alt = (r: number) => H * Math.max(0, 1 - (r / R) ** 1.5) ** 1.15;
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const solta = i < soltas;
    const rr = solta ? R * k.r.f(1.02, 1.3) : R * Math.sqrt((i - soltas + 0.5) / (n - soltas)) * 0.96;
    const a = i * 2.39996 + k.r.f(-0.2, 0.2);
    const g = peca(i);
    g.rotateX(k.r.f(-PI, PI)); g.rotateY(k.r.f(0, TAU)); g.rotateZ(k.r.f(-PI, PI));
    g.computeBoundingBox();
    const h0 = -g.boundingBox!.min.y;
    g.translate(Math.cos(a) * rr, (solta ? 0 : alt(rr)) + h0 * 0.6, Math.sin(a) * rr);
    out.push(g);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* ervas e temperos                                                     */
/* ------------------------------------------------------------------ */

const gCapimLimao: Gerador = (k) => {
  // talos de capim-limão: base bulbosa clara cortada, bainhas em camadas, pontas verdes de folha
  const { c1, c2, c3, ci, s } = k;
  const L = k.T;
  const out: Parte[] = [];
  const talo = (dz: number, giro: number, comp: number, i: number) => {
    const R = 0.0085;
    const cor: CorFn = (x, y, z, t, a) => {
      let c = mix(c1, c3, suave(0.35, 0.95, t));
      c = mul(c, 0.94 + 0.08 * Math.abs(Math.sin(a * 14 + fbm(t * 6, 0, 0, s + i))) + 0.04 * fbm(x * 300, y * 300, z * 300, s));
      // borda da bainha de fora e anéis secos da base
      c = mix(c, c2, (1 - suave(0.0, 0.12, Math.abs(Math.sin((a - 1.2 + t * 2) / 2)))) * 0.6);
      c = mix(c, mul(c2, 0.85), (1 - suave(0.0, 0.02, Math.abs(t - 0.06))) * 0.6);
      return c;
    };
    const g = corpo({
      x0: -comp / 2, x1: comp / 2, n: 30, m: 16, tampa: true, aneisTampa: 4, cor,
      corTampa: (x, y, z) => { const r = Math.hypot(y - R, z) / R; return mix(ci, mix(ci, c3, 0.4), Math.abs(Math.sin(r * 14)) ** 4 * 0.6); },
      perfil: (t) => { const r = R * (1 + 0.22 * Math.exp(-(((t - 0.08) / 0.07) ** 2))) * (1 - 0.45 * t); return { ry: r, rz: r * 1.08, cy: R * 1.1 }; },
    });
    g.rotateY(giro); g.translate(0, 0, dz);
    out.push(parte(g, 'acetinado', i === 0));
    // folhas cortadas abrindo na ponta
    for (const lado of [-1, 1]) {
      const f = petala(L * 0.24, 0.007, { contorno: contornos.fita, curva: 0.05, esp: 0.0006, n: 10, m: 6, cima: tomR(c3, 0.08, 300, s), baixo: tomR(mul(c3, 0.85), 0.08, 300, s) });
      f.rotateY(lado * 0.18); f.rotateX(lado * 0.5);
      f.translate(comp / 2 - 0.01, R * 1.1, 0);
      f.rotateY(giro); f.translate(0, 0, dz);
      out.push(parte(f, 'acetinado'));
    }
  };
  talo(-0.006, 0.04, L * 0.72, 0);
  talo(0.012, -0.08, L * 0.66, 1);
  return out;
};

const gTamarindo: Gerador = (k) => {
  // vagens de tamarindo: casca parda quebradiça, contas das sementes; uma aberta mostra a polpa pegajosa
  const { c1, c2, ci, s } = k;
  const out: Parte[] = [];
  const casca: CorFn = (x, y, z) => {
    let c = mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 160, y * 160, z * 160, s)) * 0.5), 1 + 0.06 * fbm(x * 500, y * 500, z * 500, s));
    c = mix(c, mul(c2, 0.7), (1 - suave(0.0, 0.06, celula(x * 260, y * 260, z * 260, s) - 0.85 + 0.85)) * 0);
    return mix(c, mul(c2, 0.75), suave(0.82, 0.95, celula(x * 300, y * 300, z * 300, s)) * 0.6);
  };
  const vagem = (pts: THREE.Vector3[], r0: number, nsem: number, cor: CorFn, i: number) => tubo(pts, {
    raio: (t) => r0 * (0.8 + 0.22 * Math.abs(Math.sin(PI * nsem * t)) ** 0.6) * Math.min(1, Math.sin(PI * clamp(t)) * 3 + 0.25),
    achata: 0.75, cima: V(0, 1, 0), m: 12, n: 48, cor,
    mod: (t, a) => 1 + 0.05 * fbm(t * 20, Math.cos(a), Math.sin(a), s + i),
  });
  const r0 = 0.0085;
  out.push(parte(vagem([V(-0.06, r0, -0.012), V(-0.02, r0, -0.004), V(0.02, r0, -0.01), V(0.058, r0, -0.024)], r0, 6, casca, 0), 'fosco', true));
  // vagem aberta: pontas de casca e polpa marrom-escura com fibras
  const pts2 = [V(-0.05, r0, 0.022), V(-0.012, r0, 0.016), V(0.026, r0, 0.022), V(0.05, r0, 0.03)];
  const curva = new THREE.CatmullRomCurve3(pts2);
  const polpa: CorFn = (x, y, z) => mul(mix(ci, mul(ci, 1.5), suave(0.4, 0.9, fbm(x * 200, y * 200, z * 200, s + 5)) * 0.4), 1);
  out.push(parte(vagem(pts2, r0 * 0.88, 5, polpa, 1), 'brilhante', true));
  for (const [a, b] of [[0, 0.22], [0.82, 1]]) {
    const sub: THREE.Vector3[] = [];
    for (let q = 0; q <= 4; q++) sub.push(curva.getPointAt(lerp(a, b, q / 4)));
    out.push(parte(tubo(sub, { raio: (t) => r0 * 1.02 * Math.min(1, Math.sin(PI * clamp(a === 0 ? t * 0.5 : 0.5 + t * 0.5)) * 3 + 0.25), achata: 0.78, cima: V(0, 1, 0), m: 12, n: 12, cor: casca }), 'fosco'));
  }
  for (let f = 0; f < 3; f++) {
    const sub: THREE.Vector3[] = [];
    for (let q = 0; q <= 6; q++) { const p = curva.getPointAt(lerp(0.18, 0.86, q / 6)); const a = f * 2.1 + q * 0.4; sub.push(p.add(V(0, Math.cos(a) * r0 * 0.7 * 0.75, Math.sin(a) * r0 * 0.7))); }
    out.push(parte(tubo(sub, { raio: 0.0004, m: 4, n: 18, cor: fixa(rgb('#a07a4a')) }), 'fosco'));
  }
  return out;
};

const gBouquetGarni: Gerador = (k) => {
  // ervas (tomilho, louro, salsa, salsão) enroladas na folha verde do alho-poró e amarradas com barbante
  const { c1, c2, c3, s } = k;
  const L = k.T * 0.8, R = 0.0115;
  const out: Parte[] = [];
  const folhaPoro: CorFn = (x, y, z, t, a) => {
    let c = mix(c1, c2, suave(0.3, 0.9, Math.sin(a * 2 + 0.6) * 0.5 + 0.5) * 0.45);
    c = mul(c, 0.93 + 0.1 * Math.abs(Math.sin(a * 34)) ** 3 + 0.04 * fbm(x * 200, y * 200, z * 200, s));
    c = mix(c, mul(c2, 1.15), (1 - suave(0.0, 0.07, Math.abs(Math.sin((a - 2.3) / 2)))) * 0.7);
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 30, m: 28, cor: folhaPoro,
    perfil: (t) => { const e = Math.min(1, Math.sin(PI * t) * 4); return { ry: R * (0.55 + 0.45 * e), rz: R * 1.1 * (0.55 + 0.45 * e), cy: R }; },
    mod: (t, a) => 1 + 0.03 * fbm(t * 8, Math.cos(a) * 2, Math.sin(a) * 2, s) - 0.08 * Math.exp(-(((t - 0.18) / 0.03) ** 2)) - 0.08 * Math.exp(-(((t - 0.5) / 0.03) ** 2)) - 0.08 * Math.exp(-(((t - 0.82) / 0.03) ** 2)),
  }), 'acetinado', true));
  for (const t of [0.18, 0.5, 0.82]) out.push(parte(amarra((t - 0.5) * L, R, R * 0.95, R * 1.04, barbante(s)), 'fosco'));
  // ponta comprida do barbante para tirar da panela
  out.push(parte(tubo([V(0, R * 1.95, 0), V(-L * 0.25, R * 2.4, R * 0.6), V(-L * 0.55, R * 1.6, R * 1.6), V(-L * 0.8, 0.0012, R * 2.4), V(-L * 0.95, 0.0011, R * 3.2)], { raio: 0.0009, m: 5, n: 30, cor: barbante(s) }), 'fosco'));
  // ervas aparecendo nas pontas: folha de louro, salsa e raminhos de tomilho; talos na outra ponta
  const verde = rgb('#2f6a2a'), louro = rgb('#3a5a24'), tomilho = rgb('#5a6a3a');
  const louroF = petala(0.05, 0.016, { contorno: contornos.lanca, curva: 0.06, concha: 0.1, esp: 0.0007, n: 12, m: 8, cima: tomR(louro, 0.08, 200, s), baixo: tomR(mix(louro, rgb('#8a9a6a'), 0.4), 0.08, 200, s) });
  louroF.rotateZ(0.25); louroF.translate(L / 2 - 0.022, R * 1.25, -R * 0.2);
  out.push(parte(louroF, 'brilhante'));
  for (let i = 0; i < 4; i++) {
    const g = petala(0.018, 0.013, { contorno: contornos.recortada, curva: 0.2, concha: 0.2, esp: 0.0005, n: 8, m: 6, cima: tomR(verde, 0.1, 300, s + i), baixo: tomR(mul(verde, 1.2), 0.1, 300, s + i) });
    g.rotateY((i - 1.5) * 0.6); g.rotateZ(0.3 + 0.2 * (i % 2));
    g.translate(L / 2 - 0.004, R * (0.8 + 0.3 * (i % 2)), (i - 1.5) * 0.004);
    out.push(parte(g, 'acetinado'));
  }
  for (let i = 0; i < 3; i++) {
    const p0 = V(L / 2 - 0.01, R * (0.6 + 0.4 * i), (i - 1) * 0.005);
    const p1 = p0.clone().add(V(0.025, 0.004 * (i - 1), 0.006 * (i - 1)));
    out.push(parte(caule([p0, p0.clone().lerp(p1, 0.5).add(V(0, 0.002, 0)), p1], 0.0007, 0.0004, tomR(rgb('#6a5a3a'), 0.1, 400, s), 4), 'fosco'));
    for (let q = 0; q < 5; q++) {
      const pq = p0.clone().lerp(p1, 0.35 + q * 0.14);
      out.push(parte(elipsoide(0.0016, 0.0005, 0.0009, fixa(tomilho), 3, 5).rotateY(q * 1.3).translate(pq.x, pq.y + 0.0006, pq.z), 'fosco'));
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    const r = i === 0 ? 0.0032 : 0.0014;
    const p0 = V(-L / 2 + 0.01, R + Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4);
    out.push(parte(caule([p0, p0.clone().add(V(-0.01, 0, 0)), p0.clone().add(V(-0.016 - i * 0.003, 0.001, 0.001 * i))], r, r * 0.95, tomR(i === 0 ? rgb('#a8c070') : rgb('#7aa04a'), 0.08, 400, s), 6), 'acetinado'));
  }
  return out;
};

const gSaquinhoErvas: Gerador = (k) => {
  // trouxinha de musselina com ervas e zimbro, franzida e amarrada no pescoço, babado de pano em cima
  const { c1, c2, s } = k;
  const R = k.T * 0.34, hn = R * 1.75;
  const out: Parte[] = [];
  const pano: CorFn = (x, y, z) => {
    let c = mul(c1, 0.95 + 0.06 * fbm(x * 400, y * 400, z * 400, s));
    c = mix(c, c2, suave(0.15, 0.6, fbm(x * 90, y * 90, z * 90, s + 2)) * suave(hn * 0.95, hn * 0.6, y) * 0.55);
    c = mul(c, 1 - 0.05 * Math.abs(Math.sin(x * 2600)) * Math.abs(Math.sin(z * 2600)));
    return c;
  };
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.6, R * 0.06], [R, R * 0.6], [R * 0.98, R * 1.05], [R * 0.6, hn * 0.82], [R * 0.17, hn], [R * 0.2, hn + R * 0.2], [R * 0.55, hn + R * 0.6], [R * 0.82, hn + R * 0.85], [R * 0.6, hn + R * 0.7], [R * 0.2, hn + R * 0.45], [0, hn + R * 0.4]],
    n: 36, m: 48, cor: pano,
    mod: (t, a) => {
      const prega = 1 + 0.07 * Math.sin(a * 9 + fbm(t * 3, Math.cos(a), Math.sin(a), s) * 3) * suave(0.25, 0.5, t) + 0.16 * Math.sin(a * 7 + 1) * suave(0.62, 0.78, t);
      return prega * (1 + 0.06 * fbm(Math.cos(a) * 2, t * 5, Math.sin(a) * 2, s) * (1 - suave(0.4, 0.5, t)));
    },
  }), 'fosco', true));
  out.push(parte(amarra(0, 0, R * 0.22, R * 0.22, barbante(s), 0.0008).rotateZ(PI / 2).translate(0, hn + R * 0.04, 0), 'fosco'));
  out.push(parte(tubo([V(R * 0.2, hn, 0), V(R * 0.8, hn * 0.8, R * 0.3), V(R * 1.6, hn * 0.3, R * 0.5), V(R * 2.4, 0.001, R * 0.6), V(R * 3.2, 0.001, R * 0.2)], { raio: 0.0008, m: 5, n: 24, cor: barbante(s) }), 'fosco'));
  return out;
};

const gCascaLimaoPicada: Gerador = (k) => {
  // montinho de casca de limão picada bem fina na mezzaluna
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.48, H = R * 0.42;
  const pont: CorFn = (x, y, z) => {
    const c0 = celula(x * 900, y * 900, z * 900, s);
    let c = mix(mul(c1, 0.92), mul(c1, 1.08), fbm(x * 500, y * 500, z * 500, s) * 0.5 + 0.5);
    c = mix(c, ci, suave(0.5, 0.2, c0) * 0.45);
    return mix(c, mul(c2, 0.7), suave(0.85, 1, c0) * 0.6);
  };
  const out: Parte[] = [parte(montinho(R, H, pont, { rug: 0.08, s }), 'acetinado', true)];
  out.push(...sobreMonte(k, 90, R, H, (i) => {
    const amarelo = i % 4 !== 0;
    return bloco(k.r.f(0.0012, 0.0026), 0.0007, k.r.f(0.0008, 0.0014), amarelo ? (x, y) => (y > 0 ? mul(c1, k.r.f(0.95, 1.1)) : ci) : fixa(ci));
  }, 14).map((g) => parte(g, 'acetinado')));
  return out;
};

const gEspeciariaMoida: Gerador = (k) => {
  // especiarias moídas: montinho de pó fino com pontinhos dos grãos mais escuros e mais claros
  const { c1, c2, c3, s } = k;
  const R = k.T * 0.5, H = R * 0.85;
  const po: CorFn = (x, y, z) => {
    let c = mul(c1, 0.94 + 0.1 * fbm(x * 350, y * 350, z * 350, s));
    c = mix(c, c2, (1 - suave(0.08, 0.2, celula(x * 1100, y * 1100, z * 1100, s))) * 0.75);
    c = mix(c, c3, (1 - suave(0.06, 0.16, celula(x * 900, y * 900, z * 900, s + 7))) * 0.6);
    return mul(c, 1 - 0.06 * Math.abs(Math.sin(Math.atan2(z, x) * 11 + y * 900)) ** 8);
  };
  const out: Parte[] = [parte(montinho(R, H, po, { n: 22, m: 40, rug: 0.03, s }), 'fosco', true)];
  for (let i = 0; i < 26; i++) {
    const a = k.r.f(0, TAU), r = R * k.r.f(1.0, 1.35), q = k.r.f(0.0008, 0.0016);
    out.push(parte(elipsoide(q, q * 0.5, q, fixa(mix(c1, i % 3 ? c2 : c3, 0.4)), 3, 5).translate(Math.cos(a) * r, q * 0.4, Math.sin(a) * r), 'fosco'));
  }
  return out;
};

const gPicklingSpice: Gerador = (k) => {
  // mistura de especiarias inteiras e esmagadas: mostarda, pimenta em grão, pimenta-da-jamaica, cravo,
  // lascas de canela, louro quebrado, flocos de chili e sementes de endro
  const { s } = k;
  const R = k.T * 0.5, H = R * 0.5;
  const out: Parte[] = [];
  out.push(parte(montinho(R * 0.92, H * 0.85, (x, y, z) => mul(mix(rgb('#8a6a3a'), rgb('#5a3a20'), suave(0.2, 0.8, fbm(x * 400, y * 400, z * 400, s))), 1), { rug: 0.1, s }), 'fosco', true));
  const mostarda = rgb('#d8b048'), pimenta = rgb('#2a2018'), jamaica = rgb('#6a4028'), cravo = rgb('#4a2a18'), canela = rgb('#9a5a2a'), louro = rgb('#7a7a3a'), chili = rgb('#b02a18'), endro = rgb('#9a8a5a');
  const peca = (i: number): THREE.BufferGeometry => {
    const t = i % 9;
    if (t === 0 || t === 5) return elipsoide(0.0011, 0.0011, 0.0011, (x, y) => mul(mostarda, 0.9 + 0.2 * suave(-0.001, 0.001, y)), 3, 6);
    if (t === 1 || t === 6) return elipsoide(0.0021, 0.0021, 0.0021, (x, y, z) => mul(pimenta, 0.8 + 0.5 * Math.abs(ruido(x * 3000, y * 3000, z * 3000, s))), 4, 6, (tt, a) => 1 + 0.1 * ruido(tt * 6, Math.cos(a) * 2, Math.sin(a) * 2, s + i));
    if (t === 2) return elipsoide(0.0032, 0.003, 0.0032, (x, y, z) => mul(jamaica, 0.85 + 0.3 * fbm(x * 2000, y * 2000, z * 2000, s)), 5, 7);
    if (t === 3) {
      const g = caule([V(-0.005, 0, 0), V(0, 0, 0), V(0.004, 0, 0)], 0.0009, 0.0006, fixa(cravo), 4);
      const cab = elipsoide(0.0021, 0.0021, 0.0021, fixa(mul(cravo, 1.15)), 3, 6, (tt, a) => 1 + 0.25 * Math.abs(Math.cos(a * 2))).translate(0.0048, 0, 0);
      const j = juntar2(g, cab);
      return j;
    }
    if (t === 4) return petala(k.r.f(0.008, 0.012), 0.0045, { contorno: (u) => 0.8 + 0.2 * Math.sin(u * 9), curva: 0.25, concha: 0.9, esp: 0.0007, n: 6, m: 6, cima: tomR(mul(canela, 1.15), 0.1, 800, s + i), baixo: tomR(canela, 0.1, 800, s + i) });
    if (t === 7) return petala(k.r.f(0.006, 0.01), 0.005, { contorno: (u) => Math.sin(PI * clamp(u)) ** 0.4 * (0.7 + 0.3 * Math.sin(u * 13 + i)), curva: 0.1, esp: 0.0004, n: 6, m: 6, cima: fixa(louro), baixo: fixa(mul(louro, 1.15)) });
    return i % 2 ? petala(0.004, 0.0035, { contorno: (u) => Math.sin(PI * clamp(u)) ** 0.5, curva: 0.3, esp: 0.0004, n: 4, m: 5, cima: fixa(chili), baixo: fixa(mul(chili, 1.2)) }) : elipsoide(0.0022, 0.0006, 0.001, fixa(endro), 3, 5);
  };
  out.push(...sobreMonte(k, 64, R, H, peca, 8).map((g) => parte(g, 'acetinado')));
  return out;
};

/** Junta duas geometrias com os mesmos atributos. */
function juntar2(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const P: number[] = [], C: number[] = [], I: number[] = [];
  let base = 0;
  for (const g of [a, b]) {
    const p = g.getAttribute('position'), c = g.getAttribute('color'), ix = g.getIndex()!;
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); C.push(c.getX(i), c.getY(i), c.getZ(i)); }
    for (let i = 0; i < ix.count; i++) I.push(ix.getX(i) + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

const gCubosGelo: Gerador = (k) => {
  // cubos de gelo da forminha com ervas picadas presas dentro, foscos de geada nas quinas
  const { c1, c2, c3, s } = k;
  const a = k.T * 0.36;
  const out: Parte[] = [];
  const cubo = (i: number) => {
    const h = a / 2;
    const cor: CorFn = (x, y, z) => {
      const e = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) / h;
      const quinas = [Math.abs(x), Math.abs(y), Math.abs(z)].filter((v) => v > h * 0.82).length;
      let c = mix(c2, c1, suave(-0.2, 0.6, fbm(x * 120, y * 120, z * 120, s + i)));
      const folha = 1 - suave(0.32, 0.5, celula(x * 140 + i, y * 140, z * 140, s + 3));
      const verde = suave(-0.1, 0.25, fbm(x * 60 + i, y * 60, z * 60, s + 9));
      c = mix(c, mix(c3, mul(c3, 1.3), suave(0.2, 0.5, celula(x * 500, y * 500, z * 500, s))), folha * verde * 0.75);
      c = mix(c, rgb('#f6fafc'), (1 - suave(0.06, 0.14, celula(x * 900, y * 900, z * 900, s + i))) * 0.5);
      c = mix(c, rgb('#f2f6f8'), (quinas >= 2 ? 0.55 : 0) * suave(0.85, 1, e));
      return c;
    };
    return corpo({
      x0: -h, x1: h, n: 8, m: 24, exp: 7, tampa: true, aneisTampa: 4, cor,
      perfil: (t) => { const k2 = 1 - 0.08 * t; return { ry: h * 0.86 * k2, rz: h * k2 }; },
    });
  };
  const pos: [number, number, number, number, number][] = [[-a * 0.58, 0, -a * 0.5, 0.15, 0], [a * 0.6, 0, -a * 0.45, -0.3, 0], [0.0, 0, a * 0.62, 0.5, 0], [-a * 0.1, a * 0.82, -a * 0.2, 0.9, 0.35]];
  pos.forEach(([x, y, z, ry, rz], i) => {
    const g = cubo(i);
    g.rotateZ(rz); g.rotateY(ry);
    g.computeBoundingBox();
    g.translate(x, y - g.boundingBox!.min.y, z);
    out.push(parte(g, 'umido', i === 0));
  });
  // folhinhas de manjericão presas na superfície
  for (let i = 0; i < 3; i++) {
    const f = petala(0.011, 0.006, { contorno: contornos.oval, curva: 0.1, concha: 0.15, esp: 0.0004, n: 8, m: 6, cima: tomR(c3, 0.1, 400, s + i), baixo: tomR(mul(c3, 1.2), 0.1, 400, s + i) });
    const [x, , z, ry] = pos[i];
    f.rotateY(ry + 0.8 * i);
    f.translate(x - 0.003, a * 0.86 + 0.0003, z - 0.002);
    out.push(parte(f, 'umido'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* aspargos e alcachofra                                                */
/* ------------------------------------------------------------------ */

const gFeixeAspargos: Gerador = (k) => {
  // feixe de aspargos com a metade de baixo descascada, amarrado com barbante em dois pontos
  const { c1, c2, ci, s } = k;
  const L = k.T * 0.92, r = 0.0055;
  const out: Parte[] = [];
  const lanca = (i: number) => {
    const cor: CorFn = (x, y, z, t, a) => {
      if (t < 0.5) {
        return mul(mix(ci, c1, suave(0.3, 0.5, t) * 0.5), 0.95 + 0.06 * Math.abs(Math.sin(a * 9)) + 0.03 * fbm(x * 400, y * 400, z * 400, s + i));
      }
      let c = mul(c1, 0.94 + 0.08 * fbm(x * 300, y * 300, z * 300, s + i));
      // brácteas triangulares espaçadas e a ponta fechada, arroxeada
      const q = ((t - 0.5) / 0.045 + (a / TAU) * 0.5) % 1;
      const bract = (1 - suave(0.0, 0.25, Math.abs(q - 0.5))) * suave(0.55, 0.6, t);
      c = mix(c, c2, bract * 0.5);
      if (t > 0.86) c = mix(c, mix(c1, c2, 0.7), suave(0.86, 0.96, t) * (0.5 + 0.5 * Math.abs(Math.sin(a * 3 + t * 60))));
      return c;
    };
    return corpo({
      x0: -L / 2, x1: L / 2, n: 32, m: 12, tampa: true, aneisTampa: 2, cor,
      corTampa: (x, y, z) => mix(mul(ci, 0.95), mul(ci, 0.8), Math.abs(Math.sin(Math.hypot(y, z) * 3000)) * 0.4),
      perfil: (t) => {
        const ponta = t > 0.86 ? Math.sqrt(Math.max(0.0, 1 - ((t - 0.86) / 0.14) ** 2)) * 0.95 + 0.05 * (1 - (t - 0.86) / 0.14) : 1;
        const rr = r * (1 - 0.18 * t) * ponta * (t < 0.5 ? 0.93 : 1) * (t > 0.84 && t < 0.9 ? 1.08 : 1);
        return { ry: rr, rz: rr };
      },
      mod: (t, a) => 1 + (t > 0.86 ? 0.08 * Math.abs(Math.sin(a * 3 + t * 50)) : 0),
    });
  };
  const lugares: [number, number][] = [[r, -2 * r], [r, 0], [r, 2 * r], [r * 2.73, -r], [r * 2.73, r], [r * 4.46, 0]];
  lugares.forEach(([y, z], i) => {
    const g = lanca(i);
    g.translate(k.r.f(-0.004, 0.004), y, z);
    out.push(parte(g, 'acetinado', i === 1));
  });
  for (const x of [-L * 0.32, -L * 0.08]) out.push(parte(amarra(x, r * 2.45, r * 2.55, r * 3.15, barbante(s)), 'fosco'));
  return out;
};

const gTalosAlcachofra: Gerador = (k) => {
  // palitos de talo de alcachofra descascado e cozido, empilhados
  const { c1, c2, ci, s } = k;
  const L = k.T * 0.88, w = 0.0068, h = 0.006;
  const out: Parte[] = [];
  const palito = (i: number) => corpo({
    x0: -L / 2, x1: L / 2, n: 8, m: 14, exp: 4, tampa: true, aneisTampa: 2,
    cor: (x, y, z, t, a) => mul(mix(c1, c2, Math.abs(Math.sin(a)) ** 4 * 0.5), 0.93 + 0.08 * Math.abs(Math.sin(a * 7 + x * 40)) + 0.04 * fbm(x * 300, y * 300, z * 300, s + i)),
    corTampa: (x, y, z) => { const r = Math.hypot(y - h / 2, z); return mix(ci, mul(c2, 0.9), (1 - suave(0.0, 0.0006, Math.abs(Math.sin(r * 2400)) * 0.001)) * 0.4); },
    perfil: (t) => ({ ry: h / 2 * (1 + 0.04 * Math.sin(t * 9 + i)), rz: w / 2, cy: h / 2 }),
  });
  for (let i = 0; i < 4; i++) out.push(parte(palito(i).rotateY(k.r.f(-0.04, 0.04)).translate(k.r.f(-0.003, 0.003), 0, (i - 1.5) * w * 1.08), 'acetinado', i === 1));
  for (let i = 0; i < 3; i++) out.push(parte(palito(i + 4).rotateY(k.r.f(-0.05, 0.05)).translate(k.r.f(-0.004, 0.004), h * 0.95, (i - 1) * w * 1.08), 'acetinado'));
  return out;
};

const gFundoAlcachofra: Gerador = (k) => {
  // fundo de alcachofra limpo e cozido: disco côncavo de lados aparados em facetas, sem o feno
  const { c1, c2, ci, s } = k;
  const R = k.T * 0.5, H = R * 0.46;
  return [parte(torno({
    caminho: [[0, 0], [R * 0.18, 0], [R * 0.55, H * 0.06], [R * 0.86, H * 0.32], [R, H * 0.78], [R * 0.97, H], [R * 0.86, H * 0.98], [R * 0.6, H * 0.72], [R * 0.25, H * 0.52], [0, H * 0.5]],
    n: 26, m: 48,
    mod: (t, a) => (t < 0.55 ? 1 + 0.035 * (Math.abs(Math.cos((a * 12) / 2)) - 0.6) * suave(0.1, 0.35, t) : 1),
    cor: (x, y, z, t, a) => {
      const r = Math.hypot(x, z) / R;
      if (t > 0.58) {
        let c = mul(ci, 0.95 + 0.05 * fbm(x * 400, 0, z * 400, s));
        c = mix(c, mul(ci, 0.86), Math.abs(Math.sin(a * 40)) ** 6 * suave(0.2, 0.6, r) * 0.5);
        return mix(c, mul(c2, 1.05), suave(0.85, 0.97, r) * 0.5);
      }
      return mul(mix(c1, c2, suave(0.3, 0.9, y / H) * 0.6), 0.94 + 0.08 * Math.abs(Math.cos((a * 12) / 2)) + 0.04 * fbm(x * 300, y * 300, z * 300, s));
    },
  }), 'acetinado', true)];
};

/* ------------------------------------------------------------------ */
/* legumes torneados em barril de sete faces                            */
/* ------------------------------------------------------------------ */

const gTorneado: Gerador = (k) => {
  // barril de sete faces curvas de ponta a ponta, quinas vivas e pontas aparadas
  const { c1, c2, ci, s } = k;
  const L = k.T, Rm = L * k.L * 0.5, nf = 7;
  const pepino = k.v.v === 'pepino';
  const R = (t: number) => Rm * Math.sqrt(1 - 0.8 * (2 * t - 1) ** 2);
  const ap = Math.cos(PI / nf);
  const raioEm = (t: number, v: number) => (R(t) * ap / Math.cos((v - 0.5) * (TAU / nf))) * (1 + 0.025 * (1 - (2 * v - 1) ** 2));
  const ponto = (t: number, j: number, v: number, w = 1): [number, number, number] => {
    const f = (j + v) * (TAU / nf) + PI - PI / nf;
    const r = raioEm(t, v) * w;
    return [(t - 0.5) * L, Rm * ap + r * Math.cos(f), r * Math.sin(f)];
  };
  const cy = Rm * ap;
  const corFace = (j: number): CorFn => (x, y, z, t, v) => {
    let c = mul(c1, 0.94 + 0.06 * fbm(x * 300, y * 300, z * 300, s + j));
    c = mul(c, (1 - 0.04 * Math.abs(Math.sin(t * 50 + j)) ** 6) * (1 - 0.1 * suave(0.75, 1, Math.abs(2 * v - 1))) * (j % 2 ? 1.03 : 0.97));
    if (pepino) c = mix(c, c2, suave(0.0, 0.5, fbm(x * 90, j, v * 3, s)) * (1 - Math.abs(2 * v - 1)) ** 0.7 * 0.85);
    else c = mix(c, mul(c1, 1.12), (1 - Math.abs(2 * v - 1)) * 0.15);
    return c;
  };
  const out: Parte[] = [];
  const pecas: THREE.BufferGeometry[] = [];
  for (let j = 0; j < nf; j++) pecas.push(grade(22, 6, (t, v) => ponto(t, j, v), corFace(j)));
  for (const t of [0, 1]) {
    for (let j = 0; j < nf; j++) {
      pecas.push(grade(3, 6, (w, v) => ponto(t, j, v, w), (x, y, z) => {
        const r = Math.hypot(y - cy, z) / R(t);
        return mix(mul(ci, 1.05), mul(c1, 1.02), suave(0.3, 0.6, r));
      }));
    }
  }
  for (const g of pecas) out.push(parte(orientar(g, V(0, cy, 0)), 'acetinado', true));
  return out;
};

/* ------------------------------------------------------------------ */
/* batatas                                                               */
/* ------------------------------------------------------------------ */

const gHasselback: Gerador = (k) => {
  // batata com a base aparada e lâminas finas cortadas do topo até quase a base, abrindo de leve
  const { c1, c2, ci, s } = k;
  const L = k.T * 0.92, ry = L * 0.27, rz = L * 0.33, yb = 0.008;
  const sec = (x: number) => { const u = (2 * x) / L; const e = Math.sqrt(Math.max(0, 1 - Math.abs(u) ** 2.3)); return { ry: ry * e, rz: rz * e * (1 + 0.04 * Math.sin(u * 3)) }; };
  const pele: CorFn = (x, y, z) => mix(mul(c1, 0.92 + 0.12 * fbm(x * 200, y * 200, z * 200, s)), c2, (1 - suave(0.08, 0.18, celula(x * 260, y * 260, z * 260, s))) * 0.6);
  const out: Parte[] = [];
  // base inteira com o fundo reto
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 22, m: 20, cor: (x, y, z) => (y < 0.0006 ? mul(ci, 0.95) : pele(x, y, z, 0, 0)),
    perfil: (t) => { const q = sec((t - 0.5) * L); return { ry: q.ry, rz: q.rz, cy: ry - 0.004 }; },
    desloc: (p) => { p.y = clamp(p.y, 0, yb + 0.001); },
  }), 'acetinado', true));
  const passo = 0.0034, esp = 0.0024;
  const n = Math.floor((L * 0.86) / passo);
  for (let i = 0; i < n; i++) {
    const x0 = -L * 0.43 + i * passo;
    const xm = x0 + esp / 2;
    const q = sec(xm);
    if (q.ry < 0.004) continue;
    const g = corpo({
      x0, x1: x0 + esp, n: 1, m: 16, tampa: true, aneisTampa: 2,
      cor: pele,
      corTampa: (x, y, z) => { const d = Math.hypot((y - (ry - 0.004)) / q.ry, z / q.rz); return d > 0.93 ? pele(x, y, z, 0, 0) : mul(ci, 0.95 + 0.05 * fbm(x * 600, y * 600, z * 600, s)); },
      perfil: () => ({ ry: q.ry, rz: q.rz, cy: ry - 0.004 }),
      desloc: (p) => { if (p.y < yb - 0.001) p.y = yb - 0.001; },
    });
    const ang = (xm / (L / 2)) * 0.1;
    g.translate(-xm, -yb, 0); g.rotateZ(-ang); g.translate(xm, yb, 0);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gParisienne: Gerador = (k) => {
  // bolinha de batata tirada no boleador e salteada na manteiga até dourar
  const { c1, c2, ci, s } = k;
  const r = k.T * 0.5;
  const g = elipsoide(r, r * 0.97, r, (x, y, z) => {
    let c = mix(c1, c2, suave(0.0, 0.8, fbm(x * 220, y * 220, z * 220, s)) * 0.7);
    c = mix(c, mul(c2, 0.75), suave(0.5, 0.9, fbm(x * 500, y * 500, z * 500, s + 3)) * 0.4);
    if (x > r * 0.8) c = mix(c, ci, 0.45);
    return c;
  }, 14, 18);
  const pa = g.getAttribute('position');
  for (let i = 0; i < pa.count; i++) if (pa.getX(i) > r * 0.84) pa.setX(i, r * 0.84);
  g.computeVertexNormals();
  g.translate(0, r * 0.97, 0);
  return [parte(g, 'brilhante', true)];
};

const gGaufrette: Gerador = (k) => {
  // fatia de batata cortada no cortador ondulado girando 90 graus: treliça com furinhos
  const { c1, c2, s } = k;
  const R = k.T * 0.47, pitch = 0.0062;
  const out: Parte[] = [];
  const cor: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 300, y * 300, z * 300, s)) * 0.4), 1);
  const barra = (c: number, de: 'x' | 'z', y0: number, i: number) => {
    const meia = Math.sqrt(Math.max(0, R * R - c * c)) * 0.98;
    if (meia < 0.004) return null;
    const g = corpo({
      x0: -meia, x1: meia, n: 12, m: 8, cor,
      perfil: (t) => { const e = Math.sqrt(suave(0, 0.1, t) * suave(1, 0.9, t)); return { ry: 0.0012 * (0.5 + 0.5 * e), rz: 0.0017 * (0.6 + 0.4 * e), cy: y0 + 0.0006 * Math.sin(t * 9 + i) }; },
    });
    if (de === 'z') g.rotateY(PI / 2);
    return g.translate(de === 'x' ? 0 : c, 0, de === 'x' ? c : 0);
  };
  for (let i = -4; i <= 4; i++) {
    const a = barra(i * pitch, 'x', 0.0026, i);
    if (a) out.push(parte(a, 'acetinado', i === 0));
    const b = barra((i + 0.5) * pitch, 'z', 0.0013, i + 9);
    if (b) out.push(parte(b, 'acetinado'));
  }
  const pts: THREE.Vector3[] = [];
  for (let q = 0; q < 28; q++) { const a = (q / 28) * TAU; pts.push(V(Math.cos(a) * R, 0.0019, Math.sin(a) * R)); }
  out.push(parte(tubo(pts, { fechado: true, raio: 0.0015, achata: 1.4, m: 6, n: 56, cor }), 'acetinado'));
  return out;
};

const gRosti: Gerador = (k) => {
  // bolinho achatado de batata, cenoura e abobrinha em julienne, frito até dourar e crocante nas pontas
  const { c1, c2, cc, s } = k;
  const R = k.T * 0.47, H = 0.011;
  const out: Parte[] = [];
  const dourado: CorFn = (x, y, z) => {
    const th = fbm(x * 40, 0, z * 40, s) * 3;
    const fio = Math.abs(Math.sin((x * Math.cos(th) + z * Math.sin(th)) * 1400));
    let c = mix(c1, c2, suave(0.2, 0.9, fbm(x * 160, y * 160, z * 160, s)) * 0.6);
    return mul(c, 0.85 + 0.2 * fio);
  };
  out.push(parte(torno({
    caminho: [[0, 0], [R * 0.94, 0], [R, H * 0.35], [R * 0.93, H * 0.85], [R * 0.6, H], [0, H * 1.05]], n: 14, m: 40, cor: dourado,
    mod: (t, a) => 1 + 0.07 * fbm(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0, s) + 0.03 * ruido(Math.cos(a) * 12, Math.sin(a) * 12, t * 4, s),
    desloc: (p) => { p.y += 0.0012 * fbm(p.x * 150, 0, p.z * 150, s + 2) * suave(0.0, H, p.y); },
  }), 'acetinado', true));
  const cores = [c1, c1, rgb('#d8641a'), c1, rgb('#6a8a34'), cc];
  for (let i = 0; i < 40; i++) {
    const borda = i < 16;
    const a = borda ? (i / 16) * TAU + k.r.f(-0.15, 0.15) : k.r.f(0, TAU);
    const rr = borda ? R * k.r.f(0.75, 0.95) : R * Math.sqrt(k.r.n()) * 0.8;
    const dir = borda ? a + PI / 2 + k.r.f(-0.5, 0.5) : k.r.f(0, TAU);
    const len = borda ? k.r.f(0.01, 0.016) : k.r.f(0.014, 0.024);
    const p0 = V(Math.cos(a) * rr, borda ? H * 0.55 : H * 0.98, Math.sin(a) * rr);
    const d = V(Math.cos(dir), 0, Math.sin(dir));
    const p1 = p0.clone().addScaledVector(d, len * 0.5).add(V(0, borda ? 0.001 : 0.0015, 0));
    const p2 = p0.clone().addScaledVector(d, len).add(V(0, borda ? -0.001 : 0, 0));
    const cb = cores[i % cores.length];
    out.push(parte(tubo([p0, p1, p2], { raio: 0.0011, achata: 0.8, m: 4, n: 6, cor: (x, y, z, t) => mix(mul(cb, 0.95 + 0.1 * fbm(x * 600, y * 600, z * 600, s + i)), c2, suave(0.6, 1, Math.abs(2 * t - 1)) * 0.6) }), 'acetinado'));
  }
  return out;
};

const gNinhoBatata: Gerador = (k) => {
  // cesta de batata palha frita na fôrma de ninho: tigela de palitinhos dourados cruzados
  const { c1, c2, s } = k;
  const R = k.T * 0.48, H = R * 0.68, e = 0.006;
  const out: Parte[] = [];
  const cam: [number, number][] = [[0, 0], [R * 0.55, 0], [R * 0.86, H * 0.25], [R, H * 0.7], [R * 1.02, H], [R * 1.02 - e, H], [R - e, H * 0.72], [R * 0.84 - e, H * 0.3], [R * 0.5, e], [0, e]];
  const trama: CorFn = (x, y, z) => {
    const a = Math.atan2(z, x);
    const f1 = Math.abs(Math.sin(a * 40 + y * 300)), f2 = Math.abs(Math.sin(a * 40 - y * 300 + 1));
    let c = mix(c1, c2, suave(0.3, 0.9, fbm(x * 200, y * 200, z * 200, s)) * 0.5);
    c = mul(c, 0.55 + 0.5 * Math.max(f1, f2) ** 0.5);
    return c;
  };
  out.push(parte(torno({ caminho: cam, n: 20, m: 32, cor: trama }), 'acetinado', true));
  const sup = (sv: number, a: number, dentro: boolean): THREE.Vector3 => {
    const y = sv * H, r = (dentro ? -e - 0.0015 : 0.0015) + R * (0.55 + 0.47 * suave(0, 1, sv) ** 0.7);
    return V(Math.cos(a) * r, Math.max(0.0013, y), Math.sin(a) * r);
  };
  for (let i = 0; i < 60; i++) {
    const dentro = i >= 44;
    const sv0 = k.r.f(0.1, 0.95), a0 = k.r.f(0, TAU);
    const dir = k.r.f(-1.2, 1.2), comp = k.r.f(0.035, 0.055);
    const pts: THREE.Vector3[] = [];
    for (let q = 0; q <= 3; q++) {
      const f = q / 3 - 0.5;
      pts.push(sup(clamp(sv0 + Math.sin(dir) * f * comp / H), a0 + (Math.cos(dir) * f * comp) / R, dentro));
    }
    const tom = k.r.f(0.85, 1.12);
    out.push(parte(tubo(pts, { raio: 0.0013, m: 4, n: 6, cor: (x, y, z, t) => mul(mix(c1, c2, suave(0.7, 1, Math.abs(2 * t - 1)) * 0.6), tom) }), 'acetinado'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* tamale, berinjela, pipoca e chaudfroid                                */
/* ------------------------------------------------------------------ */

const gTamale: Gerador = (k) => {
  // tamale fechado na palha de milho: pacote retangular, pontas dobradas para cima e cordão amarrado
  const { c1, c2, s } = k;
  const L = k.T * 0.85, ry = 0.012, rz = 0.021;
  const out: Parte[] = [];
  const palha: CorFn = (x, y, z, t, a) => {
    let c = mul(mix(c1, c2, suave(0.3, 0.9, fbm(x * 60, y * 60, z * 60, s)) * 0.5), 0.9 + 0.12 * Math.abs(Math.sin(z * 900 + y * 300 + fbm(x * 30, 0, 0, s) * 2)));
    c = mix(c, mul(c2, 0.8), (1 - suave(0.0, 0.05, Math.abs(Math.sin((a - 0.4) / 2)))) * 0.6);
    return c;
  };
  out.push(parte(corpo({
    x0: -L / 2, x1: L / 2, n: 28, m: 24, exp: 3.2, cor: palha,
    perfil: (t) => { const e = Math.min(1, Math.sin(PI * t) * 3.2) ** 0.6; return { ry: ry * e, rz: rz * (0.75 + 0.25 * e), cy: ry }; },
    mod: (t, a) => 1 + 0.02 * fbm(t * 10, Math.cos(a), Math.sin(a), s),
  }), 'fosco', true));
  // abas das pontas dobradas por cima
  for (const lado of [-1, 1]) {
    const aba = petala(L * 0.24, rz * 1.5, { contorno: (u) => 0.75 + 0.25 * Math.sin(PI * clamp(u)) - 0.3 * clamp(u) ** 3, curva: -0.15, concha: -0.25, esp: 0.0008, n: 8, m: 8, cima: palha, baixo: palha });
    aba.rotateY(lado > 0 ? PI : 0);
    aba.translate(lado * (L / 2 - 0.004), ry * 2.02, 0);
    out.push(parte(aba, 'fosco'));
  }
  for (const x of [-L * 0.28, L * 0.28]) out.push(parte(amarra(x, ry, ry * 1.08, rz * 1.02, barbante(s), 0.001), 'fosco'));
  return out;
};

const gBerinjelaLosangos: Gerador = (k) => {
  // metade de berinjela com a polpa riscada em losangos e lâminas de alho nas incisões
  const { c1, c2, c3, ci, s } = k;
  const L = k.T, R = L * 0.21;
  const raio = (t: number) => { const u = 2 * t - 1; const r = R * Math.max(0, 1 - Math.abs(u) ** 2.4) ** 0.6 * (1 - 0.3 * t) * Math.sqrt(suave(1, 0.95, t)); return { ry: r * 0.92, rz: r }; };
  const sp = 0.02;
  const frac = (d: number) => ((d % 1) + 1) % 1;
  const dist = (d: number) => Math.min(frac(d), 1 - frac(d)) * 2;
  const linha = (x: number, z: number) => Math.max(1 - suave(0, 0.22, dist((x + z) / sp)), 1 - suave(0, 0.22, dist((x - z) / sp)));
  const pele: CorFn = (x, y, z) => mul(mix(c1, c2, suave(0.4, 0.9, fbm(x * 30, y * 60, z * 60, s)) * 0.5), 1 + 0.05 * fbm(x * 200, y * 200, z * 200, s));
  const face: CorFn = (x, y, z, t, v) => {
    const borda = Math.abs(2 * v - 1);
    let c = mul(ci, 0.95 + 0.06 * fbm(x * 300, 0, z * 300, s));
    c = mix(c, mul(c3, 0.55), linha(x, z) * suave(0.95, 0.85, borda) * suave(0.02, 0.06, t) * suave(0.98, 0.92, t) * 0.85);
    c = mix(c, c1, suave(0.96, 0.99, borda));
    return c;
  };
  let yc = 0;
  for (let i = 0; i <= 20; i++) yc = Math.max(yc, raio(i / 20).ry);
  const casca = grade(72, 12, (u, v) => { const { ry, rz } = raio(u); const f = PI + v * PI; return [(u - 0.5) * L, yc + ry * Math.sin(f), rz * Math.cos(f)]; }, pele);
  const corte = grade(72, 30, (u, v) => {
    const { rz } = raio(u);
    const x = (u - 0.5) * L, z = -rz + 2 * rz * v;
    const fundo = linha(x, z) * suave(1, 0.85, Math.abs(2 * v - 1)) * suave(0.02, 0.06, u) * suave(0.98, 0.92, u);
    return [x, yc - 0.0028 * fundo, z];
  }, face, true);
  const out: Parte[] = [parte(casca, 'brilhante', true), parte(corte, 'acetinado', true)];
  // ponta do cabo cortada: disquinho verde
  out.push(parte(elipsoide(0.002, R * 0.22, R * 0.24, tomR(c3, 0.1, 300, s), 4, 10).translate(L / 2 - 0.004, yc - R * 0.1, 0), 'fosco'));
  // lâminas de alho nos cruzamentos
  for (const [m, n] of [[-3, -1], [-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0], [-1, 1], [1, 1], [3, 1]]) {
    const xi = ((m + n) * sp) / 2, zi = ((m - n) * sp) / 2;
    if (Math.abs(zi) > raio(xi / L + 0.5).rz * 0.6) continue;
    const g = bloco(0.0075, 0.006, 0.0012, (xx, y) => mix(rgb('#f4ecd4'), rgb('#e8dcb0'), suave(-0.003, 0.003, y)));
    g.rotateY(PI / 4 + (m % 2 ? PI / 2 : 0)); g.rotateZ(k.r.f(-0.25, 0.25));
    g.translate(xi, yc + 0.0008, zi);
    out.push(parte(g, 'acetinado'));
  }
  return out;
};

const gPipoca: Gerador = (k) => {
  // pipoca estourada: flocos brancos de gomos estufados com pedacinhos amarelos da casca
  const { c1, c2, c3, s } = k;
  const R = k.T * 0.3, H = R * 0.9;
  const floco = (i: number): THREE.BufferGeometry => {
    const partes: THREE.BufferGeometry[] = [];
    const n = 4;
    for (let q = 0; q < n; q++) {
      const th = q * 2.4 + i, ph = (q % 2 ? 0.6 : -0.4) + 0.3 * Math.sin(i + q);
      const d = V(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)).multiplyScalar(0.0035);
      const r = 0.005 + 0.0015 * Math.sin(i * 3 + q);
      const g = elipsoide(r, r * 0.85, r * 0.9, (x, y, z) => mul(mix(c1, c2, suave(0.2, 0.9, fbm(x * 900, y * 900, z * 900, s + i)) * 0.5), 1), 5, 7, (t, a) => 1 + 0.12 * ruido(t * 5, Math.cos(a) * 2, Math.sin(a) * 2, s + i * 4 + q));
      g.rotateY(th);
      partes.push(g.translate(d.x, d.y, d.z));
    }
    partes.push(elipsoide(0.0022, 0.0009, 0.0018, fixa(c3), 3, 5).translate(0, -0.0042, 0.001));
    return partes.reduce((a, b) => juntar2(a, b));
  };
  return sobreMonte(k, 17, R, H, floco, 3).map((g, i) => parte(g, 'acetinado', i === 3));
};

const gChaudfroid: Gerador = (k) => {
  // fatias de peito de frango cobertas pela camada lisa e marfim de chaudfroid, em escama
  const { c1, c2, s } = k;
  const out: Parte[] = [];
  const L = k.T * 0.68, ry = 0.0055, rz = 0.024;
  for (let i = 0; i < 4; i++) {
    const g = corpo({
      x0: -L / 2, x1: L / 2, n: 18, m: 22, exp: 2.6,
      cor: (x, y, z) => mul(mix(c1, c2, suave(-ry, ry * 0.2, y - ry) * 0.25), 0.97 + 0.03 * fbm(x * 120, y * 120, z * 120, s + i)),
      perfil: (t) => { const u = 2 * t - 1; const e = Math.max(0, 1 - Math.abs(u) ** 2.2) ** 0.5; return { ry: ry * (0.7 + 0.3 * e), rz: rz * e * (1 + 0.08 * u), cy: ry }; },
      desloc: (p) => { if (p.y < 0.0006) p.y = 0.0006 - (0.0006 - p.y) * 0.2; },
    });
    // pé de calda escorrida em volta
    const pe = elipsoide(L * 0.52, 0.0007, rz * 1.06, fixa(mul(c2, 1.0)), 6, 16).translate(0, 0.0007, 0);
    for (const q of [g, pe]) {
      q.rotateX(-0.16);
      q.translate(0, i * 0.0042 + 0.0018, i * 0.019);
      q.rotateY(0.18);
    }
    out.push(parte(g, 'brilhante', i === 1), parte(pe, 'brilhante'));
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* registro                                                             */
/* ------------------------------------------------------------------ */

const especiaria = (v: string, cores: string) => ({ visual: vis('castanha', v, 0.05, cores), gerar: gEspeciariaMoida });

export const LOTE: Lote = {
  'capim-limao': { visual: vis('talo', 'capim-limao', 0.26, 'dcd8a0 b8a878 f2eed6 c8c090 7a9a4a'), gerar: gCapimLimao },
  tamarindo: { visual: vis('vagem', 'tamarindo', 0.13, 'a87c4a 6a4a28 5a2e16 6a3a1a'), gerar: gTamarindo },
  'bouquet-garni': { visual: vis('erva', 'bouquet-garni', 0.12, '3e6a34 9ab874 f0f0e0 6a7a3a 3a6a3a'), gerar: gBouquetGarni },
  'saquinho-ervas': { visual: vis('erva', 'saquinho-ervas', 0.065, 'f0eadb 9a9a7a f0eadb d8d0b8'), gerar: gSaquinhoErvas },
  'casca-limao-picada': { visual: vis('erva', 'casca-limao-picada', 0.05, 'ecd030 a8a020 f6f2dc e8c830'), gerar: gCascaLimaoPicada },
  'garam-masala': especiaria('garam-masala', '6e4a2c 2e1e12 6e4a2c 5a3a20 a8845a'),
  'quatre-epices': especiaria('quatre-epices', '5a4030 1a1410 5a4030 4a3020 8a7058'),
  'especiarias-mistas': especiaria('especiarias-mistas', '8a5a34 4a2e1a 8a5a34 6a4024 c8a070'),
  'especiaria-moida': especiaria('especiaria-moida', '7a5232 3a2414 7a5232 5a3a20 b08a5a'),
  'pickling-spice': { visual: vis('castanha', 'pickling-spice', 0.06, '8a6a3a 5a3a20 8a6a3a 6a4a2a'), gerar: gPicklingSpice },
  'cubos-gelo-ervas': { visual: vis('erva', 'cubos-gelo-ervas', 0.065, 'e8f0f4 b4c8d0 e8f0f4 dce8ee 3a7a2a'), gerar: gCubosGelo },
  'feixe-aspargos': { visual: vis('talo', 'feixe-aspargos', 0.21, '5a8a3a 6a4a5a dce4b4 5a7a3a'), gerar: gFeixeAspargos },
  'talos-alcachofra': { visual: vis('talo', 'talos-alcachofra', 0.075, 'd6d6a8 a8b47a ecead0 c8c090'), gerar: gTalosAlcachofra },
  'fundo-alcachofra': { visual: vis('folhoso', 'fundo-alcachofra', 0.068, 'a8b878 7a8a4a dcd8a0 c8c090'), gerar: gFundoAlcachofra },
  'cenoura-torneada': { visual: vis('cone', 'cenoura', 0.05, 'e0661a c04e10 f29a40 d86a1a', { l: 0.42 }), gerar: gTorneado },
  'batata-chateau': { visual: vis('esferoide', 'batata', 0.055, 'f0d898 dcc080 f6e6b4 d8a050', { l: 0.5 }), gerar: gTorneado },
  'pepino-torneado': { visual: vis('fuso', 'pepino', 0.05, 'cfe0a0 2e5a24 e8f0cc 8a9a5a', { l: 0.42 }), gerar: gTorneado },
  'batata-hasselback': { visual: vis('esferoide', 'hasselback', 0.1, 'a8804c 5a3a1c f2e2b0 d8a050'), gerar: gHasselback },
  'batata-parisienne': { visual: vis('esferoide', 'parisienne', 0.026, 'd89a40 9a5a20 f6e6b4 c88a3a'), gerar: gParisienne },
  'batata-gaufrette': { visual: vis('esferoide', 'gaufrette', 0.055, 'f2e4b4 e0cc90 f6ecc4 e0b060'), gerar: gGaufrette },
  'berinjela-losangos': { visual: vis('fuso', 'berinjela-losangos', 0.22, '2a1028 5a3060 ece2c0 8a6a4a 4a6a2a'), gerar: gBerinjelaLosangos },
  'rosti-legumes': { visual: vis('massa_bola', 'rosti', 0.07, 'c08436 7a4a18 f2dca0 b07028'), gerar: gRosti },
  'ninho-batata': { visual: vis('massa_bola', 'ninho', 0.1, 'd09438 9a5a18 f2dca0 c08a3a'), gerar: gNinhoBatata },
  pipoca: { visual: vis('castanha', 'pipoca', 0.08, 'f8f2e0 ece0bc f8f2e0 f0e6c8 c8983e'), gerar: gPipoca },
  'chaudfroid-frango': { visual: vis('peca_ave', 'chaudfroid', 0.13, 'eadcb4 d8c898 f2e6dc e4d6b0'), gerar: gChaudfroid },
};

