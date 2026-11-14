// Conteúdo de recipiente: caldo, massa, creme, claras, óleo, calda.
// Uma superfície em disco que muda de nível, cor, brilho, ondas e picos.
import * as THREE from 'three';

export interface EstadoConteudo {
  cor: THREE.Color;
  nivel: number;      // altura da superfície acima do fundo (m)
  picos: number;      // 0 liso, 1 picos firmes (claras em neve, chantilly)
  ondas: number;      // 0 parado, 1 fervura forte
  brilho: number;     // 0 fosco, 1 espelhado
  espessura: number;  // 0 líquido ralo, 1 massa firme (ondas amortecidas)
}

function ruido(x: number, y: number) {
  return (
    Math.sin(x * 12.9 + y * 4.1) * 0.5 +
    Math.sin(x * 5.3 - y * 9.7 + 1.7) * 0.3 +
    Math.sin(x * 23.1 + y * 17.3 + 3.1) * 0.2
  );
}

export class Conteudo extends THREE.Group {
  readonly estado: EstadoConteudo;
  private malha: THREE.Mesh;
  private base: Float32Array;
  private raio: number;
  private material: THREE.MeshStandardMaterial;
  private t = 0;
  /** Ângulo da última mexida, para desenhar o redemoinho. */
  giro = 0;

  constructor(raio: number, cor: THREE.ColorRepresentation, nivel = 0.03) {
    super();
    this.raio = raio;
    this.estado = { cor: new THREE.Color(cor), nivel, picos: 0, ondas: 0, brilho: 0.4, espessura: 0.2 };
    const geo = new THREE.CircleGeometry(raio, 48, 0, Math.PI * 2);
    // mais anéis para deformar
    const anel = new THREE.RingGeometry(0.0001, raio, 48, 14);
    anel.rotateX(-Math.PI / 2);
    geo.dispose();
    this.base = (anel.getAttribute('position').array as Float32Array).slice();
    // um leve brilho próprio: no fundo de tigela e panela o conteúdo não some na sombra
    this.material = new THREE.MeshStandardMaterial({ color: this.estado.cor, roughness: 0.5, metalness: 0, emissive: this.estado.cor.clone().multiplyScalar(0.22) });
    this.malha = new THREE.Mesh(anel, this.material);
    this.malha.receiveShadow = true;
    this.add(this.malha);
  }

  atualizar(dt: number) {
    this.t += dt;
    const e = this.estado;
    const geo = this.malha.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const amort = 1 - e.espessura * 0.85;
    for (let i = 0; i < pos.count; i++) {
      const x = this.base[i * 3];
      const z = this.base[i * 3 + 2];
      const r = Math.sqrt(x * x + z * z) / this.raio;
      const borda = 1 - r * r;
      let y = e.nivel;
      // ondas de fervura
      y += e.ondas * amort * 0.004 * Math.sin(this.t * 9 + x * 80) * Math.cos(this.t * 7 + z * 70) * borda;
      // picos (espuma firme): relevo pontudo
      const n = ruido(x * 40, z * 40);
      y += e.picos * 0.018 * Math.max(0, n) ** 2 * borda + e.picos * 0.01 * borda;
      // redemoinho do mexer
      const ang = Math.atan2(z, x);
      y += 0.002 * Math.sin(ang * 3 - this.giro * 2) * r * (1 - e.espessura);
      arr[i * 3 + 1] = y;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    this.material.color.copy(e.cor);
    this.material.emissive.copy(e.cor).multiplyScalar(0.22);
    this.material.roughness = 1 - e.brilho * 0.9;
  }

  /** Interpola o estado para outro (t de 0 a 1). */
  misturarPara(alvo: Partial<EstadoConteudo>, k: number) {
    const e = this.estado;
    if (alvo.cor) e.cor.lerp(alvo.cor, k);
    for (const c of ['nivel', 'picos', 'ondas', 'brilho', 'espessura'] as const) {
      if (alvo[c] !== undefined) e[c] += (alvo[c]! - e[c]) * k;
    }
  }

  descartar() {
    this.malha.geometry.dispose();
    this.material.dispose();
  }
}

/** Cor e textura iniciais de um preparo a partir do texto do alvo. */
export function estadoInicial(texto: string): { cor: string; espessura: number; brilho: number } {
  const t = texto.toLowerCase();
  const tabela: [RegExp, string, number, number][] = [
    [/clara/, '#f3eed2', 0.15, 0.7],
    [/gema|creme de ovos|zabaione|sabayon/, '#f2b632', 0.4, 0.6],
    [/ovo/, '#f0c24b', 0.2, 0.6],
    [/chocolate|ganache/, '#4a2a18', 0.5, 0.8],
    [/caramelo|calda|açúcar|xarope/, '#e9d9a8', 0.25, 0.9],
    [/maionese|aïoli|aioli/, '#f4e6a6', 0.6, 0.6],
    [/hollandaise|holandês|béarnaise|bearnaise/, '#f1d27a', 0.5, 0.6],
    [/manteiga/, '#f7e08c', 0.5, 0.6],
    [/creme de leite|chantilly|nata|creme/, '#fbf6e9', 0.3, 0.5],
    [/leite|béchamel|bechamel|bechamel/, '#f6f1e4', 0.2, 0.5],
    [/tomate|vermelh/, '#c8432b', 0.35, 0.5],
    [/caldo escuro|demi|molho escuro|roux escuro|espanhol/, '#6b3a1e', 0.25, 0.7],
    [/caldo de peixe|fumet|caldo branco|caldo de galinha|consomê|consome/, '#e3c98a', 0.05, 0.9],
    [/caldo|sopa|bouillon/, '#c99a52', 0.08, 0.85],
    [/roux/, '#e7c77d', 0.6, 0.4],
    [/óleo|azeite|gordura|fritura/, '#e8c45a', 0.02, 1],
    [/vinho tinto/, '#5b1a24', 0.02, 0.9],
    [/vinho|vinagre/, '#e9dc9c', 0.02, 0.9],
    [/água|salmoura/, '#bcd8e6', 0.0, 1],
    [/massa de pão|massa|farinha|pão/, '#efdcb2', 0.95, 0.15],
    [/arroz|risoto/, '#efe6cf', 0.8, 0.3],
    [/purê|batata/, '#f0dfa4', 0.8, 0.3],
    [/merengue/, '#fbfaf5', 0.6, 0.5],
    [/geleia|gelatina|coulis|frutas vermelhas|framboesa|morango/, '#b5203b', 0.3, 0.8],
    [/limão|lima/, '#f1ec9a', 0.05, 0.9],
    [/pesto|erva|verde/, '#4f7a2b', 0.6, 0.5],
  ];
  for (const [re, cor, esp, br] of tabela) if (re.test(t)) return { cor, espessura: esp, brilho: br };
  return { cor: '#e8d7b0', espessura: 0.3, brilho: 0.5 };
}
