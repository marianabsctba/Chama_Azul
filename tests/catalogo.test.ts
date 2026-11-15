import { describe, expect, it } from 'vitest';
import catalogo from '../src/dados/catalogo.json';
import type { Catalogo } from '../src/tipos';

const c = catalogo as unknown as Catalogo;
const GESTOS = ['cortar', 'superficie', 'ritmo', 'calor', 'tempo', 'verter', 'montar', 'confeitar', 'medir', 'testar', 'separar'];

describe('catálogo', () => {
  it('tem as 998 técnicas do levantamento', () => {
    expect(c.tecnicas.length).toBe(998);
  });
  it('toda técnica tem passos com gesto conhecido e bancada válida', () => {
    const bancadas = new Set(c.bancadas.map((b) => b.id));
    for (const t of c.tecnicas) {
      expect(t.passos.length, t.id).toBeGreaterThan(0);
      expect(bancadas.has(t.bancada), t.id).toBe(true);
      for (const p of t.passos) expect(GESTOS, `${t.id}: ${p.acao}`).toContain(p.gesto);
    }
  });
  it('ids únicos e nenhum travessão', () => {
    const ids = new Set(c.tecnicas.map((t) => t.id));
    expect(ids.size).toBe(c.tecnicas.length);
    expect(/[\u2013\u2014]/.test(JSON.stringify(c))).toBe(false);
  });
  it('as 15 bancadas têm técnicas', () => {
    expect(c.bancadas.length).toBe(15);
    for (const b of c.bancadas) expect(c.tecnicas.some((t) => t.bancada === b.id), b.id).toBe(true);
  });
});
