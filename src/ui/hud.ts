// HUD em HTML por cima do 3D: passo atual, dica, medidores, botão de ação, escolhas e avisos.
import type { Hud, Medidor } from '../gestos/base';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

export class HudHtml implements Hud {
  readonly raiz: HTMLElement;
  private passo: HTMLElement;
  private dicaEl: HTMLElement;
  private meds: HTMLElement;
  private acao: HTMLButtonElement;
  private escolhaEl: HTMLElement;
  private avisos: HTMLElement;
  private titulo: HTMLElement;
  private pontos: HTMLElement;
  private ultimaDica = '';
  /** Adapta os textos (por exemplo, de mouse para toque). */
  transformar: (t: string) => string = (t) => t;
  private ultimoBotao: string | null = null;
  private clicado = false;
  private escolhida = -1;
  private ultimaPergunta: string | null = null;
  private assinaturaMeds = '';
  readonly btnPular: HTMLButtonElement;
  readonly btnSair: HTMLButtonElement;
  readonly tempo: HTMLElement;

  constructor(pai: HTMLElement) {
    this.raiz = el('div', 'hud oculto');
    const topo = el('div', 'hud-topo');
    const esquerda = el('div', 'hud-tecnica');
    this.titulo = el('div', 'hud-titulo');
    this.pontos = el('div', 'hud-pontos');
    esquerda.append(this.titulo, this.pontos);
    const botoes = el('div', 'hud-botoes');
    this.btnPular = el('button', 'botao fantasma', 'Pular passo');
    this.btnSair = el('button', 'botao fantasma', 'Sair (Esc)');
    botoes.append(this.btnPular, this.btnSair);
    topo.append(esquerda, botoes);
    this.passo = el('div', 'hud-passo');
    this.dicaEl = el('div', 'hud-dica');
    this.meds = el('div', 'hud-medidores');
    this.acao = el('button', 'botao principal hud-acao oculto');
    this.acao.addEventListener('click', () => (this.clicado = true));
    this.escolhaEl = el('div', 'hud-escolha oculto');
    this.avisos = el('div', 'hud-avisos');
    this.tempo = el('div', 'hud-tempo', '');
    this.raiz.append(topo, this.passo, this.dicaEl, this.meds, this.acao, this.escolhaEl, this.avisos, this.tempo);
    pai.append(this.raiz);
  }

  mostrar(v: boolean) {
    this.raiz.classList.toggle('oculto', !v);
  }

  definirTecnica(nome: string, total: number) {
    this.titulo.textContent = nome;
    this.pontos.replaceChildren(...Array.from({ length: total }, () => el('span', 'ponto')));
  }

  marcarPasso(i: number, estado: 'atual' | 'bom' | 'medio' | 'fraco') {
    const p = this.pontos.children[i] as HTMLElement | undefined;
    if (!p) return;
    p.className = `ponto ${estado}`;
  }

  definirPasso(i: number, total: number, gesto: string, alvo: string, parametro: string, acao: string) {
    this.passo.replaceChildren(
      el('div', 'hud-passo-num', `Passo ${i + 1} de ${total} · ${gesto}`),
      el('div', 'hud-passo-acao', `${acao.charAt(0).toUpperCase() + acao.slice(1).replace(/\(.*\)/, '')}: ${alvo}`),
      ...(parametro ? [el('div', 'hud-passo-param', parametro)] : []),
    );
    this.passo.classList.remove('entra');
    void this.passo.offsetWidth;
    this.passo.classList.add('entra');
  }

  dica(texto: string) {
    if (texto === this.ultimaDica) return;
    this.ultimaDica = texto;
    this.dicaEl.textContent = this.transformar(texto);
  }

  medidores(lista: Medidor[]) {
    const assinatura = lista.map((m) => m.rotulo).join('|');
    if (assinatura !== this.assinaturaMeds) {
      this.assinaturaMeds = assinatura;
      this.meds.replaceChildren(
        ...lista.map(() => {
          const box = el('div', 'medidor');
          const topo = el('div', 'medidor-topo');
          topo.append(el('span', 'medidor-rotulo'), el('span', 'medidor-texto'));
          const barra = el('div', 'medidor-barra');
          barra.append(el('div', 'medidor-faixa'), el('div', 'medidor-valor'));
          box.append(topo, barra);
          return box;
        }),
      );
    }
    lista.forEach((m, i) => {
      const box = this.meds.children[i] as HTMLElement;
      (box.querySelector('.medidor-rotulo') as HTMLElement).textContent = m.rotulo;
      (box.querySelector('.medidor-texto') as HTMLElement).textContent = m.texto ?? `${Math.round(m.valor * 100)}%`;
      (box.querySelector('.medidor-valor') as HTMLElement).style.width = `${Math.max(0, Math.min(1, m.valor)) * 100}%`;
      const f = box.querySelector('.medidor-faixa') as HTMLElement;
      if (m.faixa) {
        f.style.display = 'block';
        f.style.left = `${m.faixa[0] * 100}%`;
        f.style.width = `${Math.max(0.01, m.faixa[1] - m.faixa[0]) * 100}%`;
        const dentro = m.valor >= m.faixa[0] && m.valor <= m.faixa[1];
        box.classList.toggle('dentro', dentro);
      } else {
        f.style.display = 'none';
        box.classList.remove('dentro');
      }
    });
  }

  botao(texto: string | null): boolean {
    if (texto !== this.ultimoBotao) {
      this.ultimoBotao = texto;
      this.acao.classList.toggle('oculto', texto === null);
      if (texto) this.acao.textContent = texto;
      this.clicado = false;
    }
    const c = this.clicado;
    this.clicado = false;
    return c;
  }

  escolha(pergunta: string | null, opcoes?: string[]): number {
    if (pergunta === null) {
      this.escolhaEl.classList.add('oculto');
      this.ultimaPergunta = null;
      this.escolhida = -1;
      return -1;
    }
    if (pergunta !== this.ultimaPergunta) {
      this.ultimaPergunta = pergunta;
      this.escolhida = -1;
      this.escolhaEl.replaceChildren(
        el('div', 'hud-escolha-pergunta', pergunta),
        ...(opcoes ?? []).map((o, i) => {
          const b = el('button', 'botao', o);
          b.addEventListener('click', () => (this.escolhida = i));
          return b;
        }),
      );
      this.escolhaEl.classList.remove('oculto');
    }
    const r = this.escolhida;
    if (r >= 0) this.escolhida = -1;
    return r;
  }

  aviso(texto: string, tipo: 'bom' | 'neutro' | 'ajuste' = 'neutro') {
    const a = el('div', `aviso ${tipo}`, this.transformar(texto));
    this.avisos.append(a);
    setTimeout(() => a.classList.add('sai'), 1600);
    setTimeout(() => a.remove(), 2200);
    while (this.avisos.children.length > 3) this.avisos.firstChild?.remove();
  }

  definirTempo(texto: string) {
    this.tempo.textContent = texto;
  }

  limpar() {
    this.medidores([]);
    this.botao(null);
    this.escolha(null);
    this.dica('');
    this.definirTempo('');
  }
}
