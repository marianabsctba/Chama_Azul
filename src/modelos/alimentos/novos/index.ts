// Junta os lotes de alimentos novos num registro só.
import type { AlimentoNovo } from './tipos';
import { LOTE as aves } from './aves';
import { LOTE as peixes } from './peixes';
import { LOTE as cortes } from './cortes';
import { LOTE as files } from './files';
import { LOTE as cena1 } from './cena1';
import { LOTE as cena2 } from './cena2';
import { LOTE as cena3 } from './cena3';
import { LOTE as cena4 } from './cena4';
import { LOTE as frutos_do_mar } from './frutos_do_mar';
import { LOTE as ovos_queijos } from './ovos_queijos';
import { LOTE as doces } from './doces';
import { LOTE as frutas_enfeites } from './frutas_enfeites';
import { LOTE as carnes } from './carnes';
import { LOTE as paes_massas } from './paes_massas';
import { LOTE as ervas_legumes } from './ervas_legumes';

export const NOVOS: Record<string, AlimentoNovo> = { ...aves, ...peixes, ...cortes, ...files, ...cena1, ...cena2, ...cena3, ...cena4, ...frutos_do_mar, ...ovos_queijos, ...doces, ...frutas_enfeites, ...carnes, ...paes_massas, ...ervas_legumes };
