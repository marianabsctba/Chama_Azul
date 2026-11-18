// A mesa de trabalho: o que está sobre a estação (peça, recipiente, conteúdo, utensílio na mão).
import * as THREE from 'three';
import { Peca } from '../pecas/peca';
import { Capa, capaDoTexto } from '../pecas/capa';
import { Conteudo, estadoInicial } from '../pecas/conteudo';
import { criarFormaAlimento, criarFormaGenerica, familiaDe } from '../modelos/alimentos';
import { criarFamilia, criarUtensilio, pontosDoUtensilio } from '../modelos/utensilios';
import type { Estacao } from '../tipos';

/** Palavras que indicam que o alvo do passo é um preparo líquido ou pastoso, não uma peça. */
const LIQUIDO = /\b(caldo|sopa|molho|creme|claras?|gemas?|ovos batidos|massa l[ií]quida|leite|calda|xarope|caramelo|[oó]leo|azeite|gordura|manteiga derretida|[aá]gua|vinho|vinagre|marinada|mistura|massa de crepe|massa de panqueca|merengue|chantilly|maionese|vinagrete|roux|b[eé]chamel|purê|pur[eê]|ganache|chocolate derretido|coulis|geleia|gelatina|ponche|liquido|l[ií]quido|suco|sorbet|sorvete|musse|mousse|recheio|massa mole|massa do bolo|massa de bolo|massa choux|fumet|consom[eê]|risoto|arroz|polenta|cuscuz|grãos|feij[aã]o|lentilha)\b/i;

export function ehLiquido(texto: string) {
  return LIQUIDO.test(texto);
}

/** Líquidos, pós e cremes não viram peça sólida em cena. */
export function ehPreparo(id: string | undefined) {
  if (!id) return true;
  const f = familiaDe(id);
  return !f || f === 'recipiente' || f === 'monte' || f === 'pasta';
}

/** O passo trabalha uma peça sólida? (com a composição revisada, o alimento já vem certo) */
export function temPeca(passo: { alimento?: string; alvo: string; meio?: string }) {
  return !!passo.alimento && !ehPreparo(passo.alimento);
}

/** Texto do conteúdo do recipiente: o meio revisado ou o alvo do passo. */
export function textoConteudo(passo: { alvo: string; meio?: string; alimento?: string }) {
  // carne moída, linguiça e tartare são massa de carne, não líquido: o id do alimento entra no texto
  const carne = passo.alimento && /mo[ií]da|lingui|hamburg|tartar|farsa|almond|kofta|kafta/i.test(passo.alimento) ? ` carne moída` : '';
  return passo.meio ?? `${passo.alvo}${carne}`;
}

const UTENSILIO_PADRAO: Record<string, string> = {
  cortar: 'faca do chef',
  picar: 'faca do chef',
  remover: 'descascador de legumes',
  cobrir: 'pincel',
  limpar: 'pano',
  'circular-rapido': 'batedor de arame',
  circular: 'colher de pau',
  dobrar: 'espátula de silicone',
  vaivem: 'rolo de massa',
  golpes: 'martelo de carne',
  pressionar: 'amassador',
  escumar: 'escumadeira',
  despejar: 'concha',
  peneirar: 'peneira',
  confeitar: 'saco de confeitar',
};

export class Mesa {
  readonly cena: THREE.Scene;
  peca: Peca | null = null;
  pecaChave = '';
  /** Nome da técnica em curso: dá o sabor (e a cor) às bases neutras do recipiente. */
  contexto = '';
  /** Ação do passo em curso (sovar, quebrar...), para saber quando o livro usa as mãos. */
  acao = '';
  recipiente: THREE.Group | null = null;
  recipienteChave = '';
  conteudo: Conteudo | null = null;
  ferramenta: THREE.Group | null = null;
  ferramentaChave = '';
  /** Raio interno e altura do fundo do recipiente atual (no espaço do mundo). */
  bocaRaio = 0.1;
  fundoY = 0;
  /** Centro do fundo interno do recipiente atual (no mundo). */
  readonly centro = new THREE.Vector3();
  readonly extras: THREE.Object3D[] = [];
  /** Miúdos (amêndoa, ervilha, uva) aparecem em punhado nos passos de panela, forno, descanso e tempero. */
  mostrarPunhado = false;
  /** Folha, massa, bacon ou papel que envolve a peça (segue a peça até o fim da técnica). */
  capa: Capa | null = null;
  private punhado: THREE.Group | null = null;
  private punhadoDe: Peca | null = null;
  private punhadoMats: THREE.MeshStandardMaterial[] = [];

