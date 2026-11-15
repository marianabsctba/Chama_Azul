// Filés crus de peixe, para os passos em que o livro já trabalha o filé, o escalope, a posta ou as
// tiras (não o peixe inteiro). Usam o gerador de filé da família, com a cor de cada peixe.
import type { Visual } from '../pecas';
import { gFilePeixe } from '../fam_mar';
import type { Lote } from './tipos';

/** Filé em lado: pele (c1), linha escura (c2), carne crua (ci) e cozida (cc). */
const file = (t: number, l: number, cores: string, d = ''): Visual => {
  const [c1, c2, ci, cc] = cores.split(' ').map((c) => '#' + c);
  return { f: 'file_peixe', v: 'lado', t, a: 0.06, l, c1, c2, ci, cc, d, ac: 'brilhante' };
};

export const LOTE: Lote = {
  'file-de-salmao': { visual: file(0.3, 0.3, 'f08a5d b8b8b8 f08a5d f4c4a3'), gerar: gFilePeixe },
  'file-de-linguado': { visual: file(0.22, 0.32, 'f6f2ec d8d0c4 f6f2ec fbf8f2'), gerar: gFilePeixe },
  'file-de-merluza': { visual: file(0.24, 0.3, 'f4f0ea c8ccd0 f4f0ea fbf8f2'), gerar: gFilePeixe },
  'file-de-rodovalho': { visual: file(0.22, 0.34, 'f6f2ec d4ccc0 f6f2ec fbf8f2'), gerar: gFilePeixe },
  'file-de-cavala': { visual: file(0.2, 0.3, 'c9897a 2f6b6b c9897a e2c2aa'), gerar: gFilePeixe },
  'file-de-peixe-anjo': { visual: file(0.22, 0.32, 'f2ece4 d8ccc0 f2ece4 faf6f0'), gerar: gFilePeixe },
  'file-de-perca': { visual: file(0.18, 0.3, 'eedfd5 c8c0a8 eedfd5 f6ece2'), gerar: gFilePeixe },
  'file-de-vermelho': { visual: file(0.2, 0.3, 'f0d0c8 d0302a f0d0c8 f6e6dc'), gerar: gFilePeixe },
  'file-de-hadoque': { visual: file(0.24, 0.3, 'f3eee8 c8c8c8 f3eee8 faf6f0'), gerar: gFilePeixe },
};
