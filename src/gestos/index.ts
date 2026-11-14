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

export function estacaoDoPasso(p: Passo, t: Tecnica, anterior: CenaEstacao | null): CenaEstacao {
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
