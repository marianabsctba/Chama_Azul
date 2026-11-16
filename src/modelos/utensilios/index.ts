// Ponto de entrada dos utensílios: reconhece o texto livre do catálogo,
// escolhe a família e entrega um clone do modelo cacheado.
import * as THREE from 'three';
import { GERADORES } from './familias';

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

/** Palavras que terminam em "s" mas já estão no singular. */
const INVARIANTES = new Set(['pires', 'lapis', 'chinois', 'dois', 'duas', 'tres', 'mais', 'gas', 'atras', 'apos', 'simples', 'ananas', 'cuscuz']);

function singular(p: string): string {
  if (p.length <= 3 || INVARIANTES.has(p)) return p;
  if (p.endsWith('oes') || p.endsWith('aes')) return p.slice(0, -3) + 'ao';
  if (p.endsWith('eis')) return p.slice(0, -3) + 'el';
  if (p.endsWith('ns')) return p.slice(0, -2) + 'm';
  if (p.endsWith('res') || p.endsWith('zes')) return p.slice(0, -2);
  if (p.endsWith('s') && !p.endsWith('ss')) return p.slice(0, -1);
  return p;
}

/**
 * Minúsculas, sem acento, sem parênteses, hífen e sublinhado viram espaço,
 * cada palavra no singular.
 */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9,. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(singular)
    .join(' ');
}

/** Quantidades no começo ("2 fôrmas", "duas colheres", "outra peneira"). */
const QUANTIDADE = /^(\d+([.,]\d+)? |um |uma |dois |duas |tres |quatro |seis |outra |outro )+/;
/** Partes de um utensílio que apontam para o próprio utensílio ("costas da faca"). */
const PARTE = /^(costa|dorso|lateral|ponta|cabo|pe|pes|lamina deitada|fundo|borda) (da|do|de|dos|das) /;

/* ------------------------------------------------------------------ */
/* Regras: das mais específicas para as mais gerais                    */
/* ------------------------------------------------------------------ */

type Regra = [RegExp, string | null];