  constructor(cena: THREE.Scene) {
    this.cena = cena;
  }

  /** Garante a peça do alimento (mantém a mesma se for o mesmo alimento). */
  garantirPeca(chave: string, ondeY: THREE.Vector3): Peca {
    if (this.peca && this.pecaChave === chave) return this.peca;
    this.removerPeca();
    let forma;
    try {
      forma = criarFormaAlimento(chave);
    } catch {
      forma = criarFormaGenerica(chave);
    }
    const p = new Peca(forma);
    // peças muito grandes são reduzidas para caber na tábua sem perder a proporção
    const maior = Math.max(p.comprimento, p.largura);
    if (maior > 0.7) p.scale.setScalar(0.7 / maior);
    p.position.copy(ondeY);
    this.cena.add(p);
    this.peca = p;
    this.pecaChave = chave;
    return p;
  }

  /** Cria a capa descrita no texto (ou nas pistas extras) em volta da peça atual, se ainda não houver. */
  garantirCapa(texto: string, pistas = ''): Capa | null {
    if (!this.peca) return null;
    if (this.capa && this.capa.parent === this.peca) return this.capa;
    let info = capaDoTexto(texto);
    if (!info) return null;
    // "folha" sozinha: o tipo de folha costuma estar nos ingredientes (uva, bananeira, repolho)
    if (/folha/.test(texto.toLowerCase()) && !/uva|bananeira|repolho|couve|alface/.test(texto.toLowerCase())) info = capaDoTexto(pistas) ?? info;
    const c = new Capa(this.peca, info.cor, info.cor2, info.metal);
    // papel e alumínio embrulham para cozinhar ou guardar; não vão à mesa
    c.userData.naoComestivel = /alum[ií]nio|papel|papillote|filme|musselina/i.test(texto);
    this.peca.add(c);
    this.capa = c;
    return c;
  }

  removerPeca() {
    this.descartarPunhado();
    if (this.capa) {
      this.capa.removeFromParent();
      this.capa.descartar();
      this.capa = null;
    }
    if (!this.peca) return;
    this.cena.remove(this.peca);
    this.peca.descartar();
    this.peca = null;
    this.pecaChave = '';
  }

  /**
   * Garante um recipiente (tigela, panela, frigideira, assadeira) na posição dada,
   * com medidas da boca para o conteúdo.
   */
  garantirRecipiente(texto: string, onde: THREE.Vector3, padrao = 'tigela'): THREE.Group {
    const chave = `${texto || padrao}@${onde.x.toFixed(2)},${onde.z.toFixed(2)}`;
    if (this.recipiente && this.recipienteChave === chave) return this.recipiente;
    this.removerRecipiente(false);
    let g = (texto && criarUtensilio(texto)) || criarUtensilio(padrao) || new THREE.Group();
    this.recipiente = g;
    this.recipienteChave = chave;
    g.position.copy(onde);
    this.cena.add(g);
    g.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(g);
    const tam = caixa.getSize(new THREE.Vector3());
    // a boca é o menor lado horizontal (ignora cabos compridos)
    this.bocaRaio = Math.max(0.04, Math.min(tam.x, tam.z) * 0.42);
    this.fundoY = caixa.min.y + Math.min(0.012, tam.y * 0.15);
    // nos recipientes, a ponta do modelo é o centro do fundo por dentro: é ali que vai o conteúdo
    this.centro.copy(g.position);
    const ponta = g.userData.ponta as THREE.Vector3 | undefined;
    if (ponta) {
      const p = ponta.clone().applyMatrix4(g.matrixWorld);
      this.centro.set(p.x, g.position.y, p.z);
      if (p.y > caixa.min.y && p.y < caixa.min.y + tam.y * 0.5) this.fundoY = p.y;
    }
    if (this.conteudo) {
      this.cena.remove(this.conteudo);
      this.conteudo.descartar();
      this.conteudo = null;
    }
    return g;
  }

