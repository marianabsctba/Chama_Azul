// Registro dos geradores paramétricos por família. Cada gerador recebe a linha
// da tabela visual (tamanho real, cores, proporções, variante) e devolve as
// partes da peça; `gerarForma` junta tudo com os materiais compartilhados.
import type { FormaAlimento } from '../../tipos';
import { finalizar, semente } from './nucleo';
import { criarCtx, type Familia, type Gerador, type Visual } from './pecas';
import type { Acabamento } from './material';
import { gEsferoide, gAbobora, gCone, gFuso, gFolhoso, gBulbo, gTalo, gCacho, gErva, gVagem, gEspiga, gCogumelo, gPimenta, gAlga } from './fam_vegetais';
import { gCitrico, gCaroco, gBaga, gTropical } from './fam_frutas';
import { gPeixe, gPeixeChato, gFilePeixe, gCrustaceo, gBivalve, gConchaEspiral, gCefalopode } from './fam_mar';
import { gAve, gPecaAve, gCarne, gCarneOsso, gCarneMoida, gMiudo, gLinguica } from './fam_carnes';
import { gMassaBola, gPao, gPaoChato, gQueijo, gBarra, gPlaca, gMonte, gCastanha, gMassa } from './fam_padaria';
import { gRizoma, gBacon, gFoieGras, gTerrina, gPolenta, gOmelete, gFrittata, gFalafel, gYorkshire, gCranberry, gBaunilha, gGergelim, gSalvia, gCrepe, gCrepeEnrolada, gCrepeQuadrada, gCrepeLeque, gPanqueca, comVariantes } from './fam_extras';
import { gRecipiente, gPasta, gBolo, gTorta, gConfeito, gChoux, gFolhado, gMerengue } from './fam_doces';

export type { Familia, Visual } from './pecas';

interface Registro {
  g: Gerador;
  /** Altura relativa padrão. */
  a: number;
  /** Largura relativa padrão. */
  l: number;
  ac: Acabamento;
}