const REGRAS: Regra[] = [
  // aparelhos com modelo próprio vêm antes de forno, micro-ondas e grelha sem modelo
  // o normalizar põe no singular: "micro-ondas" vira "micro onda"
  [/^(micro.?ondas?|forno de micro)/, 'microondas'],
  [/^(churrasqueira|brasa|carv[aã]o|grelha de carv)/, 'churrasqueira'],
  // sem modelo: corpo, aparelhos fixos e ingredientes (o jogo trata à parte)
  [/^(mao|dedo|polegar|palma|punho|olho|boca)\b/, null],
  [/^(forno|fogao|fogo|chama|geladeira|congelador|freezer|micro ?onda|microonda|pia|torneira|bancada|superficie|gratinador|dourador)\b/, null],
  [/^(agua|azeite|oleo|sal|licor|manteiga|farinha|calda|gelo|salsinha|maco|tira|tirinha|fondant|couverture|aspic|maionese|bolinha|alecrim|grao)\b/, null],

  // facas e lâminas
  [/^faca (de )?(pao|serra)|^faca serrilhada/, 'faca_pao'],
  [/^faca (de )?desossar/, 'faca_desossar'],
  [/^faca (de |para )?(file|filetear|fatiar|salmao)/, 'faca_file'],
  [/^faca canelle/, 'faca_canelle'],
  [/^faca (de )?ostra|^abridor/, 'faca_ostra'],
  [/^faca (pequena|de legume|sem ponta)|^faquinha/, 'faca_legumes'],
  [/^faca/, 'faca_chef'],
  [/^cutelo/, 'cutelo'],
  [/^mezzaluna/, 'mezzaluna'],
  [/^descascador/, 'descascador'],
  [/^zester|^raspador de citrico/, 'zester'],
  [/^escamador/, 'escamador'],
  [/^descarocador/, 'descarocador'],

  // tábuas
  [/^tabua girator/, 'tabua_giratoria'],
  [/^tabua/, 'tabua'],

  // tigelas, potes e louça
  [/^tigela de madeira/, 'tigela_madeira'],
  [/^(tigelinha|cumbuca|potinho|ramekin|ramequim|pote de sufle|prato de sufle)|^forminha de (empada|sufle|125)/, 'ramequim'],
  [/^(tigela|vasilha|bacia)/, 'tigela'],
  [/^(pote|vidro hermetico|recipiente)/, 'pote'],
  [/^(copo medidor|jarra|xicara medidora)/, 'jarra_medidora'],
  [/^copo/, 'copo'],
  [/^taca/, 'taca'],
  [/^(garrafa|gargalo)/, 'garrafa'],
  [/^(pilao|almofariz)/, 'pilao'],
  [/^feijao para assar|^peso de torta/, 'pesos_torta'],
  [/^prato de torta/, 'forma_torta'],
  [/^pires/, 'pires'],
  [/^prato/, 'prato'],
  [/^travessa (de vidro|rasa de vidro)|^refratario|^forma refrataria/, 'travessa_vidro'],
  [/^travessa/, 'travessa'],

  // panelas
  [/^panela (a |de )?vapor|^cesta de vapor/, 'panela_vapor'],
  [/^panela (para|de) peixe|^peixeira/, 'panela_peixe'],
  [/^panela (para )?banho maria|^panela dupla|^banho maria/, 'banho_maria'],
  [/^panela (de )?fondue/, 'panela_fondue'],
  [/^panela (de )?(fundo pesado|fundo grosso|pesada|ferro)/, 'panela_pesada'],
  [/^panela (funda|grande|alta|de macarrao|para aspargo|de fritura)|^fritadeira|^paiolo|^caldeirao/, 'panela_funda'],
  [/^cacarola/, 'cacarola'],
  [/^panela/, 'panela'],
  [/^chaleira/, 'chaleira'],
  [/^tagine/, 'tagine'],
  [/^cuscuz/, 'cuscuzeira'],

  // frigideiras, wok, chapas e grelhas
  [/^frigideira funda|^sauteuse|^sautese/, 'sauteuse'],
  [/^frigideira (de )?(panqueca|crepe)|^crepeira/, 'crepeira'],
  [/^frigideira (de )?ferro/, 'frigideira_ferro'],
  [/^omeleteira japonesa|^tamagoyaki/, 'omeleteira'],
  [/^(omeleteira|frigideira)/, 'frigideira'],
  [/^wok/, 'wok'],
  [/^chapa|^grelha canelada|^bifeteira/, 'chapa'],
  [/^suporte para peixe/, 'suporte_peixe'],
  [/^(grelha|churrasqueira)/, 'grelha'],
  [/^(grade|trempe|suporte)/, 'grade'],

  // assadeiras e fôrmas
  [/^assadeira|^forma (de )?(assar|rocambole)/, 'assadeira'],
  [/^forma (quadrada|retangular)/, 'forma_quadrada'],
  [/^forma (de )?pao/, 'forma_pao'],
  [/^terrina/, 'terrina'],
  [/^forma (de )?(pudim|bolo de anjo|kugelhopf|savarin|com furo|furada)/, 'forma_furo'],
  [/^forma (de )?charlotte/, 'charlotte'],
  [/^forma (de )?brioche/, 'forma_brioche'],
  [/^forma desmontavel|^forma de fundo removivel/, 'forma_desmontavel'],
  [/^forma (de )?(yorkshire|muffin|cupcake)/, 'forma_muffin'],
  [/^forma (de )?pizza/, 'forma_pizza'],
  [/^forma (de )?gelo/, 'forma_gelo'],
  [/^forma (de )?ravioli/, 'forma_ravioli'],
  [/^forma (de )?pastel/, 'forma_pastel'],
  [/^(forma )?ninho/, 'ninho'],
  [/^forma (dariole|individual|de timbale)|^forminha (alta|de timbale)|^timbale/, 'timbale'],
  [/^forminha de papel/, 'forminha_papel'],
  [/^forminha/, 'forminha'],
  [/^forma (de )?torta/, 'forma_torta'],
  [/^forma/, 'forma_bolo'],
  [/^aro/, 'aro'],
  [/^cortador/, 'cortador'],
  [/^carretilha/, 'carretilha'],
  [/^cone/, 'cone'],
  [/^funil de torta/, 'funil_torta'],
  [/^funil/, 'funil'],
  [/^(cartao|papelao|leque|toalhinha rendada|molde de estencil)/, 'cartao'],

  // peneiras, coadores e cestos
  [/^(peneira|tamis)/, 'peneira'],
  [/^chinois/, 'chinois'],
  [/^escorredor/, 'escorredor'],
  [/^(saco de musselina|musselina|pano fino|coador de pano)/, 'coador_pano'],
  [/^cesta de bambu/, 'cesta_bambu'],
  [/^cesta/, 'cesta_fritura'],
  [/^centrifuga/, 'centrifuga'],

  // batedores, colheres, conchas e espátulas
  [/^batedor de carne/, 'martelo'],
  [/^batedeira/, 'batedeira'],
  [/^batedor/, 'batedor'],
  [/^misturador/, 'espatula_silicone'],
  [/^colher de pau|^pa para arroz/, 'colher_pau'],
  [/^colher com furo/, 'escumadeira'],
  [/^colher (de )?cabo longo/, 'concha'],
  [/^colher (de medida|medidora)/, 'colheres_medida'],
  [/^colher/, 'colher'],
  [/^concha/, 'concha'],
  [/^escumadeira/, 'escumadeira'],
  [/^espatula (de )?(borracha|silicone)/, 'espatula_silicone'],
  [/^espatula (em angulo|angulada)/, 'espatula_angulada'],
  [/^espatula reta/, 'espatula_reta'],
  [/^espatula de bolo/, 'espatula_bolo'],
  [/^espatula de massa|^raspador/, 'raspador'],
  [/^espatula/, 'espatula_peixe'],

  // pinças, garfos e varetas
  [/^pinca comprida|^pegador|^tenaz/, 'pegador'],
  [/^pinca/, 'pinca'],
  [/^(hashi|pauzinho)/, 'hashi'],
  [/^garfo de fondue/, 'garfo_fondue'],
  [/^garfo (de dois dente|de cabo longo|trinchante)/, 'garfo_cozinha'],
  [/^garfo/, 'garfo'],
  [/^(espeto|espetinho|palito) de metal/, 'espeto_metal'],
  [/^espeto de (bambu|madeira)|^espetinho/, 'espeto_madeira'],
  [/^espeto/, 'espeto_metal'],
  [/^palito/, 'palito'],
  [/^vassoura/, 'vareta'],
  [/^agulha/, 'agulha'],
  [/^barbante/, 'barbante'],

  // massa e confeitaria
  [/^rolo/, 'rolo'],
  [/^saco (de confeitar|confeitar|com bico)/, 'saco_confeitar'],
  [/^saco/, 'saco_plastico'],
  [/^bico/, 'bico'],
  [/^pincel/, 'pincel'],

  // raladores, espremedores e prensas
  [/^ralador de madeira|^mandolina/, 'mandolina'],
  [/^ralador rotatorio/, 'mouli'],
  [/^ralador (plano|de ralo fino)|^oroshigane/, 'ralador_plano'],
  [/^ralador/, 'ralador'],
  [/^espremedor de batata/, 'espremedor_batata'],
  [/^amassador/, 'amassador'],
  [/^reamer/, 'reamer'],
  [/^espremedor/, 'espremedor'],
  [/^moedor de legume|^mouli|^passe vite|^passa legume/, 'mouli'],
  [/^moedor de carne/, 'moedor_carne'],
  [/^moedor/, 'moedor'],

  // medição
  [/^termometro (de |para )?acucar/, 'termometro_acucar'],
  [/^termometro (de |para )?(gordura|fritura)/, 'termometro_gordura'],
  [/^termometro/, 'termometro_espeto'],
  [/^balanca/, 'balanca'],
  [/^regua/, 'regua'],

  // tesouras
  [/^tesoura (de )?(ave|destrinchar)/, 'tesoura_aves'],
  [/^tesoura/, 'tesoura'],

  // folhas, panos e miudezas
  [/^papel aluminio/, 'folha_aluminio'],
  [/^papel toalha/, 'papel_toalha'],
  [/^papel/, 'folha_manteiga'],
  [/^filme/, 'filme'],
  [/^folha (de )?bananeira/, 'folha_bananeira'],
  [/^(pano|toalha)/, 'pano'],
  [/^luva/, 'luva'],
  [/^caixa de ovo/, 'caixa_ovos'],
  [/^esteira/, 'esteira'],
  [/^escova/, 'escova'],
  [/^lapis/, 'lapis'],
  [/^fita/, 'fita'],
  [/^clipe/, 'clipe'],
  [/^peso/, 'peso'],
  [/^borrifador/, 'borrifador'],
  [/^boleador|^colher de sorvete/, 'boleador'],
  [/^separador/, 'separador'],
  [/^martel/, 'martelo'],
  [/^quebrador/, 'quebrador'],

  // eletroportáteis e maçarico
  [/^processador/, 'processador'],
  [/^liquidificador/, 'liquidificador'],
  [/^maquina (de )?(abrir massa|macarrao|massa)/, 'maquina_massa'],
  [/^(sorveteira|maquina de sorvete)/, 'sorveteira'],
  [/^mixer/, 'mixer'],
  [/^macarico/, 'macarico'],
];

