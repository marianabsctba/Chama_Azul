// Contratos compartilhados entre catálogo, modelos 3D, gestos e interface.
import type * as THREE from 'three';

/** Famílias de gesto: cada ação do livro cai em uma delas. */
export type Gesto =
  | 'cortar'     // faca segue guias sobre a peça (cortar, fatiar, picar, desossar...)
  | 'superficie' // pincel ou lâmina percorre a superfície (descascar, escamar, pincelar...)
  | 'ritmo'      // movimento repetido dentro do recipiente (bater, mexer, sovar...)
  | 'calor'      // controle de fogo ou forno com termômetro (ferver, fritar, assar...)
  | 'tempo'      // deixar o tempo agir (descansar, fermentar, gelar, marinar...)
  | 'verter'     // inclinar recipiente ou peneira (coar, despejar, escumar...)
  | 'montar'     // encaixar, enrolar, amarrar, rechear, decorar...
  | 'confeitar'  // saco de confeitar com pressão
  | 'medir'      // pesar ou medir até a marca
  | 'testar'     // observar, sondar e decidir se está no ponto
  | 'separar';   // puxar uma parte para longe da outra

export type Unidade = 'C' | 'mm' | 'cm' | 'min' | 'h' | 's' | 'g' | 'kg' | 'ml' | 'l' | '%';

export interface Meta {
  valor: number;
  max?: number;
  unidade: Unidade;
}

export interface Passo {
  acao: string;         // verbo original do catálogo
  gesto: Gesto;
  variante: string;     // detalhe do gesto (ex.: "circular", "vaivem", "pressionar")
  alvo: string;
  utensilio: string;    // texto livre do catálogo
  parametro: string;
  meta?: Meta;          // número principal extraído do parâmetro
  alimento?: string;    // id do alimento principal do passo, se houver
  /** Ingredientes que entram neste passo e ficam sobre ou dentro da peça. */
  adicionar?: string[];
  /** Líquido ou gordura do recipiente (azeite, água, caldo...). Nunca vira peça. */
  meio?: string;
  /** Recipiente pedido (frigideira, wok, tigela...). */
  recipiente?: string;
  /** Passos de inspecionar: a pergunta certa, as opções e a resposta. */
  pergunta?: string;
  opcoes?: string[];
  correta?: number;
  explicacao?: string;
  objetos?: string[];
  cheirar?: boolean;
  /** Como a peça entra no passo: inteira, em metades, fatias, tiras, cubos ou picada. */
  estadoPeca?: EstadoPeca;
  /** Ponto da peça no passo: crua, cozida, dourada (frita, grelhada, assada) ou tostada. */
  ponto?: 'cru' | 'cozido' | 'dourado' | 'tostado';
}

export type EstadoPeca = 'inteiro' | 'metades' | 'fatias' | 'tiras' | 'cubos' | 'picado';

export type LoucaServir = 'prato' | 'tigela' | 'travessa' | 'taca' | 'tabua' | 'tigelinha' | 'ramequim' | 'xicara' | 'molheira' | 'pote' | 'cumbuca' | 'copo';
export type FormaServida = 'inteiro' | 'fatias' | 'medalhoes' | 'tiras' | 'cubos' | 'pedacos' | 'ralado' | 'lascas' | 'desfiado';
export type EstadoServido = 'cru' | 'cozido' | 'dourado' | 'tostado';

/** Ficha do que a técnica produz e de como vai à mesa, tirada do livro. */
export interface PratoFinal {
  principal?: string;
  acompanhamentos?: string[];
  servir?: LoucaServir;
  /** Como o principal aparece: inteiro, em fatias, ralado, em lascas... */
  forma?: FormaServida;
  /** Ponto do principal: cru, cozido, dourado (frito, grelhado, assado) ou tostado. */
  estado?: EstadoServido;
  /** Quantas unidades do principal vão à louça (3 crepes, 6 bolinhos). */
  quantidade?: number;
  /** Cor do líquido, molho ou pasta que enche a louça (hex). */
  liquido?: string;
  /** Líquido translúcido (caldo claro, consomê, calda). */
  claro?: boolean;
  /** Pasta com grão aparente (pesto no pilão, tapenade). */
  granulado?: boolean;
  /** Textura do conteúdo: pó seco em montinho (especiarias) ou picos firmes (claras em neve, merengue, chantilly). */
  textura?: 'po' | 'picos';
}

export interface Tecnica {
  id: string;
  capitulo: string;
  bancada: string;      // id da bancada (capítulo agrupado)
  nome: string;
  ingredientes: string[];
  alimentos: string[];  // ids de alimentos reconhecidos
  utensilios: string[]; // texto livre
  passos: Passo[];
  ponto_critico: string;
  erro_comum: string;
  prato?: PratoFinal;
}

export interface Bancada {
  id: string;
  nome: string;
  capitulos: string[];
  cor: string;
}

export interface AlimentoInfo {
  id: string;
  nome: string;
  forma: string;
}

export interface Catalogo {
  bancadas: Bancada[];
  tecnicas: Tecnica[];
  alimentos: AlimentoInfo[];
  tabelas: { nome: string; linhas: string[][] }[];
}

/* ------------------------------------------------------------------ */
/* Modelos 3D                                                          */
/* ------------------------------------------------------------------ */

/**
 * Seção transversal de uma peça ao longo do seu eixo de comprimento (eixo X local).
 * x vai de -comprimento/2 a +comprimento/2. Usado para desenhar a tampa do corte.
 */
export interface Secao {
  raioY: number; // meia altura (eixo Y)
  raioZ: number; // meia largura (eixo Z)
  centroY: number;
}

/** O que um gerador de alimento devolve. A classe Peca cuida de cortes, casca e cozimento. */
export interface FormaAlimento {
  /** Malhas com atributo de cor por vértice (casca/pele). Geometria bem subdividida. */
  malhas: THREE.Mesh[];
  /** Comprimento ao longo do eixo X local, em metros. */
  comprimento: number;
  /** Seção transversal em x (para a tampa do corte). */
  secao: (x: number) => Secao;
  /** Cor interna (polpa, carne, miolo) para tampas de corte e casca removida. */
  corInterna: string;
  /** Cor quando bem dourado/cozido. */
  corCozida: string;
}

export type CenaEstacao = 'corte' | 'fogao' | 'forno' | 'pia' | 'confeitaria' | 'geladeira' | 'caderno' | 'balanca';

export interface Estacao {
  id: CenaEstacao;
  /** Onde a câmera fica ao trabalhar nessa estação. */
  camera: THREE.Vector3;
  /** Para onde a câmera olha. */
  olhar: THREE.Vector3;
  /** Ponto da superfície de trabalho (onde as peças são colocadas). */
  superficie: THREE.Vector3;
}

export interface Cozinha {
  grupo: THREE.Group;
  estacoes: Record<CenaEstacao, Estacao>;
  /** Caixas que bloqueiam o andar em primeira pessoa (no plano XZ). */
  colisores: THREE.Box3[];
  /** Ponto inicial do jogador. */
  inicio: { posicao: THREE.Vector3; olhar: THREE.Vector3 };
  /** Chamado a cada quadro (chuva, chama, vapor). */
  atualizar: (dt: number, t: number) => void;
  /** Liga/desliga visualmente a chama de uma boca (0 a 1). */
  definirChama: (intensidade: number) => void;
  /** Luz interna do forno (0 a 1). */
  definirForno: (intensidade: number) => void;
  /** Abre ou fecha a porta do forno ou da geladeira (com animação). */
  abrirPorta: (qual: 'forno' | 'geladeira', aberta: boolean) => void;
}
