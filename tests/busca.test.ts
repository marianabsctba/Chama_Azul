import { describe, expect, it } from 'vitest';
import catalogo from '../src/dados/catalogo.json';
import type { Catalogo } from '../src/tipos';
import { buscar } from '../src/busca';

const c = catalogo as unknown as Catalogo;

describe('busca do caderno', () => {
  it('todo alimento encontra ao menos uma técnica para praticar', () => {
    const sem: string[] = [];
    for (const a of c.alimentos) {
      const r = buscar(c, a.nome);
      if (!r.tecnicas.length && !r.cartoes.some((x) => x.tecnicas.length)) sem.push(a.nome);
    }
    expect(sem, sem.join(', ')).toEqual([]);
  });
  it('enguia oferece técnicas para praticar', () => {
    const r = buscar(c, 'enguia');
    expect(r.cartoes[0]?.tecnicas.length).toBeGreaterThan(0);
  });
  it('busca sem acento acha com acento', () => {
    expect(buscar(c, 'mexilhao').tecnicas.length).toBeGreaterThan(0);
  });
});