/** Família de um trecho já normalizado: undefined se nenhuma regra casar. */
function familiaDoTrecho(t: string): string | null | undefined {
  let s = t.trim().replace(QUANTIDADE, '');
  for (let i = 0; i < 3 && PARTE.test(s); i++) s = s.replace(PARTE, '');
  if (!s) return undefined;
  for (const [re, fam] of REGRAS) if (re.test(s)) return fam;
  return undefined;
}

/**
 * Escolhe a família de um texto livre do catálogo. Textos com "e" ou "ou"
 * ("faca ou dedos") usam a primeira alternativa que tem modelo. Devolve
 * null para texto vazio, para o que não tem modelo (mãos, forno...) e para
 * o que não for reconhecido.
 */
export function familiaUtensilio(texto: string): string | null {
  if (!texto || !texto.trim()) return null;
  const n = normalizar(texto);
  if (!n) return null;
  let achou: string | null = null;
  for (const trecho of n.split(/ (?:e|ou) /)) {
    const f = familiaDoTrecho(trecho);
    if (f) {
      achou = f;
      break;
    }
  }
  return achou;
}

/** Verdadeiro quando o texto foi reconhecido de propósito como "sem modelo". */
export function semModelo(texto: string): boolean {
  if (!texto || !texto.trim()) return true;
  const trechos = normalizar(texto).split(/ (?:e|ou) /);
  return trechos.every((t) => familiaDoTrecho(t) === null);
}

