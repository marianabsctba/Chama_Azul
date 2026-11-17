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
      // no líquido ralo (água, caldo, calda) a fervura é um tremor fino: ondas grandes viravam calombos de mingau
      y += e.ondas * amort * (e.espessura < 0.2 ? 0.0012 : 0.004) * Math.sin(this.t * 9 + x * 80) * Math.cos(this.t * 7 + z * 70) * borda;
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
    // líquido ralo (água, caldo, óleo, vinho, calda) deixa ver o que está dentro: ossos, legumes, ovos
    const ralo = e.espessura < 0.12;
    // o brilho próprio clareava o líquido ralo até parecer leite: nele quase não há emissivo
    this.material.emissive.copy(e.cor).multiplyScalar(ralo ? 0.04 : 0.22);
    this.material.roughness = ralo ? 0.06 : 1 - e.brilho * 0.9;
    if (this.material.transparent !== ralo) {
      this.material.transparent = ralo;
      this.material.depthWrite = !ralo;
      this.material.needsUpdate = true;
    }
    // caldo, dashi e consomê translúcidos de verdade: dá para ver o fundo e o que boia
    this.material.opacity = ralo ? 0.38 + e.espessura * 2.5 : 1;
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
/** Sabores que tingem a base neutra (creme, calda, purê, massa) com a cor do que ela é. */
const SABORES: [RegExp, string, number, number][] = [
  [/caf[eé]|expresso|espresso/, '#3b2416', 0.1, 0.85],
  [/chocolate|cacau|ganache|sacher/, '#4a2a18', 0.5, 0.8],
  [/caramelo|butterscotch|toffee|praline|nougatine|[aâ]mbar|melado|tatin/, '#b8681e', 0.35, 0.95],
  [/blueberry|mirtilo|amora|cassis/, '#4a2654', 0.35, 0.8],
  [/framboesa|morango|groselha|cereja|frutas vermelhas|cranberry|beterraba/, '#b5203b', 0.3, 0.8],
  [/maracuj[aá]|manga|damasco|abric[oó]|p[eê]ssego|mel[aã]o|cantalupo|ab[oó]bora|cenoura/, '#e8902e', 0.35, 0.7],
  [/lim[aã]o|lima|citr/, '#f1e48a', 0.2, 0.8],
  [/pimenta[oõ]|piment[aã]o|tomate|vermelh/, '#c8432b', 0.35, 0.5],
  [/espinafre|ervilha|pesto|agri[aã]o|br[oó]colis|verde/, '#4f7a2b', 0.5, 0.5],
  [/cogumelo|duxelles|shiitake/, '#5e4a36', 0.6, 0.4],
  [/caldo escuro|demi|molho escuro|espagnole|espanhol|tutano|carne/, '#6b3a1e', 0.25, 0.7],
  [/gengibre|melado|especiaria/, '#8a5a2a', 0.4, 0.6],
];

/** Bases neutras que ganham a cor do sabor da técnica. */
const NEUTRAS = new Set(['#fbf6e9', '#f6f1e4', '#d39a3c', '#efdcb2', '#f0dfa4', '#e8d7b0', '#c99a52']);

/**
 * Cor, espessura e brilho do que está no recipiente. O texto do passo decide a base; quando a base
 * é neutra (creme, calda, massa, purê, caldo genérico), o sabor da técnica dá a cor (o creme do
 * musse de chocolate é marrom, a calda do caramelo é âmbar, o purê de blueberry é roxo).
 */
export function estadoInicial(texto: string, contexto = ''): { cor: string; espessura: number; brilho: number } {
  const t = texto.toLowerCase();
  const tabela: [RegExp, string, number, number][] = [
    // massa de carne crua (moída, linguiça, tartare): rosada, firme, opaca e fosca
    [/carne mo[ií]da|carne picada|massa de carne|lingui[cç]a|tartar|hamb[uú]rguer|alm[oô]ndega|bolo de carne/, '#a24a3e', 0.97, 0.12],
    [/clara/, '#f3eed2', 0.15, 0.7],
    [/gema|creme de ovos|zabaione|sabayon/, '#f2b632', 0.4, 0.6],
    [/ovo/, '#f0c24b', 0.2, 0.6],
    [/chocolate|ganache/, '#4a2a18', 0.5, 0.8],
    [/caramelo|butterscotch|toffee/, '#b8681e', 0.35, 0.95],
    [/caf[eé]/, '#3b2416', 0.1, 0.85],
    // calda de açúcar é transparente, só levemente dourada; o caramelo é âmbar
    // calda: dourada, lisa e espelhada como mel ralo (translúcida sobre a panela branca parecia leite)
    [/calda|a[cç][uú]car|xarope/, '#d39a3c', 0.13, 1],
    [/maionese|aïoli|aioli/, '#f4e6a6', 0.6, 0.6],
    [/hollandaise|holandês|béarnaise|bearnaise/, '#f1d27a', 0.5, 0.6],
    [/manteiga/, '#f7e08c', 0.5, 0.6],
    [/creme de leite|chantilly|nata|creme/, '#fbf6e9', 0.3, 0.5],
    [/leite|béchamel|bechamel/, '#f6f1e4', 0.2, 0.5],
    [/tomate|vermelh/, '#c8432b', 0.35, 0.5],
    [/caldo escuro|demi|molho escuro|roux escuro|espanhol/, '#6b3a1e', 0.25, 0.7],
    [/caldo de peixe|fumet|caldo branco|caldo de galinha|consomê|consome|dashi/, '#e3c98a', 0.05, 0.9],
    [/caldo|sopa|bouillon/, '#c99a52', 0.08, 0.85],
    [/roux/, '#e7c77d', 0.6, 0.4],
    [/óleo|azeite|gordura|fritura/, '#e8c45a', 0.02, 1],
    [/vinho tinto/, '#4a1220', 0.1, 0.9],
    [/vinho|vinagre/, '#e9dc9c', 0.02, 0.9],
    [/água|salmoura|gelo/, '#bcd8e6', 0.0, 1],
    [/massa de pão|massa|farinha|pão/, '#efdcb2', 0.95, 0.15],
    [/arroz|risoto/, '#efe6cf', 0.8, 0.3],
    [/purê|batata/, '#f0dfa4', 0.8, 0.3],
    [/merengue/, '#fbfaf5', 0.6, 0.5],
    [/geleia|gelatina|coulis|frutas vermelhas|framboesa|morango/, '#b5203b', 0.3, 0.8],
    [/limão|lima/, '#f1ec9a', 0.05, 0.9],
    [/pesto|erva|verde/, '#4f7a2b', 0.6, 0.5],
  ];
  let base: { cor: string; espessura: number; brilho: number } = { cor: '#e8d7b0', espessura: 0.3, brilho: 0.5 };
  for (const [re, cor, esp, br] of tabela) if (re.test(t)) { base = { cor, espessura: esp, brilho: br }; break; }
  if (NEUTRAS.has(base.cor)) {
    const tudo = `${t} ${contexto.toLowerCase()}`;
    for (const [re, cor, esp, br] of SABORES) if (re.test(tudo)) return { cor, espessura: Math.max(base.espessura, esp), brilho: br };
  }
  return base;
}