export const FAMILIAS: Record<Familia, Registro> = {
  esferoide: { g: gEsferoide, a: 0.9, l: 1, ac: 'acetinado' },
  citrico: { g: gCitrico, a: 0.95, l: 1, ac: 'acetinado' },
  caroco: { g: gCaroco, a: 0.95, l: 1, ac: 'acetinado' },
  baga: { g: comVariantes(gBaga, { cranberry: gCranberry }), a: 1, l: 1, ac: 'brilhante' },
  tropical: { g: gTropical, a: 1, l: 1, ac: 'acetinado' },
  abobora: { g: gAbobora, a: 0.6, l: 0.4, ac: 'acetinado' },
  cone: { g: gCone, a: 1, l: 0.16, ac: 'acetinado' },
  fuso: { g: gFuso, a: 1, l: 0.2, ac: 'acetinado' },
  folhoso: { g: gFolhoso, a: 0.9, l: 0.3, ac: 'acetinado' },
  bulbo: { g: gBulbo, a: 0.85, l: 1, ac: 'fosco' },
  talo: { g: gTalo, a: 1, l: 0.04, ac: 'acetinado' },
  cacho: { g: gCacho, a: 1, l: 0.1, ac: 'acetinado' },
  erva: { g: comVariantes(gErva, { salvia: gSalvia }), a: 1, l: 0.5, ac: 'acetinado' },
  vagem: { g: comVariantes(gVagem, { baunilha: gBaunilha }), a: 0.7, l: 0.08, ac: 'acetinado' },
  espiga: { g: gEspiga, a: 1, l: 0.25, ac: 'brilhante' },
  cogumelo: { g: gCogumelo, a: 0.8, l: 1, ac: 'fosco' },
  pimenta: { g: gPimenta, a: 1, l: 0.2, ac: 'brilhante' },
  alga: { g: gAlga, a: 0.1, l: 0.02, ac: 'umido' },
  peixe: { g: gPeixe, a: 0.2, l: 0.11, ac: 'umido' },
  peixe_chato: { g: gPeixeChato, a: 0.06, l: 0.5, ac: 'umido' },
  file_peixe: { g: gFilePeixe, a: 0.08, l: 0.3, ac: 'umido' },
  crustaceo: { g: gCrustaceo, a: 0.3, l: 0.17, ac: 'brilhante' },
  bivalve: { g: gBivalve, a: 0.35, l: 0.6, ac: 'acetinado' },
  concha_espiral: { g: gConchaEspiral, a: 1, l: 1, ac: 'brilhante' },
  cefalopode: { g: gCefalopode, a: 0.2, l: 0.18, ac: 'umido' },
  ave: { g: gAve, a: 0.55, l: 0.62, ac: 'acetinado' },
  peca_ave: { g: gPecaAve, a: 0.3, l: 0.5, ac: 'brilhante' },
  carne: { g: comVariantes(gCarne, { bacon: gBacon }), a: 0.35, l: 0.55, ac: 'brilhante' },
  carne_osso: { g: gCarneOsso, a: 0.4, l: 0.6, ac: 'brilhante' },
  carne_moida: { g: gCarneMoida, a: 0.4, l: 1, ac: 'acetinado' },
  miudo: { g: comVariantes(gMiudo, { foie: gFoieGras }), a: 0.25, l: 0.6, ac: 'umido' },
  linguica: { g: gLinguica, a: 1, l: 0.15, ac: 'brilhante' },
  massa_bola: { g: comVariantes(gMassaBola, { falafel: gFalafel }), a: 0.6, l: 1, ac: 'acetinado' },
  pao: { g: gPao, a: 0.4, l: 0.45, ac: 'fosco' },
  pao_chato: { g: comVariantes(gPaoChato, { omelete: gOmelete, frittata: gFrittata, crepe: gCrepe, 'crepe-enrolada': gCrepeEnrolada, 'crepe-quadrada': gCrepeQuadrada, 'crepe-leque': gCrepeLeque, panqueca: gPanqueca }), a: 0.03, l: 1, ac: 'fosco' },
  queijo: { g: gQueijo, a: 0.5, l: 0.6, ac: 'acetinado' },
  barra: { g: comVariantes(gBarra, { terrina: gTerrina, polenta: gPolenta }), a: 0.25, l: 0.5, ac: 'acetinado' },
  placa: { g: gPlaca, a: 0.01, l: 0.8, ac: 'acetinado' },
  monte: { g: comVariantes(gMonte, { gergelim: gGergelim }), a: 0.4, l: 1, ac: 'fosco' },
  castanha: { g: gCastanha, a: 0.5, l: 0.6, ac: 'acetinado' },
  massa: { g: gMassa, a: 0.3, l: 0.5, ac: 'fosco' },
  recipiente: { g: gRecipiente, a: 0.5, l: 1, ac: 'brilhante' },
  pasta: { g: gPasta, a: 0.5, l: 1, ac: 'acetinado' },
  bolo: { g: gBolo, a: 0.4, l: 1, ac: 'acetinado' },
  torta: { g: gTorta, a: 0.15, l: 1, ac: 'acetinado' },
  confeito: { g: gConfeito, a: 0.1, l: 1, ac: 'acetinado' },
  choux: { g: comVariantes(gChoux, { yorkshire: gYorkshire }), a: 0.7, l: 0.3, ac: 'fosco' },
  folhado: { g: gFolhado, a: 0.3, l: 0.6, ac: 'fosco' },
  merengue: { g: gMerengue, a: 0.6, l: 1, ac: 'acetinado' },
  rizoma: { g: gRizoma, a: 0.25, l: 0.5, ac: 'fosco' },
};

/** Gera a forma a partir de uma linha da tabela visual. */
export function gerarForma(id: string, v: Visual): FormaAlimento {
  const reg = FAMILIAS[v.f];
  const k = criarCtx(id, v, semente(id), reg.a, reg.l, reg.ac);
  const partes = reg.g(k);
  if (!partes.length) throw new Error(`família ${v.f}/${v.v} não gerou partes para ${id}`);
  return finalizar(partes, { corInterna: v.ci, corCozida: v.cc });
}