/* ------------------------------------------------------------------ */
/* Modelos                                                             */
/* ------------------------------------------------------------------ */

const cache = new Map<string, THREE.Group>();

function pontosParaVetores(destino: THREE.Group, origem: THREE.Group): void {
  for (const [k, v] of Object.entries(origem.userData)) {
    if (v instanceof THREE.Vector3) destino.userData[k] = v.clone();
  }
}

/** Modelo de uma família pelo id (clone do cacheado). */
export function criarFamilia(familia: string): THREE.Group | null {
  const gerar = GERADORES[familia];
  if (!gerar) return null;
  let base = cache.get(familia);
  if (!base) {
    base = gerar();
    base.name = familia;
    cache.set(familia, base);
  }
  const g = base.clone();
  pontosParaVetores(g, base);
  return g;
}

/** Modelo do utensílio descrito em texto livre, ou null se não houver modelo. */
export function criarUtensilio(texto: string): THREE.Group | null {
  const f = familiaUtensilio(texto);
  return f ? criarFamilia(f) : null;
}

function comoVetor(v: unknown): THREE.Vector3 {
  if (v instanceof THREE.Vector3) return v.clone();
  const o = (v ?? {}) as { x?: number; y?: number; z?: number };
  return new THREE.Vector3(o.x ?? 0, o.y ?? 0, o.z ?? 0);
}

/** Onde a mão segura e onde fica a ponta ativa, em coordenadas locais do modelo. */
export function pontosDoUtensilio(g: THREE.Group): { pega: THREE.Vector3; ponta: THREE.Vector3 } {
  return { pega: comoVetor(g.userData.pega), ponta: comoVetor(g.userData.ponta) };
}

/** Ids de todas as famílias com modelo. */
export function listarFamilias(): string[] {
  return Object.keys(GERADORES);
}
