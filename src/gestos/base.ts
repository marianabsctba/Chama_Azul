// Contrato dos gestos e o que eles recebem do jogo.
import type * as THREE from 'three';
import type { Cozinha, Estacao, Passo, Tecnica } from '../tipos';
import type { Entrada } from '../motor/entrada';
import type { Mesa } from './mesa';

export type Modo = 'zen' | 'prova';

export interface Medidor {
  rotulo: string;
  valor: number;            // 0 a 1 na barra
  texto?: string;           // valor legível (ex.: "172 °C")
  faixa?: [number, number]; // faixa ideal na barra (0 a 1)
}

export interface Hud {
  dica(texto: string): void;
  medidores(lista: Medidor[]): void;
  /** Mostra um botão de ação principal; devolve true no quadro em que foi clicado. */
  botao(texto: string | null): boolean;
  /** Pergunta com opções; devolve o índice escolhido ou -1 enquanto não escolher. */
  escolha(pergunta: string | null, opcoes?: string[]): number;
  /** Pequeno texto flutuante de retorno (acertou, ajuste). */
  aviso(texto: string, tipo?: 'bom' | 'neutro' | 'ajuste'): void;
}

export interface Relogio {
  /** Multiplicador do tempo do jogo (o "4D"). 1 = normal. */
  escala: number;
  /** Tempo de jogo acumulado no passo, em segundos de cozinha. */
  decorrido: number;
}

export interface ContextoGesto {
  cena: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  entrada: Entrada;
  cozinha: Cozinha;
  estacao: Estacao;
  passo: Passo;
  tecnica: Tecnica;
  modo: Modo;
  hud: Hud;
  mesa: Mesa;
  relogio: Relogio;
}

export interface Execucao {
  /** dt real em segundos. */
  atualizar(dt: number): void;
  concluido: boolean;
  /** Nota de 0 a 1 quando concluído. */
  nota: number;
  /** Frase curta que explica a nota. */
  comentario: string;
  descartar(): void;
}

export type FabricaGesto = (ctx: ContextoGesto) => Execucao;

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const suave = (x: number) => x * x * (3 - 2 * x);

/** Extrai todas as temperaturas em °C de um texto. */
export function temperaturas(texto: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)(?:\s*(?:a|e|-|ou)\s*(\d+(?:[.,]\d+)?))?\s*°\s*C/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const a = parseFloat(m[1].replace(',', '.'));
    const b = m[2] ? parseFloat(m[2].replace(',', '.')) : a;
    out.push((a + b) / 2);
  }
  return out;
}

/** Tempo em minutos de cozinha citado no texto (o primeiro), ou null. */
export function minutos(texto: string): number | null {
  const t = texto.toLowerCase();
  let m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*(?:a|-|ou)\s*(\d+(?:[.,]\d+)?))?\s*(?:h\b|horas?)/);
  if (m) {
    const a = parseFloat(m[1].replace(',', '.'));
    const b = m[2] ? parseFloat(m[2].replace(',', '.')) : a;
    let total = ((a + b) / 2) * 60;
    const extra = t.match(/h\s*(\d+)\s*(?:min)?/);
    if (extra && !m[2]) total += parseInt(extra[1], 10);
    return total;
  }
  m = t.match(/(\d+(?:[.,]\d+)?)(?:\s*(?:a|-|ou)\s*(\d+(?:[.,]\d+)?))?\s*(?:min|minutos?)\b/);
  if (m) {
    const a = parseFloat(m[1].replace(',', '.'));
    const b = m[2] ? parseFloat(m[2].replace(',', '.')) : a;
    return (a + b) / 2;
  }
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:s\b|segundos?)/);
  if (m) return parseFloat(m[1].replace(',', '.')) / 60;
  if (/noite|overnight|8 horas/.test(t)) return 8 * 60;
  return null;
}

/** Formata minutos de cozinha como "1 h 05" ou "12 min" ou "40 s". */
export function formatarTempo(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} s`;
  if (min < 60) return `${Math.floor(min)} min ${String(Math.round((min % 1) * 60)).padStart(2, '0')} s`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(Math.round(min % 60)).padStart(2, '0')}`;
}

/** Converte a nota de precisão em comentário gentil. */
export function comentar(nota: number, bom: string, medio: string, fraco: string) {
  return nota >= 0.85 ? bom : nota >= 0.6 ? medio : fraco;
}