  /**
   * Põe a peça dentro do vaso do passo (frigideira, panela, aro), no centro do fundo.
   * Devolve false quando o passo não tem vaso e a peça fica na bancada.
   */
  colocarNoVaso(peca: Peca, vaso: string | undefined, onde: THREE.Vector3, bancada = false): boolean {
    if (!vaso) return false;
    const fogo = /frigideira|wok|panela|caçarola|chapa|^aro$/i.test(vaso);
    // na bancada: fôrma, aro, forminhas, terrina, ramequim, travessa, assadeira, refratário, prato
    const deBancada = bancada && /f[oô]rma|aros?|forminha|terrina|ramequi|travessa|assadeira|refrat[aá]ri|prato|tigela|vidro|pote|cesta|esteira|grade|peneira|mouli|pil[aã]o|saco|escorredor|chinois|centr[ií]fuga|banho|cuscuzeira|tagine|sorveteira|micro|churrasqueira|vasilha|bandeja/i.test(vaso);
    if (!fogo && !deBancada) return false;
    this.garantirRecipiente(vaso, onde, fogo ? 'frigideira' : 'assadeira');
    // a peça cabe no vaso
    const maior = Math.max(peca.comprimento, peca.largura);
    // tigela, pote e ramequim afunilam: a peça assenta no fundo, mais estreito que a boca, e
    // atravessaria a parede; nos de parede reta (assadeira, fôrma, travessa) cabe quase a boca toda
    const afunila = /tigela|pote|ramequi|vasilha|bowl|cumbuca|peneira|chinois|mouli|pil[aã]o|tagine|cuscuzeira|escorredor/i.test(vaso);
    const caber = (this.bocaRaio * (afunila ? 1.15 : 1.7)) / Math.max(maior, 1e-3);
    if (peca.scale.x > caber) peca.scale.setScalar(caber);
    peca.position.set(this.centro.x, this.fundoY, this.centro.z);
    return true;
  }

  /** Texto que deu a cor ao conteúdo atual. */
  conteudoTexto = '';

  /**
   * O meio da ficha mudou (a base branca virou musse de chocolate, a calda virou ganache): o conteúdo
   * que continua no recipiente passa a ter a cor e a textura do meio novo.
   */
  trocarMeio(texto: string) {
    if (!this.conteudo || !texto || texto === this.conteudoTexto) return;
    this.conteudoTexto = texto;
    const e = estadoInicial(texto, this.contexto);
    this.conteudo.estado.cor.set(e.cor);
    this.conteudo.estado.espessura = e.espessura;
    this.conteudo.estado.brilho = e.brilho;
  }

  /** Coloca ou mantém o conteúdo dentro do recipiente atual. */
  garantirConteudo(texto: string, nivelRel = 0.45): Conteudo {
    if (!this.recipiente) throw new Error('sem recipiente');
    const caixa = new THREE.Box3().setFromObject(this.recipiente);
    const alturaUtil = Math.max(0.02, (caixa.max.y - this.fundoY) * 0.85);
    if (!this.conteudo) {
      this.conteudoTexto = texto;
      const e = estadoInicial(texto, this.contexto);
      const c = new Conteudo(this.bocaRaio * 0.95, e.cor, alturaUtil * nivelRel);
      c.estado.espessura = e.espessura;
      c.estado.brilho = e.brilho;
      // massa de carne tem relevo de grumos, não superfície lisa de líquido
      if (/carne mo[ií]da|carne picada|lingui|tartar|hamb[uú]rguer|alm[oô]ndega|bolo de carne/i.test(texto)) c.estado.picos = 1;
      c.position.set(this.centro.x, this.fundoY, this.centro.z);
      this.cena.add(c);
      this.conteudo = c;
    }
    return this.conteudo;
  }

  removerRecipiente(tudo = true) {
    if (this.recipiente) this.cena.remove(this.recipiente);
    this.recipiente = null;
    this.recipienteChave = '';
    if (this.conteudo && tudo) {
      this.cena.remove(this.conteudo);
      this.conteudo.descartar();
      this.conteudo = null;
    }
  }

