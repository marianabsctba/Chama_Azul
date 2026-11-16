// Peça de alimento manipulável: corta de verdade (planos de recorte + tampas),
// recebe pintura por vértice (descascar, pincelar, dourar) e cozinha (tom da cor).
import * as THREE from 'three';
import type { FormaAlimento } from '../tipos';

const BRANCO = new THREE.Color(1, 1, 1);
/** Crosta dourada de fritura, grelha e forno (sRGB). */
const CROSTA = new THREE.Color('#b8701c');
const LONGE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);

/** Material das tampas de corte (cor por vértice), compartilhado por quantidade de planos. */
const materialTampa = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });

export type Eixo = 'x' | 'y' | 'z';
/** Planos de recorte por material: um de cada lado em cada eixo. Sempre 6, para usar um shader só. */
const N_PLANOS = 6;
const planosLonge = () => Array.from({ length: N_PLANOS }, () => LONGE.clone());

/** Plano em coordenadas locais da peça, com o lado mantido (normal aponta para dentro). */
interface PlanoLocal {
  eixo: Eixo;
  pos: number;
  sinal: 1 | -1; // 1 mantém pos > corte, -1 mantém pos < corte
}

export interface Fragmento {
  grupo: THREE.Group;
  planos: PlanoLocal[];
  materiais: THREE.MeshStandardMaterial[];
  tampas: THREE.Mesh[];
  /** Intervalos do fragmento no espaço local da peça. */
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  alvo: THREE.Vector3; // deslocamento desejado (separação)
}

interface Limites { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

export class Peca extends THREE.Group {
  readonly forma: FormaAlimento;
  readonly fragmentos: Fragmento[] = [];
  /** Bloco que fica parado na tábua enquanto se corta (passa para o maior pedaço a cada corte). */
  private ancora: Fragmento | null = null;
  readonly corInterna: THREE.Color;
  readonly corCozida: THREE.Color;
  /** 0 = cru, 1 = no ponto, acima de 1 = passando do ponto. */
  cozimento = 0;
  /** Cores de vértice antes do primeiro cozimento, para o tom cozido partir sempre do cru. */
  private coresCruas = new Map<THREE.BufferGeometry, Float32Array>();
  /** Escala visual do volume (fermentar, bater). */
  volume = 1;
  private larguraZ: number;
  private alturaMax: number;
  private coresOriginais = new Map<THREE.BufferGeometry, Float32Array>();
  /** Pontos da superfície que a câmera enxerga no começo do gesto (os que contam na cobertura), no espaço local. */
  private amostras: { g: THREE.Object3D; p: THREE.Vector3 }[] = [];
  private marcadas = new Uint8Array(0);
  /** Quanto cada vértice já foi pintado (0 a 1), por geometria. */
  readonly cobertura = new Map<THREE.BufferGeometry, Float32Array>();

