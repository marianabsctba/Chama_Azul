// Busca do caderno: técnicas que citam o termo e, para ingredientes sem técnica própria,
// técnicas que servem para eles (a mesma família de peça ou, por fim, as universais).
import type { Catalogo, Tecnica } from './tipos';
import { familiaDe } from './modelos/alimentos';

export const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface CartaoIngrediente {
  id: string;
  nome: string;
  tecnicas: Tecnica[];
}

/** Técnicas que servem para qualquer peça sólida: cortar, descascar, assar, grelhar, vapor. */
const UNIVERSAIS = /julienne|cubos|fatiar|picar|descascar|assar|grelhar|vapor|saltear|branquear/;

const cacheTexto = new WeakMap<Tecnica, string>();

export function buscar(catalogo: Catalogo, termo: string): { tecnicas: Tecnica[]; cartoes: CartaoIngrediente[] } {
  const busca = normal(termo.trim());
  if (!busca) return { tecnicas: [], cartoes: [] };
  const nomes = new Map(catalogo.alimentos.map((a) => [a.id, a.nome]));
  const texto = (t: Tecnica) => {
    let s = cacheTexto.get(t);
    if (!s) {
      s = normal(`${t.nome} ${t.ingredientes.join(' ')} ${t.utensilios.join(' ')} ${t.passos.map((p) => `${p.alvo} ${p.parametro}`).join(' ')} ${t.alimentos.map((id) => nomes.get(id) ?? '').join(' ')}`);
      cacheTexto.set(t, s);
    }
    return s;
  };
  const tecnicas = catalogo.tecnicas.filter((t) => texto(t).includes(busca));
  const usados = new Set(catalogo.tecnicas.flatMap((t) => [...t.alimentos, ...t.passos.map((p) => p.alimento ?? '')]));
  const principal = (t: Tecnica) => t.passos.find((p) => p.alimento)?.alimento;
  const cartoes: CartaoIngrediente[] = [];
  for (const a of catalogo.alimentos.filter((x) => normal(x.nome).includes(busca) || normal(x.id.replace(/[-_]/g, ' ')).includes(busca)).slice(0, 3)) {
    if (usados.has(a.id) && tecnicas.length) continue;
    const fam = familiaDe(a.id);
    let irmas = catalogo.tecnicas.filter((t) => {
      const pr = principal(t);
      return pr && pr !== a.id && familiaDe(pr) === fam;
    });
    if (!irmas.length) irmas = catalogo.tecnicas.filter((t) => UNIVERSAIS.test(t.id) && principal(t));
    if (irmas.length) cartoes.push({ id: a.id, nome: a.nome, tecnicas: irmas.slice(0, 12) });
  }
  return { tecnicas, cartoes };
}

/** A mesma técnica, com outro ingrediente no lugar da peça principal. */
export function trocarAlimento(t: Tecnica, id: string, nome: string): Tecnica {
  const pr = t.passos.find((p) => p.alimento)?.alimento;
  return {
    ...t,
    nome: `${t.nome} (com ${nome.toLowerCase()})`,
    alimentos: [id, ...t.alimentos.filter((x) => x !== pr)],
    passos: t.passos.map((p) => (p.alimento === pr ? { ...p, alimento: id } : p)),
  };
}
