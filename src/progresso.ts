// Progresso salvo no navegador. Tudo protegido: sem armazenamento, o jogo funciona igual.
import type { Modo } from './gestos/base';

export interface Progresso {
  feitas: Record<string, number>; // id -> melhores estrelas (1 a 3)
  modo: Modo;
  som: boolean;
  musica: number;
  chuva: number;
  sensibilidade: number;
  ultima?: string;
}

const CHAVE = 'chama-azul:v1';

export function carregar(): Progresso {
  const padrao: Progresso = { feitas: {}, modo: 'zen', som: true, musica: 0.6, chuva: 0.45, sensibilidade: 1 };
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return padrao;
    return { ...padrao, ...JSON.parse(bruto) };
  } catch {
    return padrao;
  }
}

export function salvar(p: Progresso) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* sem armazenamento: segue sem salvar */
  }
}

export function registrar(p: Progresso, id: string, estrelas: number) {
  p.feitas[id] = Math.max(p.feitas[id] ?? 0, estrelas);
  p.ultima = id;
  salvar(p);
}