  constructor(forma: FormaAlimento) {
    super();
    this.forma = forma;
    this.corInterna = new THREE.Color(forma.corInterna);
    this.corCozida = new THREE.Color(forma.corCozida);
    let largura = 0;
    let altura = 0;
    for (let i = -10; i <= 10; i++) {
      const s = forma.secao((i / 10) * forma.comprimento * 0.5);
      largura = Math.max(largura, s.raioZ);
      altura = Math.max(altura, s.centroY + s.raioY);
    }
    this.larguraZ = Math.max(largura, 0.005);
    this.alturaMax = Math.max(altura, 0.005);
    for (const m of forma.malhas) {
      const g = m.geometry as THREE.BufferGeometry;
      if (!g.getAttribute('color')) {
        const n = g.getAttribute('position').count;
        const c = new Float32Array(n * 3).fill(1);
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      this.coresOriginais.set(g, (g.getAttribute('color').array as Float32Array).slice());
      this.cobertura.set(g, new Float32Array(g.getAttribute('position').count));
      m.castShadow = true;
      m.receiveShadow = true;
    }
    const L = forma.comprimento / 2;
    this.criarFragmento([], { x0: -L, x1: L, y0: 0, y1: this.alturaMax, z0: -this.larguraZ, z1: this.larguraZ });
  }

  get comprimento() { return this.forma.comprimento; }
  get largura() { return this.larguraZ * 2; }
  get altura() { return this.alturaMax; }

  private criarFragmento(planos: PlanoLocal[], lim: Limites, base?: Fragmento): Fragmento {
    const grupo = new THREE.Group();
    const materiais: THREE.MeshStandardMaterial[] = [];
    for (const m of this.forma.malhas) {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.clippingPlanes = planosLonge();
      mat.clipShadows = true;
      mat.side = THREE.DoubleSide;
      materiais.push(mat);
      const malha = new THREE.Mesh(m.geometry, mat);
      malha.castShadow = true;
      malha.receiveShadow = true;
      malha.position.copy(m.position);
      malha.quaternion.copy(m.quaternion);
      malha.scale.copy(m.scale);
      grupo.add(malha);
    }
    const f: Fragmento = { grupo, planos, materiais, tampas: [], ...lim, alvo: new THREE.Vector3() };
    if (base) {
      grupo.position.copy(base.grupo.position);
      f.alvo.copy(base.alvo);
    }
    this.add(grupo);
    this.fragmentos.push(f);
    this.reconstruirTampas(f);
    this.aplicarCozimento();
    return f;
  }

  /**
   * Corta todos os fragmentos atravessados pelo plano local eixo=pos (x atravessado, z no comprimento,
   * y deitado, paralelo à tábua). Devolve quantos foram divididos.
   */
  cortar(eixo: Eixo, pos: number): number {
    let divididos = 0;
    const k0 = `${eixo}0` as 'x0' | 'y0' | 'z0';
    const k1 = `${eixo}1` as 'x1' | 'y1' | 'z1';
    for (const f of [...this.fragmentos]) {
      const a = f[k0];
      const b = f[k1];
      const margem = (b - a) * 0.04;
      if (pos <= a + margem || pos >= b - margem) continue;
      if (this.fragmentos.length >= 48) break;
      divididos++;
      // no máximo um plano por lado de cada eixo: o novo corte substitui o antigo do mesmo lado
      const sem = (s: 1 | -1) => f.planos.filter((p) => !(p.eixo === eixo && p.sinal === s));
      const limA: Limites = { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1, z0: f.z0, z1: f.z1 };
      const limB: Limites = { ...limA };
      limA[k1] = pos;
      limB[k0] = pos;
      const fa = this.criarFragmento([...sem(-1), { eixo, pos, sinal: -1 }], limA, f);
      const fb = this.criarFragmento([...sem(1), { eixo, pos, sinal: 1 }], limB, f);
      if (this.ancora === f || !this.ancora) this.ancora = Peca.volume(fa) >= Peca.volume(fb) ? fa : fb;
      this.removerFragmento(f);
    }
    this.espalhar();
    // as faces novas do corte nascem no mesmo ponto de cozimento da peça
    if (divididos && this.cozimento > 0) this.aplicarTampas();
    return divididos;
  }

  private removerFragmento(f: Fragmento) {
    this.remove(f.grupo);
    for (const m of f.materiais) m.dispose();
    for (const t of f.tampas) t.geometry.dispose();
    const i = this.fragmentos.indexOf(f);
    if (i >= 0) this.fragmentos.splice(i, 1);
  }

  /** Separa levemente os fragmentos para o corte ficar visível. */
  espalhar(folga = 0.006) {
    const niveis = (k: 'x0' | 'y0' | 'z0') => [...new Set(this.fragmentos.map((f) => +f[k].toFixed(4)))].sort((a, b) => a - b);
    const xs = niveis('x0');
    const ys = niveis('y0');
    const zs = niveis('z0');
    // o bloco maior fica parado (as guias continuam certas sobre ele); só o que já foi cortado se afasta
    const ancora = this.ancora && this.fragmentos.includes(this.ancora) ? this.ancora : this.fragmentos.reduce((a, b) => (Peca.volume(b) > Peca.volume(a) ? b : a), this.fragmentos[0]);
    const ax = xs.indexOf(+ancora.x0.toFixed(4));
    const ay = ys.indexOf(+ancora.y0.toFixed(4));
    const az = zs.indexOf(+ancora.z0.toFixed(4));
    for (const f of this.fragmentos) {
      const ix = xs.indexOf(+f.x0.toFixed(4)) - ax;
      const iy = ys.indexOf(+f.y0.toFixed(4)) - ay;
      const iz = zs.indexOf(+f.z0.toFixed(4)) - az;
      // camadas de um corte deitado sobem um pouquinho e escorregam de lado, como uma fatia aberta
      f.alvo.set(ix * folga + Math.max(0, iy) * folga * 0.8, Math.max(0, iy) * folga * 0.6, iz * folga);
    }
  }

  private static volume(f: Fragmento) {
    return (f.x1 - f.x0) * (f.y1 - f.y0) * (f.z1 - f.z0);
  }

  /** Afasta um fragmento (usado no gesto de separar). */
  moverFragmento(f: Fragmento, desloc: THREE.Vector3) {
    f.alvo.copy(desloc);
  }

  private reconstruirTampas(f: Fragmento) {
    for (const t of f.tampas) {
      f.grupo.remove(t);
      t.geometry.dispose();
    }
    f.tampas = [];
    for (const p of f.planos) {
      const geo = p.eixo === 'x' ? this.tampaX(p.pos, f) : p.eixo === 'y' ? this.tampaY(p.pos, f) : this.tampaZ(p.pos, f);
      if (!geo) continue;
      const mat = materialTampa.clone();
      mat.clippingPlanes = planosLonge();
      mat.side = THREE.DoubleSide;
      const t = new THREE.Mesh(geo, mat);
      t.userData.plano = p;
      t.receiveShadow = true;
      f.grupo.add(t);
      f.tampas.push(t);
    }
  }

  private colorir(geo: THREE.BufferGeometry, cor: THREE.Color) {
    const n = geo.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < n; i++) {
      // leve variação do centro para a borda, para não parecer chapado
      const v = 0.92 + 0.08 * Math.sin(pos.getX(i) * 90 + pos.getY(i) * 70 + pos.getZ(i) * 50);
      c[i * 3] = cor.r * v;
      c[i * 3 + 1] = cor.g * v;
      c[i * 3 + 2] = cor.b * v;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }

  private tampaX(x: number, f: Fragmento): THREE.BufferGeometry | null {
    const s = this.forma.secao(x);
    if (s.raioY <= 0.0005 || s.raioZ <= 0.0005) return null;
    const geo = new THREE.CircleGeometry(1, 28);
    geo.rotateY(Math.PI / 2);
    geo.scale(1, s.raioY * 0.97, s.raioZ * 0.97);
    geo.translate(x, s.centroY, 0);
    this.colorir(geo, this.internaAtual());
    void f;
    return geo;
  }

  /** Tampa de um corte deitado: o contorno da peça naquela altura, visto de cima. */
  private tampaY(y: number, f: Fragmento): THREE.BufferGeometry | null {
    const lado: THREE.Vector2[] = [];
    const outro: THREE.Vector2[] = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const x = f.x0 + ((f.x1 - f.x0) * i) / n;
      const s = this.forma.secao(x);
      const r = s.raioY > 0 ? (y - s.centroY) / s.raioY : 2;
      if (Math.abs(r) >= 1) continue;
      const hz = s.raioZ * Math.sqrt(1 - r * r) * 0.97;
      lado.push(new THREE.Vector2(x, hz));
      outro.push(new THREE.Vector2(x, -hz));
    }
    if (lado.length < 2) return null;
    const geo = new THREE.ShapeGeometry(new THREE.Shape([...lado, ...outro.reverse()]));
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y, 0);
    this.colorir(geo, this.internaAtual());
    return geo;
  }

