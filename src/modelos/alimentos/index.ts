// Ponto de entrada dos modelos 3D procedurais de alimentos.
import type { FormaAlimento } from '../../tipos';
import { gerarForma, FAMILIAS } from './familias';
import { VISUAIS } from './visuais';
import type { Visual } from './pecas';

export { materialAlimento, materiaisAlimento, type Acabamento } from './material';
export type { Familia, Visual } from './pecas';
export { VISUAIS, FAMILIAS };

/** Gera a forma 3D de um alimento do catálogo. Id desconhecido cai na forma genérica. */
export function criarFormaAlimento(id: string): FormaAlimento {
  const v = VISUAIS[id];
  if (!v) return criarFormaGenerica(id);
  return gerarForma(id, v);
}

/** Lista todos os ids com modelo próprio. */
export function listarAlimentos(): string[] {
  return Object.keys(VISUAIS);
}

/** Família do id (útil para depuração e para o jogo agrupar peças). */
export function familiaDe(id: string): string | undefined {
  return VISUAIS[id]?.f;
}

/* ------------------------------------------------------------------ */
/* Forma genérica por palavras-chave                                    */
/* ------------------------------------------------------------------ */

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Ids com o texto normalizado, do mais longo para o mais curto (casa o mais específico primeiro). */
let indiceIds: { id: string; chave: string }[] | null = null;
function indice() {
  if (!indiceIds) {
    indiceIds = Object.keys(VISUAIS)
      .map((id) => ({ id, chave: normalizar(id) }))
      .filter((e) => e.chave.length >= 3)
      .sort((a, b) => b.chave.length - a.chave.length);
  }
  return indiceIds;
}

/** Regras de palavra-chave para ingredientes que não são ids. A primeira que casar vence. */
const REGRAS: [RegExp, string | Visual][] = [
  [/\bfile(s)? de peixe|\bpeixe\b.*\bfile|\bfile\b.*\bpeixe/, { f: 'file_peixe', v: 'lado', t: 0.25, a: 0.06, l: 0.32, c1: '#f2ece4', c2: '#a8a8a8', c3: '#ffffff', ci: '#f4efe8', cc: '#f6ead8' }],
  [/\bposta(s)?\b/, 'peixe-espada'],
  [/\bpeixe(s)?\b|\bpescado/, 'merluza'],
  [/\bcamaro(es)?|\bcamarao/, 'camarao'],
  [/\bmarisco|\bfrutos do mar|\bmolusco/, 'ameijoa'],
  [/\bfrango|\bgalinha|\bave(s)?\b|\bpeito\b/, 'peito-de-frango'],
  [/\bmoid[ao]\b|\bmoida/, 'carne-moida'],
  [/\bbacon|\btoucinho/, 'toucinho'],
  [/\bpresunto/, 'presunto-parma'],
  [/\bfile\b|\bbife|\bcarne|\bboi\b|\bbovin|\blombo|\bcordeiro|\bvitela|\bporco|\bsuin/, 'contrafile'],
  [/\bosso(s)?\b/, 'tutano'],
  [/\bfigado|\bmiud/, 'figado-de-novilho'],
  [/\bqueijo/, 'gruyere'],
  [/\bmanteiga/, 'manteiga'],
  [/\bchocolate|\bcacau/, 'chocolate-barra'],
  [/\bclara(s)?\b|\bgema(s)?\b|\bovo(s)?\b/, 'ovo'],
  [/\bmerengue|\bchantilly|\bcreme batido|\bespuma/, 'chantilly'],
  [/\bfarinha|\bacucar|\bsal\b|\bamido|\bfecula|\bpo\b|\bfermento|\bespeciaria|\bcanela|\bpimenta do reino/, { f: 'monte', v: 'po', t: 0.1, a: 0.35, c1: '#f4f2ec', c2: '#e0dcd0', ci: '#f4f2ec', cc: '#e8d0a0' }],
  [/\barroz/, 'arroz_longo'],
  [/\bfeij|\bgrao(s)?\b|\blentilha|\bcerea/, 'feijao_seco'],
  [/\bcastanha|\bnoz(es)?\b|\bamendo|\bnozes/, 'nozes'],
  [/\bmassa de pao|\bmassa de torta|\bmassa\b.*\bpao|\bpate\b/, 'massa-de-pao'],
  [/\bmacarrao|\bmassa(s)? (seca|curta|longa)|\bespaguete|\bnoodle/, 'espaguete'],
  [/\bmassa/, 'massa-de-pao'],
  [/\bpao|\bpaes\b|\bmigalha|\bcrouton/, 'pao-de-forma'],
  [/\bbolo/, 'pao-de-lo'],
  [/\btorta|\btarte|\btortinha/, 'tortinha-limao'],
  [/\bbiscoito|\bbolacha/, 'biscoito-cortado'],
  [/\bsorvete|\bsorbet/, 'sorvete-bola'],
  [/\bvinho|\bconhaque|\blicor|\brum\b|\bcachaca|\bbebida/, 'vinho-tinto'],
  [/\bazeite|\boleo/, 'azeite'],
  [/\bvinagre/, 'vinagre'],
  [/\bleite|\bcreme|\bnata\b|\biogurte/, 'creme_de_leite'],
  [/\bcaramelo|\bcalda|\bmel\b|\bxarope|\bmelado/, 'caramelo'],
  [/\bmolho|\bcaldo|\bsopa|\bfundo\b|\bliquido|\bagua\b|\bsuco|\bpure|\bgeleia|\bcompota|\bmarinada/, 'caldo'],
  [/\bpasta|\bpesto|\bmostarda/, 'pesto'],
  [/\bcogumelo|\bfungo/, 'cogumelo_paris'],
  [/\bfolha(s)?\b|\bsalada|\bverdura|\bfolhosa/, 'alface'],
  [/\berva(s)?\b|\bguarnicao|\braminho|\bbouquet|\bramo\b|\btempero/, 'salsa'],
  [/\bcitric|\blimao|\blaranja|\braspas/, 'limao'],
  [/\bfruta(s)?\b|\bfrutos?\b|\bberries|\bbaga/, 'maca'],
  [/\braiz|\braizes|\btuberculo|\blegume|\bhortali|\bvegeta/, 'cenoura'],
  [/\bgelatina|\baspic/, 'gelatina-frutas'],
  [/\bgordura|\bbanha|\bsebo/, 'sebo-de-rim'],
];

const NEUTRO: Visual = { f: 'esferoide', v: 'liso', t: 0.06, a: 0.85, c1: '#d8c8a8', c2: '#c0b090', ci: '#efe6d2', cc: '#c89a5a' };

/**
 * Forma para qualquer texto do catálogo que não seja um id: primeiro procura um id
 * contido no texto (o mais específico), depois aplica as regras de palavra-chave.
 */
export function criarFormaGenerica(texto: string): FormaAlimento {
  const n = normalizar(texto ?? '');
  if (VISUAIS[texto]) return gerarForma(texto, VISUAIS[texto]);
  const alvo = ' ' + n + ' ';
  for (const e of indice()) {
    if (alvo.includes(' ' + e.chave + ' ') || (e.chave.length >= 5 && alvo.includes(' ' + e.chave))) return gerarForma(e.id, VISUAIS[e.id]);
  }
  for (const [re, r] of REGRAS) {
    if (re.test(n)) return typeof r === 'string' ? gerarForma(r, VISUAIS[r]) : gerarForma('generico-' + n, r);
  }
  return gerarForma('generico-' + n, NEUTRO);
}
