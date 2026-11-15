// Liga cada gesto à sua fábrica e à estação da cozinha onde acontece.
import type { CenaEstacao, Passo, Tecnica } from '../tipos';
import type { FabricaGesto } from './base';
import { gestoCortar } from './cortar';
import { gestoSuperficie } from './superficie';
import { gestoRitmo } from './ritmo';
import { gestoCalor } from './calor';
import { gestoTempo, gestoVerter, gestoMedir } from './tempo_verter';
import { gestoMontar, gestoConfeitar, gestoTestar, gestoSeparar } from './montar';

export const FABRICAS: Record<Passo['gesto'], FabricaGesto> = {
  cortar: gestoCortar,
  superficie: gestoSuperficie,
  ritmo: gestoRitmo,
  calor: gestoCalor,
  tempo: gestoTempo,
  verter: gestoVerter,
  montar: gestoMontar,
  confeitar: gestoConfeitar,
  medir: gestoMedir,
  testar: gestoTestar,
  separar: gestoSeparar,
};

const DOCE = new Set(['pastelaria', 'bolos', 'sobremesas', 'paes']);

const VASOS = 'frigideira|wok|panela|caçarola|chapa|aro|banho-maria|assadeira|travessa|ramequim|fôrma|forma|tigela|pilão';
/** Vasos que ficam no fogo: o passo feito neles acontece no fogão. */
export const VASO_FOGO = /frigideira|wok|panela|caçarola|chapa|^aro|banho-maria/i;
/** Ações que, logo depois de um passo no fogo, continuam no mesmo vaso (mexer o ovo na frigideira, virar a crêpe). */
const CONTINUA_NO_FOGO = /mexer|virar|enrolar|dobrar|despejar|regar|quebrar|inclinar|moldar|espalhar|rechear|misturar|adicionar|incorporar|soltar|separar|amassar|pressionar|testar/i;

/**
 * Onde o passo acontece, como o livro diz: o recipiente revisado, o que o texto nomeia
 * ("na frigideira", "no aro") ou, para mexer, virar e despejar logo depois do fogo, o mesmo vaso.
 */
export function vasoDoPasso(t: Tecnica, i: number, fundo = 0): string | undefined {
  const p = t.passos[i];
  if (!p || fundo > 6) return undefined;
  if (p.recipiente) return p.recipiente;
  const texto = `${p.acao} ${p.alvo} ${p.parametro}`;
  const nomeado = texto.match(new RegExp(`\\b(?:na|no|numa|num|em|dentro d[ao]|sobre a|sobre o)\\s+(${VASOS})`, 'i')) ?? (p.utensilio ?? '').match(new RegExp(`(${VASOS})`, 'i'));
  if (nomeado) return nomeado[1].toLowerCase();
  if (/t[aá]bua|prato|travessa|papel|grelha|tigela/i.test(texto)) return undefined;
  if (i > 0 && p.gesto !== 'calor' && p.gesto !== 'cortar' && p.gesto !== 'tempo' && p.gesto !== 'medir' && CONTINUA_NO_FOGO.test(p.acao) && !/escorr|coar|peneir/i.test(p.acao)) {
    const ant = t.passos[i - 1];
    const vasoAnt = ant.gesto === 'calor' && ant.variante !== 'forno' ? vasoDoPasso(t, i - 1, fundo + 1) ?? (ant.variante === 'frigideira' ? 'frigideira' : 'panela') : vasoDoPasso(t, i - 1, fundo + 1);
    if (vasoAnt && VASO_FOGO.test(vasoAnt)) return vasoAnt;
  }
  return undefined;
}

export function estacaoDoPasso(p: Passo, t: Tecnica, anterior: CenaEstacao | null, vaso?: string): CenaEstacao {
  // mexer, virar, despejar dentro de um vaso no fogo: no fogão
  if (vaso && VASO_FOGO.test(vaso) && ['ritmo', 'montar', 'verter', 'separar', 'superficie', 'testar'].includes(p.gesto) && p.variante !== 'escumar') return 'fogao';
  switch (p.gesto) {
    case 'calor':
      return p.variante === 'forno' ? 'forno' : 'fogao';
    case 'tempo':
      return p.variante === 'frio' ? 'geladeira' : DOCE.has(t.bancada) ? 'confeitaria' : 'corte';
    case 'medir':
      return 'balanca';
    case 'confeitar':
      return 'confeitaria';
    case 'superficie':
      return p.variante === 'limpar' && /lavar|água/.test(p.acao + p.parametro) ? 'pia' : DOCE.has(t.bancada) ? 'confeitaria' : 'corte';
    case 'verter':
      return p.variante === 'escumar' ? 'fogao' : /escorrer/.test(p.acao) ? 'pia' : DOCE.has(t.bancada) ? 'confeitaria' : 'corte';
    case 'testar':
      // testa onde a coisa está
      return anterior ?? 'corte';
    default:
      return DOCE.has(t.bancada) ? 'confeitaria' : 'corte';
  }
}

/** Nome amigável do gesto, para a interface. */
export const NOME_GESTO: Record<Passo['gesto'], string> = {
  cortar: 'Faca',
  superficie: 'Superfície',
  ritmo: 'Ritmo',
  calor: 'Calor',
  tempo: 'Tempo',
  verter: 'Verter',
  montar: 'Montagem',
  confeitar: 'Confeitar',
  medir: 'Medida',
  testar: 'Olho de chef',
  separar: 'Separar',
};