  private tampaZ(z: number, f: Fragmento): THREE.BufferGeometry | null {
    // perfil lateral: para cada x do fragmento, a altura da peça em z
    const pts: THREE.Vector2[] = [];
    const baixo: THREE.Vector2[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const x = f.x0 + ((f.x1 - f.x0) * i) / n;
      const s = this.forma.secao(x);
      const r = s.raioZ > 0 ? Math.abs(z) / s.raioZ : 2;
      if (r >= 1) continue;
      const h = s.raioY * Math.sqrt(1 - r * r) * 0.97;
      pts.push(new THREE.Vector2(x, s.centroY + h));
      baixo.push(new THREE.Vector2(x, s.centroY - h));
    }
    if (pts.length < 2) return null;
    const contorno = [...pts, ...baixo.reverse()];
    const forma = new THREE.Shape(contorno);
    const geo = new THREE.ShapeGeometry(forma);
    geo.translate(0, 0, z);
    this.colorir(geo, this.internaAtual());
    return geo;
  }

  /** Atualiza os planos de recorte em coordenadas do mundo e anima a separação. */
  atualizar(dt: number) {
    const k = 1 - Math.exp(-dt * 10);
    this.updateMatrixWorld(true);
    // o que foi adicionado sobre a peça (recheio, guarnição) segue com ela
    for (const c of this.children) if (c instanceof Peca) c.atualizar(dt);
    for (const f of this.fragmentos) {
      f.grupo.position.lerp(f.alvo, k);
      f.grupo.updateMatrixWorld(true);
      const mundo = f.grupo.matrixWorld;
      const planosMundo = f.planos.map((p) => {
        const normal = new THREE.Vector3(p.eixo === 'x' ? p.sinal : 0, p.eixo === 'y' ? p.sinal : 0, p.eixo === 'z' ? p.sinal : 0);
        const ponto = new THREE.Vector3(p.eixo === 'x' ? p.pos : 0, p.eixo === 'y' ? p.pos : 0, p.eixo === 'z' ? p.pos : 0);
        // plano: normal·x + d = 0, mantém o lado positivo (normal·x + d > 0)
        const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, ponto);
        return pl.applyMatrix4(mundo);
      });
      for (const mat of f.materiais) {
        for (let i = 0; i < N_PLANOS; i++) mat.clippingPlanes![i].copy(planosMundo[i] ?? LONGE);
      }
      for (const t of f.tampas) {
        const proprio = t.userData.plano as PlanoLocal;
        const mat = t.material as THREE.MeshStandardMaterial;
        let j = 0;
        f.planos.forEach((p, i) => {
          if (p === proprio || j >= N_PLANOS) return;
          mat.clippingPlanes![j++].copy(planosMundo[i]);
        });
        while (j < N_PLANOS) mat.clippingPlanes![j++].copy(LONGE);
      }
    }
  }

  /** Tira a casca de uma vez: a superfície inteira fica com a cor de dentro (batata, cenoura, maçã descascadas). */
  descascar() {
    const ci = this.corInterna;
    for (const m of this.forma.malhas) {
      const g = m.geometry as THREE.BufferGeometry;
      const attr = g.getAttribute('color') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const orig = this.coresOriginais.get(g);
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        // leve variação das marcas do descascador
        const v = 0.94 + 0.06 * Math.sin(pos.getX(i) * 220 + pos.getZ(i) * 170);
        arr[i * 3] = ci.r * v;
        arr[i * 3 + 1] = ci.g * v;
        arr[i * 3 + 2] = ci.b * v;
        if (orig) orig.set([arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]], i * 3);
      }
      attr.needsUpdate = true;
    }
    this.coresCruas.clear();
  }

  /** Aplica o tom de cozimento (0 cru, 1 no ponto, 1,5 passou). */
  definirCozimento(c: number) {
    this.cozimento = c;
    this.aplicarCozimento();
  }

  private aplicarCozimento() {
    const c = Math.max(0, this.cozimento);
    const t = Math.min(1, c);
    const queimado = Math.max(0, Math.min(1, (c - 1.15) * 2));
    // dourado (frito, grelhado, assado) passa do cozido para a crosta dourada; tostado escurece mais
    const dourar = Math.max(0, Math.min(1, (c - 1) / 0.12));
    const coz = this.corCozida.clone().lerp(CROSTA, dourar * 0.85);
    // o relevo de luz vem da cor cozida sem a crosta, para a crosta de fato escurecer a superfície
    const base = this.corCozida;
    const lumCoz = Math.max(0.05, base.r * 0.3 + base.g * 0.59 + base.b * 0.11);
    // a superfície vai de fato para a cor cozida (selada, dourada), guardando o relevo de luz e sombra da cor crua
    const k = t * 0.82;
    // cru de novo (ou ainda cru): o próximo cozimento parte das cores atuais, com o que foi pincelado ou empanado
    if (c === 0) this.coresCruas.clear();
    for (const m of this.forma.malhas) {
      const g = m.geometry as THREE.BufferGeometry;
      const attr = g.getAttribute('color') as THREE.BufferAttribute;
      if (!this.coresCruas.has(g)) this.coresCruas.set(g, (attr.array as Float32Array).slice());
      const cru = this.coresCruas.get(g)!;
      const orig = this.coresOriginais.get(g);
      const arr = attr.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const lum = cru[i] * 0.3 + cru[i + 1] * 0.59 + cru[i + 2] * 0.11;
        const f = Math.min(1.6, Math.max(0.45, lum / lumCoz));
        for (let j = 0; j < 3; j++) {
          const alvo = [coz.r, coz.g, coz.b][j] * f;
          const v = cru[i + j] + (alvo - cru[i + j]) * k;
          arr[i + j] = v;
          if (orig) orig[i + j] = v;
        }
      }
      attr.needsUpdate = true;
    }
    const cor = BRANCO.clone().lerp(new THREE.Color(0.18, 0.12, 0.08), queimado * 0.8);
    for (const f of this.fragmentos) for (const mat of f.materiais) mat.color.copy(cor);
    this.aplicarTampas();
  }

  /** Cor de dentro conforme o cozimento: carne vermelha fica rosada (ao ponto), o resto puxa de leve para o tom cozido. */
  private internaAtual(): THREE.Color {
    const t = Math.min(1, Math.max(0, this.cozimento));
    const ci = this.corInterna;
    const vermelha = ci.r > ci.g * 1.6 && ci.r > 0.1;
    const alvo = vermelha ? ci.clone().lerp(new THREE.Color('#c87868'), 0.75) : ci.clone().lerp(this.corCozida, 0.3);
    return ci.clone().lerp(alvo, t);
  }

  /** Recolore as faces de corte conforme o cozimento. */
  private aplicarTampas() {
    const cor = this.internaAtual();
    for (const f of this.fragmentos) {
      for (const tp of f.tampas) {
        this.colorir(tp.geometry as THREE.BufferGeometry, cor);
        (tp.material as THREE.MeshStandardMaterial).color.copy(BRANCO);
      }
    }
  }

  /** Todas as malhas visíveis (para raycast). */
  malhas(): THREE.Mesh[] {
    const lista: THREE.Mesh[] = [];
    for (const f of this.fragmentos) f.grupo.children.forEach((c) => c instanceof THREE.Mesh && lista.push(c));
    return lista;
  }

  /**
   * Pinta vértices perto de um ponto do mundo. modo 'remover' leva à cor interna,
   * 'cobrir' leva à cor dada, 'restaurar' volta à cor original. Devolve o ganho de cobertura.
   */
  pintar(pontoMundo: THREE.Vector3, raio: number, modo: 'remover' | 'cobrir' | 'restaurar', cor?: THREE.Color, forca = 0.5): number {
    this.marcarAmostras(pontoMundo, raio * 0.8);
    let ganho = 0;
    const vistos = new Set<THREE.BufferGeometry>();
    for (const f of this.fragmentos) {
      for (const malha of f.grupo.children) {
        if (!(malha instanceof THREE.Mesh) || f.tampas.includes(malha)) continue;
        const geo = malha.geometry as THREE.BufferGeometry;
        if (vistos.has(geo)) continue;
        vistos.add(geo);
        const local = malha.worldToLocal(pontoMundo.clone());
        const escala = malha.getWorldScale(new THREE.Vector3()).x || 1;
        const r = raio / escala;
        const pos = geo.getAttribute('position');
        const col = geo.getAttribute('color') as THREE.BufferAttribute;
        const arr = col.array as Float32Array;
        const orig = this.coresOriginais.get(geo)!;
        const cob = this.cobertura.get(geo)!;
        const alvo = modo === 'remover' ? this.corInterna : cor ?? BRANCO;
        const r2 = r * r;
        for (let i = 0; i < pos.count; i++) {
          const dx = pos.getX(i) - local.x;
          const dy = pos.getY(i) - local.y;
          const dz = pos.getZ(i) - local.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > r2) continue;
          const w = forca * (1 - Math.sqrt(d2) / r);
          const antes = cob[i];
          cob[i] = Math.min(1, cob[i] + w);
          ganho += cob[i] - antes;
          const k = Math.min(1, w * 1.6);
          if (modo === 'restaurar') {
            arr[i * 3] += (orig[i * 3] - arr[i * 3]) * k;
            arr[i * 3 + 1] += (orig[i * 3 + 1] - arr[i * 3 + 1]) * k;
            arr[i * 3 + 2] += (orig[i * 3 + 2] - arr[i * 3 + 2]) * k;
          } else {
            const v = modo === 'remover' ? 0.95 + 0.05 * Math.sin(i) : 1;
            arr[i * 3] += (alvo.r * v - arr[i * 3]) * k;
            arr[i * 3 + 1] += (alvo.g * v - arr[i * 3 + 1]) * k;
            arr[i * 3 + 2] += (alvo.b * v - arr[i * 3 + 2]) * k;
          }
        }
        col.needsUpdate = true;
      }
    }
    return ganho;
  }

  /** Mancha a superfície com pontinhos (sujeira para limpar, tempero, açúcar). */
  salpicar(cor: THREE.Color, densidade: number, semente = 1) {
    let s = semente * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (const geo of this.coresOriginais.keys()) {
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      const arr = col.array as Float32Array;
      const nrm = geo.getAttribute('normal');
      for (let i = 0; i < col.count; i++) {
        if (nrm && nrm.getY(i) < -0.3) continue;
        if (rnd() < densidade) {
          arr[i * 3] = cor.r;
          arr[i * 3 + 1] = cor.g;
          arr[i * 3 + 2] = cor.b;
        }
      }
      col.needsUpdate = true;
    }
  }

  /**
   * Sorteia pontos da superfície que a câmera enxerga agora: só eles contam para a cobertura,
   * então o jogador nunca fica preso tentando pintar um lado escondido, e a conta não depende
   * de como cada modelo foi subdividido.
   */
  definirElegiveis(camera: THREE.Camera) {
    this.updateMatrixWorld(true);
    const caixa = new THREE.Box3();
    for (const m of this.malhas()) caixa.expandByObject(m);
    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? caixa.max.x : caixa.min.x, i & 2 ? caixa.max.y : caixa.min.y, i & 4 ? caixa.max.z : caixa.min.z).project(camera);
      min.min(new THREE.Vector2(p.x, p.y));
      max.max(new THREE.Vector2(p.x, p.y));
    }
    const rc = new THREE.Raycaster();
    const alvo = this.malhas().filter((m) => !m.userData.plano);
    this.amostras = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        rc.setFromCamera(new THREE.Vector2(min.x + ((max.x - min.x) * i) / n, min.y + ((max.y - min.y) * j) / n), camera);
        const hit = rc.intersectObjects(alvo, false)[0];
        // cada ponto fica preso ao pedaço em que caiu (pedaços se afastam depois de um corte)
        if (hit) {
          const g = hit.object.parent ?? this;
          this.amostras.push({ g, p: g.worldToLocal(hit.point.clone()) });
        }
      }
    }
    this.marcadas = new Uint8Array(this.amostras.length);
  }

  /** Marca as amostras perto de um ponto do mundo (chamado junto com a pintura). */
  private marcarAmostras(pontoMundo: THREE.Vector3, raio: number) {
    if (!this.amostras.length) return;
    const r2 = raio * raio;
    const w = new THREE.Vector3();
    for (let i = 0; i < this.amostras.length; i++) {
      if (this.marcadas[i]) continue;
      const a = this.amostras[i];
      if (a.g.localToWorld(w.copy(a.p)).distanceToSquared(pontoMundo) <= r2) this.marcadas[i] = 1;
    }
  }

  /** Posição no mundo das amostras ainda não trabalhadas (para dicas e testes). */
  amostrasPendentes(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    this.amostras.forEach((a, i) => !this.marcadas[i] && out.push(a.g.localToWorld(a.p.clone())));
    return out;
  }

  /** Zera a contagem de cobertura (antes de um novo gesto de superfície). */
  zerarCobertura() {
    for (const c of this.cobertura.values()) c.fill(0);
    this.amostras = [];
    this.marcadas = new Uint8Array(0);
  }

  /**
   * Fração da superfície visível já trabalhada. Sem amostras, cai na conta por vértice virado para cima.
   */
  fracaoCoberta(limiar = 0.6): number {
    let total = 0;
    let ok = 0;
    if (this.amostras.length) {
      for (let i = 0; i < this.marcadas.length; i++) ok += this.marcadas[i];
      return ok / this.marcadas.length;
    }
    const q = new THREE.Quaternion();
    const n = new THREE.Vector3();
    for (const malha of this.forma.malhas) {
      const geo = malha.geometry as THREE.BufferGeometry;
      const nrm = geo.getAttribute('normal');
      const cob = this.cobertura.get(geo)!;
      malha.getWorldQuaternion(q);
      for (let i = 0; i < cob.length; i++) {
        if (nrm) {
          n.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).applyQuaternion(this.quaternion);
          if (n.y < 0.15) continue;
        }
        total++;
        if (cob[i] >= limiar) ok++;
      }
    }
    return total ? ok / total : 1;
  }

  descartar() {
    for (const c of [...this.children]) if (c instanceof Peca) c.descartar();
    for (const f of [...this.fragmentos]) this.removerFragmento(f);
    for (const g of this.coresOriginais.keys()) g.dispose();
  }
}