  /**
   * A mão de luva azul: aberta para sovar, achatar, esfregar e espalhar; em pinça (polegar e indicador)
   * para testar com o dedo, puxar o fio, separar e descascar com os dedos.
   */
  pegarMao(texto = ''): THREE.Group | null {
    const pinca = /dedo|pin[cç]a|testar|puxar|separar|descascar|despelar|tirar|abrir com os dedos|beliscar|prega/i.test(`${texto} ${this.acao}`);
    const chave = pinca ? 'mao_pinca' : 'mao';
    if (this.ferramenta && this.ferramentaChave === chave) return this.ferramenta;
    this.soltarFerramenta();
    const g = criarFamilia(chave);
    if (!g) return null;
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.ferramenta = g;
    this.ferramentaChave = chave;
    this.cena.add(g);
    return g;
  }

  /** Utensílio que acompanha o mouse. */
  pegarFerramenta(texto: string, padrao: string): THREE.Group | null {
    // a ficha do passo diz que é com as mãos
    if (/^(m[aã]os?|dedos?)$/i.test((texto ?? '').trim())) return this.pegarMao(texto);
    // o livro faz com as mãos (sovar, socar, quebrar o talo, esfarelar, espremer, rasgar): sem utensílio
    // utensílio que não é ferramenta de mão (bancada enfarinhada, tábua, vasilha) também conta como mãos
    const semUtensilio = !texto || /^(m[aã]os?|dedos?|palmas?|punho|polegares?)/i.test(texto.trim()) || /m[aã]os|dedos|palma|punho|polegar|bancada|superf[ií]cie|t[aá]bua|vasilha|tigela/i.test(texto) || !criarUtensilio(texto);
    if (semUtensilio && /sovar|socar|quebrar|esfarelar|espremer|rasgar|torcer|achatar|amassar com|abrir com os dedos|despelar|descascar com os dedos|puxar/i.test(this.acao)) return this.pegarMao(texto);
    const t = texto && !/^(m[aã]os?|dedos?)$/i.test(texto.trim()) ? texto : UTENSILIO_PADRAO[padrao] ?? padrao;
    if (this.ferramenta && this.ferramentaChave === t) return this.ferramenta;
    this.soltarFerramenta();
    const g = criarUtensilio(t) || criarUtensilio(UTENSILIO_PADRAO[padrao] ?? padrao);
    if (!g) return null;
    // folhas (papel-manteiga, alumínio, filme, papel-toalha) não são ferramenta de mão: na mão elas
    // cobririam a câmera; o gesto usa a folha como capa ou forro
    if (/^folha_(manteiga|aluminio|bananeira)$|^papel_toalha$|^filme/.test(g.name)) return null;
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.ferramenta = g;
    this.ferramentaChave = t;
    this.cena.add(g);
    return g;
  }

  soltarFerramenta() {
    if (this.ferramenta) this.cena.remove(this.ferramenta);
    this.ferramenta = null;
    this.ferramentaChave = '';
  }

  /** Posiciona a ferramenta para que sua ponta ativa fique no ponto dado. */
  ferramentaEm(ponto: THREE.Vector3, rotY = 0, inclinacao = -0.5, rolar = 0) {
    const g = this.ferramenta;
    if (!g) return;
    const { ponta } = pontosDoUtensilio(g);
    g.rotation.set(0, 0, 0);
    g.rotation.order = 'YZX';
    const ehMao = g.name === 'mao' || g.name === 'mao_pinca';
    // diante de peça miúda (camarão, ovo, castanha) a câmera chega perto e a mão em tamanho real tapava tudo
    if (ehMao) {
      const p = this.peca;
      // tamanho "de corpo" da peça (média geométrica): antenas e rabos compridos não inflam a conta
      const tamPeca = p ? Math.cbrt(p.comprimento * p.largura * Math.max(p.altura, 0.005)) * p.scale.x : 0.08;
      g.scale.setScalar(THREE.MathUtils.clamp((tamPeca * 2) / 0.18, 0.25, 1));
    }
    // a mão chega pelo lado de trás da peça, com o punho longe da câmera: não tapa o que ela faz
    g.rotation.y = ehMao ? rotY + Math.PI : rotY;
    // a mão trabalha deitada sobre a peça: os gestos pensados para faca e colher a inclinariam de ponta
    const mao = g.name === 'mao' || g.name === 'mao_pinca';
    // dentro de tigela, panela ou fôrma a mão desce por cima, de dedos para baixo e punho para o alto:
    // deitada, ela atravessava a parede do recipiente
    const dentro = mao && !!this.recipiente && Math.hypot(ponto.x - this.centro.x, ponto.z - this.centro.z) < this.bocaRaio * 1.3;
    g.rotation.z = mao ? (dentro ? -1.15 : THREE.MathUtils.clamp(inclinacao, -0.25, 0.1)) : inclinacao;
    g.rotation.x = mao ? 0 : rolar;
    g.updateMatrixWorld(true);
    const pontaMundo = ponta.clone().multiply(g.scale).applyQuaternion(g.quaternion);
    g.position.copy(ponto).sub(pontaMundo);
  }

