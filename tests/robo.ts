// Robô nos testes: joga cada técnica inteira sem navegador.
import * as THREE from 'three';
import type { Tecnica } from '../src/tipos';
import { Missao, type ResultadoPasso } from '../src/missao';
import { EntradaFalsa, HudFalso, cozinhaFalsa, jogadorFalso, jogar, type Memoria } from '../src/robo/robo';

export { EntradaFalsa, HudFalso, cozinhaFalsa, jogadorFalso, jogar };
const LARG = 1000;
const ALT = 800;

export interface Relatorio {
  id: string;
  ok: boolean;
  resultados: ResultadoPasso[];
  travou?: string;
  erros: string[];
}

/** Joga uma técnica inteira. Devolve o relatório. */
export function jogarTecnica(t: Tecnica, limitePorPasso = 90): Relatorio {
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, LARG / ALT, 0.02, 60);
  const cozinha = cozinhaFalsa();
  const e = new EntradaFalsa();
  const h = new HudFalso();
  const erros: string[] = [];
  let fim: ResultadoPasso[] | null = null;
  const errOrig = console.error;
  console.error = (...a: unknown[]) => erros.push(a.map(String).join(' ').slice(0, 300));
  const m = new Missao(t, cena, cozinha, jogadorFalso(camera) as never, e as never, h, 'zen', {
    aoPasso() {},
    aoResultadoPasso() {},
    aoFim(r) {
      fim = r;
    },
  });
  const dt = 1 / 30;
  let travou: string | undefined;
  try {
    m.iniciar();
    let indice = -1;
    let tempoPasso = 0;
    const mem: Memoria = { t: 0, fase: 0, ang: 0, alvoIdx: 0, sinal: 1, acc: 0 };
    while (!fim) {
      if (m.indice !== indice) {
        indice = m.indice;
        tempoPasso = 0;
        Object.assign(mem, { t: 0, fase: 0, ang: 0, alvoIdx: 0, sinal: 1, acc: 0 });
        e.pressionado = false;
      }
      jogar(m, e, h, camera, cena, mem, dt);
      m.atualizar(dt);
      e.fimDoQuadro();
      tempoPasso += dt;
      if (tempoPasso > limitePorPasso) {
        const p = t.passos[m.indice];
        travou = `passo ${m.indice + 1} (${p?.gesto}/${p?.variante} ${p?.acao}) não terminou; dica: ${h.dicaTexto.slice(0, 80)}; medidores: ${h.meds.map((x) => `${x.rotulo}=${x.valor.toFixed(2)}${x.faixa ? `[${x.faixa.map((f) => f.toFixed(2)).join('-')}]` : ''}`).join(' ')}`;
        break;
      }
    }
  } catch (err) {
    travou = `exceção: ${(err as Error).stack?.slice(0, 400)}`;
  } finally {
    console.error = errOrig;
    m.encerrar();
  }
  const resultados: ResultadoPasso[] = fim ?? [];
  return { id: t.id, ok: !!fim && !travou && erros.length === 0, resultados, travou, erros };
}
