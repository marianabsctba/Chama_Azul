// Peça de alimento manipulável: corta de verdade (planos de recorte + tampas),
// recebe pintura por vértice (descascar, pincelar, dourar) e cozinha (tom da cor).
import * as THREE from 'three';
import type { FormaAlimento } from '../tipos';

const BRANCO = new THREE.Color(1, 1, 1);
const LONGE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);

/** Material das tampas de corte (cor por vértice), compartilhado por quantidade de planos. */
const materialTampa = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });

/** Plano em coordenadas locais da peça, com o lado mantido (normal aponta para dentro). */
interface PlanoLocal {
  eixo: 'x' | 'z';
  pos: number;
  sinal: 1 | -1; // 1 mantém pos > corte, -1 mantém pos < corte
}

export interface Fragmento {
  grupo: THREE.Group;
  planos: PlanoLocal[];
  materiais: THREE.MeshStandardMaterial[];
  tampas: THREE.Mesh[];
  /** Intervalos do fragmento no espaço local da peça. */
  x0: number; x1: number; z0: number; z1: number;
  alvo: THREE.Vector3; // deslocamento desejado (separação)
}

export class Peca extends THREE.Group {
  readonly forma: FormaAlimento;
  readonly fragmentos: Fragmento[] = [];
  readonly corInterna: THREE.Color;
  readonly corCozida: THREE.Color;
  /** 0 = cru, 1 = no ponto, acima de 1 = passando do ponto. */
  cozimento = 0;
  /** Escala visual do volume (fermentar, bater). */
  volume = 1;
  private larguraZ: number;
  private alturaMax: number;
  private coresOriginais = new Map<THREE.BufferGeometry, Float32Array>();
  /** Pontos da superfície que a câmera enxerga no começo do gesto (os que contam na cobertura), no espaço local. */
  private amostras: THREE.Vector3[] = [];
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
    this.criarFragmento([], -L, L, -this.larguraZ, this.larguraZ);
  }

  get comprimento() { return this.forma.comprimento; }
  get largura() { return this.larguraZ * 2; }
  get altura() { return this.alturaMax; }

  private criarFragmento(planos: PlanoLocal[], x0: number, x1: number, z0: number, z1: number, base?: Fragmento): Fragmento {
    const grupo = new THREE.Group();
    const materiais: THREE.MeshStandardMaterial[] = [];
    for (const m of this.forma.malhas) {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.clippingPlanes = [LONGE.clone(), LONGE.clone(), LONGE.clone(), LONGE.clone()];
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
    const f: Fragmento = { grupo, planos, materiais, tampas: [], x0, x1, z0, z1, alvo: new THREE.Vector3() };
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

  /** Corta todos os fragmentos atravessados pelo plano local eixo=pos. Devolve quantos foram divididos. */
  cortar(eixo: 'x' | 'z', pos: number): number {
    let divididos = 0;
    for (const f of [...this.fragmentos]) {
      const a = eixo === 'x' ? f.x0 : f.z0;
      const b = eixo === 'x' ? f.x1 : f.z1;
      const margem = (b - a) * 0.04;
      if (pos <= a + margem || pos >= b - margem) continue;
      if (f.planos.length >= 4 && f.planos.filter((p) => p.eixo === eixo).length >= 2) {
        // limite de planos por material: troca o plano do mesmo eixo mais próximo
      }
      if (this.fragmentos.length >= 40) break;
      divididos++;
      const semEixo = (lista: PlanoLocal[], s: 1 | -1) => {
        // mantém no máximo um plano por lado de cada eixo (4 no total)
        const outros = lista.filter((p) => !(p.eixo === eixo && p.sinal === s));
        return outros;
      };
      const planosA: PlanoLocal[] = [...semEixo(f.planos, -1), { eixo, pos, sinal: -1 }];
      const planosB: PlanoLocal[] = [...semEixo(f.planos, 1), { eixo, pos, sinal: 1 }];
      const fa = this.criarFragmento(planosA, eixo === 'x' ? f.x0 : f.x0, eixo === 'x' ? pos : f.x1, eixo === 'z' ? f.z0 : f.z0, eixo === 'z' ? pos : f.z1, f);
      const fb = this.criarFragmento(planosB, eixo === 'x' ? pos : f.x0, eixo === 'x' ? f.x1 : f.x1, eixo === 'z' ? pos : f.z0, eixo === 'z' ? f.z1 : f.z1, f);
      this.removerFragmento(f);
      void fa; void fb;
    }
    this.espalhar();
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
    const xs = [...new Set(this.fragmentos.map((f) => +f.x0.toFixed(4)))].sort((a, b) => a - b);
    const zs = [...new Set(this.fragmentos.map((f) => +f.z0.toFixed(4)))].sort((a, b) => a - b);
    const cx = (xs.length - 1) / 2;
    const cz = (zs.length - 1) / 2;
    for (const f of this.fragmentos) {
      const ix = xs.indexOf(+f.x0.toFixed(4));
      const iz = zs.indexOf(+f.z0.toFixed(4));
      f.alvo.set((ix - cx) * folga, 0, (iz - cz) * folga);
    }
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
      const geo = p.eixo === 'x' ? this.tampaX(p.pos, f) : this.tampaZ(p.pos, f);
      if (!geo) continue;
      const mat = materialTampa.clone();
      mat.clippingPlanes = [LONGE.clone(), LONGE.clone(), LONGE.clone(), LONGE.clone()];
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
    this.colorir(geo, this.corInterna);
    void f;
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
    this.colorir(geo, this.corInterna);
    return geo;
  }

  /** Atualiza os planos de recorte em coordenadas do mundo e anima a separação. */
  atualizar(dt: number) {
    const k = 1 - Math.exp(-dt * 10);
    this.updateMatrixWorld(true);
    for (const f of this.fragmentos) {
      f.grupo.position.lerp(f.alvo, k);
      f.grupo.updateMatrixWorld(true);
      const mundo = f.grupo.matrixWorld;
      const planosMundo = f.planos.map((p) => {
        const normal = p.eixo === 'x' ? new THREE.Vector3(p.sinal, 0, 0) : new THREE.Vector3(0, 0, p.sinal);
        const ponto = p.eixo === 'x' ? new THREE.Vector3(p.pos, 0, 0) : new THREE.Vector3(0, 0, p.pos);
        // plano: normal·x + d = 0, mantém o lado positivo (normal·x + d > 0)
        const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, ponto);
        return pl.applyMatrix4(mundo);
      });
      for (const mat of f.materiais) {
        for (let i = 0; i < 4; i++) mat.clippingPlanes![i].copy(planosMundo[i] ?? LONGE);
      }
      for (const t of f.tampas) {
        const proprio = t.userData.plano as PlanoLocal;
        const mat = t.material as THREE.MeshStandardMaterial;
        let j = 0;
        f.planos.forEach((p, i) => {
          if (p === proprio || j >= 4) return;
          mat.clippingPlanes![j++].copy(planosMundo[i]);
        });
        while (j < 4) mat.clippingPlanes![j++].copy(LONGE);
      }
    }
  }

  /** Aplica o tom de cozimento (0 cru, 1 no ponto, 1,5 passou). */
  definirCozimento(c: number) {
    this.cozimento = c;
    this.aplicarCozimento();
  }

  private aplicarCozimento() {
    const c = Math.max(0, this.cozimento);
    const t = Math.min(1, c) * 0.85;
    const queimado = Math.max(0, Math.min(1, (c - 1.15) * 2));
    const alvo = this.corCozida.clone();
    // normaliza o tom cozido para multiplicar a cor de vértice sem escurecer tudo
    const m = Math.max(alvo.r, alvo.g, alvo.b, 0.001);
    alvo.multiplyScalar(1 / m);
    const cor = BRANCO.clone().lerp(alvo, t).lerp(new THREE.Color(0.18, 0.12, 0.08), queimado * 0.8);
    for (const f of this.fragmentos) {
      for (const mat of f.materiais) mat.color.copy(cor);
      for (const tp of f.tampas) (tp.material as THREE.MeshStandardMaterial).color.copy(BRANCO.clone().lerp(alvo, t * 0.4));
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
        if (hit) this.amostras.push(this.worldToLocal(hit.point.clone()));
      }
    }
    this.marcadas = new Uint8Array(this.amostras.length);
  }

  /** Marca as amostras perto de um ponto do mundo (chamado junto com a pintura). */
  private marcarAmostras(pontoMundo: THREE.Vector3, raio: number) {
    if (!this.amostras.length) return;
    const local = this.worldToLocal(pontoMundo.clone());
    const r = raio / (this.scale.x || 1);
    const r2 = r * r;
    for (let i = 0; i < this.amostras.length; i++) if (!this.marcadas[i] && this.amostras[i].distanceToSquared(local) <= r2) this.marcadas[i] = 1;
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
    for (const f of [...this.fragmentos]) this.removerFragmento(f);
    for (const g of this.coresOriginais.keys()) g.dispose();
  }
}