  /**
   * Põe sobre a peça (ou no conteúdo) os ingredientes que entram no passo. Eles ficam presos à peça
   * e seguem com ela para a panela, o forno e o prato.
   */
  /** Legumes que o passo corta junto com a peça (cebola e cenoura, mirepoix): inteiros, em tamanho real, ao lado. */
  readonly aoLado: Peca[] = [];

  limparAoLado() {
    for (const p of this.aoLado) this.cena.remove(p);
    this.aoLado.length = 0;
  }

  colocarAoLado(ids: string[], onde: THREE.Vector3, angulo: number) {
    this.limparAoLado();
    const p = this.peca;
    const base = p ? p.getWorldPosition(new THREE.Vector3()) : onde.clone();
    const larguraPeca = p ? Math.max(p.comprimento, p.largura) * p.scale.x : 0.1;
    // atrás da peça principal (longe da câmera), lado a lado
    const atras = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), angulo);
    const lado = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), angulo);
    const unicos = [...new Set(ids)];
    unicos.forEach((id, i) => {
      let item: Peca;
      try {
        item = new Peca(criarFormaAlimento(id));
      } catch {
        return;
      }
      item.userData.alimento = id;
      const maior = Math.max(item.comprimento, item.largura);
      if (maior > 0.22) item.scale.setScalar(0.22 / maior);
      item.rotation.y = angulo;
      const fx = unicos.length === 1 ? 0 : -0.5 + i / (unicos.length - 1);
      item.position.copy(base).addScaledVector(atras, larguraPeca * 0.55 + 0.06).addScaledVector(lado, fx * Math.max(0.16, larguraPeca));
      item.position.y = onde.y;
      this.aoLado.push(item);
      this.cena.add(item);
    });
  }

  adicionarSobre(ids: string[], modo: 'linha' | 'espalhado' | 'centro' = 'linha') {
    const p = this.peca;
    const n = ids.length;
    ids.forEach((id, i) => {
      let item: Peca;
      try {
        item = new Peca(criarFormaAlimento(id));
      } catch {
        return;
      }
      item.userData.alimento = id;
      if (p) {
        const tamPeca = Math.min(p.comprimento, p.largura) * p.scale.x;
        const alvo = THREE.MathUtils.clamp(tamPeca * 0.45, 0.012, 0.05);
        const s = alvo / Math.max(item.comprimento, item.largura, 1e-3) / p.scale.x;
        item.scale.setScalar(s);
        const fx = modo === 'centro' ? 0 : n === 1 ? 0 : -0.3 + (0.6 * i) / (n - 1);
        const fz = modo === 'espalhado' ? (i % 2 ? 0.25 : -0.25) : 0;
        const x = fx * p.comprimento;
        const sec = p.forma.secao(x);
        const z = fz * p.largura;
        const r = sec.raioZ > 0 ? Math.min(0.95, Math.abs(z) / sec.raioZ) : 0;
        item.position.set(x, sec.centroY + sec.raioY * Math.sqrt(1 - r * r) * 0.92, z);
        item.rotation.y = i * 1.3;
        p.add(item);
      } else if (this.conteudo) {
        const s = 0.035 / Math.max(item.comprimento, item.largura, 1e-3);
        item.scale.setScalar(s);
        const a = i * 2.4;
        // boia com metade para fora: no nível do líquido sumia dentro dele
        item.userData.flutua = item.altura * s * 0.45;
        item.position.set(Math.cos(a) * this.bocaRaio * 0.4, this.conteudo.estado.nivel + item.userData.flutua, Math.sin(a) * this.bocaRaio * 0.4);
        this.conteudo.add(item);
        this.extras.push(item);
      }
    });
  }

  adicionarExtra(o: THREE.Object3D) {
    this.extras.push(o);
    this.cena.add(o);
  }

  limparExtras() {
    for (const o of this.extras) {
      this.cena.remove(o);
      o.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
        }
      });
    }
    this.extras.length = 0;
  }

  atualizar(dt: number) {
    this.peca?.atualizar(dt);
    for (const p of this.aoLado) p.atualizar(dt);
    this.conteudo?.atualizar(dt);
    if (this.conteudo) for (const c of this.conteudo.children) if (c instanceof Peca) {
      c.atualizar(dt);
      // acompanha o nível quando o líquido sobe ou reduz
      if (typeof c.userData.flutua === 'number') c.position.y = this.conteudo.estado.nivel + c.userData.flutua;
    }
    this.atualizarPunhado();
  }

  /** Tamanho real da peça na cena (o maior lado), em metros. */
  private tamanhoPeca(p: Peca) {
    return Math.max(p.comprimento, p.largura, p.altura) * p.scale.x;
  }

  private descartarPunhado() {
    if (this.punhado) this.cena.remove(this.punhado);
    for (const m of this.punhadoMats) m.dispose();
    this.punhadoMats = [];
    this.punhado = null;
    this.punhadoDe = null;
  }

  /** Cria, posiciona e colore o punhado em volta da peça principal. */
  private atualizarPunhado() {
    const p = this.peca;
    if (!p || !this.mostrarPunhado || this.tamanhoPeca(p) >= 0.035) {
      if (this.punhado) this.punhado.visible = false;
      if (this.punhadoDe && this.punhadoDe !== p) this.descartarPunhado();
      return;
    }
    if (this.punhadoDe !== p) {
      this.descartarPunhado();
      const g = new THREE.Group();
      // um material por malha do alimento, sem recorte, com a cor acompanhando a peça
      this.punhadoMats = p.forma.malhas.map((m) => {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.clippingPlanes = [0, 1, 2, 3, 4, 5].map(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5));
        return mat;
      });
      const n = Math.max(5, Math.min(12, Math.round(0.06 / this.tamanhoPeca(p)) + 4));
      for (let i = 0; i < n; i++) {
        const un = new THREE.Group();
        p.forma.malhas.forEach((m, k) => {
          const c = new THREE.Mesh(m.geometry, this.punhadoMats[k]);
          c.position.copy(m.position);
          c.quaternion.copy(m.quaternion);
          c.scale.copy(m.scale);
          c.castShadow = true;
          c.receiveShadow = true;
          un.add(c);
        });
        // espalhados num círculo em volta da peça, sem amontoar (ângulo dourado)
        const a = i * 2.39996;
        const r = Math.sqrt((i + 1) / n);
        un.userData.desloc = new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
        un.rotation.y = a * 1.7;
        g.add(un);
      }
      this.punhado = g;
      this.punhadoDe = p;
      this.cena.add(g);
    }
    const g = this.punhado!;
    g.visible = true;
    const raio = this.recipiente ? this.bocaRaio * 0.62 : 0.055;
    g.position.copy(p.position);
    for (const un of g.children) {
      const d = un.userData.desloc as THREE.Vector2;
      un.position.set(d.x * raio, 0, d.y * raio);
      un.scale.copy(p.scale);
    }
    const base = p.fragmentos[0]?.materiais;
    if (base) this.punhadoMats.forEach((m, k) => base[k] && m.color.copy(base[k].color));
  }

  limparTudo() {
    this.limparAoLado();
    this.removerPeca();
    this.removerRecipiente(true);
    this.soltarFerramenta();
    this.limparExtras();
  }
}

/** Posição de apoio ao lado da superfície da estação (para tigela de destino, travessa etc.). */
export function aoLado(e: Estacao, dx: number, dz = 0) {
  const frente = e.superficie.clone().sub(e.camera).setY(0).normalize();
  const lado = new THREE.Vector3(-frente.z, 0, frente.x);
  return e.superficie.clone().addScaledVector(lado, dx).addScaledVector(frente, dz);
}

/** Ângulo Y que alinha o eixo X local à direita de quem olha a estação. */
export function anguloDaEstacao(e: Estacao) {
  const frente = e.superficie.clone().sub(e.camera).setY(0).normalize();
  // eixo X local deve apontar para a direita da tela
  const direita = new THREE.Vector3(-frente.z, 0, frente.x);
  return Math.atan2(-direita.z, direita.x);
}
