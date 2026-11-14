// O robô joga as técnicas de cada bancada e todas precisam chegar ao fim, sem erro.
import { describe, expect, it } from 'vitest';
import catalogo from '../src/dados/catalogo.json';
import type { Catalogo } from '../src/tipos';
import { jogarTecnica } from './robo';

const c = catalogo as unknown as Catalogo;
const filtro = process.env.BANCADA;
const limite = process.env.LIMITE ? Number(process.env.LIMITE) : Infinity;

describe.each(c.bancadas.filter((b) => !filtro || filtro.split(',').includes(b.id)).map((b) => [b.id]))('bancada %s', (id) => {
  it('todas as técnicas chegam ao fim', () => {
    const ts = c.tecnicas.filter((t) => t.bancada === id).slice(0, limite);
    const falhas: string[] = [];
    let passos = 0;
    let soma = 0;
    for (const t of ts) {
      const r = jogarTecnica(t);
      if (!r.ok) falhas.push(`${t.id}: ${r.travou ?? ''} ${r.erros.join(' | ')}`);
      for (const x of r.resultados) {
        passos++;
        soma += x.nota;
      }
    }
    console.log(`[${id}] ${ts.length - falhas.length}/${ts.length} técnicas ok, ${passos} passos, nota média ${(soma / Math.max(passos, 1)).toFixed(2)}`);
    expect(falhas, falhas.join('\n')).toEqual([]);
  }, 1_800_000);
});

// IDS=a,b,c roda só essas técnicas (para depurar)
if (process.env.IDS) {
  it('técnicas escolhidas', () => {
    for (const id of process.env.IDS!.split(',')) {
      const t = c.tecnicas.find((x) => x.id === id)!;
      const r = jogarTecnica(t);
      console.log(id, r.ok ? 'ok' : `FALHOU ${r.travou ?? ''} ${r.erros.join(' | ')}`);
    }
  });
}
