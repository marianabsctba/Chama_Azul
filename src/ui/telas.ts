// Telas em HTML: menu, caderno de técnicas, ficha da técnica, resultado e ajuda.
import type { Catalogo, Tecnica } from '../tipos';
import type { Progresso } from '../progresso';
import type { ResultadoPasso } from '../missao';
import { NOME_GESTO } from '../gestos';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, txt?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
};

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const estrelasTexto = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

export interface AcoesTelas {
  entrar(): void;
  comecar(t: Tecnica): void;
  fecharCaderno(): void;
  alternarModo(): void;
  alternarSom(): void;
}

export class Telas {
  readonly menu: HTMLElement;
  readonly caderno: HTMLElement;
  readonly resultado: HTMLElement;
  readonly ajuda: HTMLElement;
  readonly mira: HTMLElement;
  readonly dicaAndar: HTMLElement;
  private bancadaAtual = '';
  private busca = '';
  private filtro: 'todas' | 'pendentes' | 'feitas' = 'todas';
  private lista!: HTMLElement;
  private ficha!: HTMLElement;
  private bancadasEl!: HTMLElement;
  private resumoMenu!: HTMLElement;
  private btnModo!: HTMLButtonElement;
  private btnSom!: HTMLButtonElement;

  constructor(
    private pai: HTMLElement,
    private catalogo: Catalogo,
    private progresso: Progresso,
    private acoes: AcoesTelas,
  ) {
    this.menu = this.criarMenu();
    this.caderno = this.criarCaderno();
    this.resultado = el('div', 'tela resultado oculto');
    this.ajuda = this.criarAjuda();
    this.mira = el('div', 'mira oculto');
    this.dicaAndar = el('div', 'dica-andar oculto');
    pai.append(this.menu, this.caderno, this.resultado, this.ajuda, this.mira, this.dicaAndar);
    this.bancadaAtual = catalogo.bancadas[0].id;
  }

  private criarMenu() {
    const m = el('div', 'tela menu');
    const caixa = el('div', 'menu-caixa');
    const logo = el('div', 'logo');
    logo.innerHTML = `<svg viewBox="0 0 64 80" aria-hidden="true"><defs><linearGradient id="g1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1f5fbf"/><stop offset=".6" stop-color="#5fb4ff"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient></defs><path d="M32 4c6 14 22 24 22 44a22 22 0 0 1-44 0c0-12 7-18 10-26 2 8 6 12 10 13-3-10-1-21 2-31z" fill="url(#g1)"/><path d="M32 40c4 7 10 11 10 19a10 10 0 0 1-20 0c0-6 5-10 10-19z" fill="#eaf6ff" opacity=".9"/></svg>`;
    const titulo = el('h1', 'titulo', 'Chama Azul');
    const sub = el('p', 'subtitulo', 'Uma cozinha-escola para relaxar e praticar, técnica por técnica.');
    this.resumoMenu = el('p', 'resumo');
    const entrar = el('button', 'botao principal grande', 'Entrar na cozinha');
    entrar.addEventListener('click', () => this.acoes.entrar());
    const linha = el('div', 'menu-linha');
    this.btnModo = el('button', 'botao');
    this.btnModo.addEventListener('click', () => {
      this.acoes.alternarModo();
      this.atualizarMenu();
    });
    this.btnSom = el('button', 'botao');
    this.btnSom.addEventListener('click', () => {
      this.acoes.alternarSom();
      this.atualizarMenu();
    });
    const ajuda = el('button', 'botao', 'Como jogar');
    ajuda.addEventListener('click', () => this.mostrar(this.ajuda, true));
    linha.append(this.btnModo, this.btnSom, ajuda);
    const rodape = el('p', 'rodape', 'Feito com carinho, código aberto. Tudo em 3D gerado por código.');
    caixa.append(logo, titulo, sub, this.resumoMenu, entrar, linha, rodape);
    m.append(caixa);
    this.atualizarMenuDepois = () => this.atualizarMenu();
    queueMicrotask(() => this.atualizarMenu());
    return m;
  }

  private atualizarMenuDepois = () => {};

  atualizarMenu() {
    const feitas = Object.keys(this.progresso.feitas).length;
    this.resumoMenu.textContent = feitas
      ? `${feitas} de ${this.catalogo.tecnicas.length} técnicas praticadas`
      : `${this.catalogo.tecnicas.length} técnicas esperando por você em 15 bancadas`;
    this.btnModo.textContent = this.progresso.modo === 'zen' ? 'Modo Zen' : 'Modo Prova';
    this.btnModo.title = this.progresso.modo === 'zen' ? 'Sem pressa e sem erro que estrague: só dicas.' : 'Precisão conta estrelas; fora da guia, tente de novo.';
    this.btnSom.textContent = this.progresso.som ? 'Som ligado' : 'Som desligado';
  }

  private criarAjuda() {
    const a = el('div', 'tela ajuda oculto');
    const c = el('div', 'painel');
    c.innerHTML = `
      <h2>Como jogar</h2>
      <ul>
        <li><b>Andar:</b> clique na tela para olhar com o mouse, WASD para andar, Shift para ir mais rápido, Esc solta o mouse.</li>
        <li><b>Escolher técnica:</b> clique no caderno aberto no púlpito ou aperte <b>C</b> em qualquer lugar.</li>
        <li><b>Trabalhar:</b> a câmera vai até a bancada e o mouse vira sua mão. Cada passo diz o gesto: riscar o corte, mexer em círculos, inclinar para despejar, girar o fogo com a roda do mouse.</li>
        <li><b>O tempo é a quarta dimensão:</b> no fogo, no forno e no descanso, segure <b>Espaço</b> para acelerar o relógio da cozinha.</li>
        <li><b>Modo Zen:</b> sem pressa, nada se perde, só dicas. <b>Modo Prova:</b> a precisão vale estrelas.</li>
        <li><b>Pular passo</b> e <b>Sair</b> ficam no canto de cima. Seu progresso fica salvo neste navegador.</li>
      </ul>`;
    const ok = el('button', 'botao principal', 'Entendi');
    ok.addEventListener('click', () => this.mostrar(a, false));
    c.append(ok);
    a.append(c);
    return a;
  }

  private criarCaderno() {
    const c = el('div', 'tela caderno oculto');
    const livro = el('div', 'livro');
    const esq = el('div', 'pagina esquerda');
    const cab = el('div', 'caderno-cab');
    cab.append(el('h2', '', 'Caderno de técnicas'));
    const fechar = el('button', 'botao fantasma', 'Fechar (Esc)');
    fechar.addEventListener('click', () => this.acoes.fecharCaderno());
    cab.append(fechar);
    this.bancadasEl = el('div', 'bancadas');
    esq.append(cab, this.bancadasEl);
    const dir = el('div', 'pagina direita');
    const barra = el('div', 'caderno-barra');
    const busca = el('input', 'busca') as HTMLInputElement;
    busca.placeholder = 'Buscar técnica, ingrediente ou utensílio';
    busca.addEventListener('input', () => {
      this.busca = normal(busca.value.trim());
      this.renderLista();
    });
    const filtros = el('div', 'filtros');
    for (const [f, nome] of [['todas', 'Todas'], ['pendentes', 'A fazer'], ['feitas', 'Feitas']] as const) {
      const b = el('button', 'chip', nome);
      b.dataset.f = f;
      b.addEventListener('click', () => {
        this.filtro = f;
        this.renderLista();
      });
      filtros.append(b);
    }
    const sorte = el('button', 'chip sorte', 'Surpresa');
    sorte.title = 'Uma técnica ainda não feita, ao acaso';
    sorte.addEventListener('click', () => {
      const pend = this.catalogo.tecnicas.filter((t) => !this.progresso.feitas[t.id]);
      const lista = pend.length ? pend : this.catalogo.tecnicas;
      this.abrirFicha(lista[Math.floor(Math.random() * lista.length)]);
    });
    filtros.append(sorte);
    barra.append(busca, filtros);
    this.lista = el('div', 'lista');
    this.ficha = el('div', 'ficha oculto');
    dir.append(barra, this.lista, this.ficha);
    livro.append(esq, dir);
    c.append(livro);
    return c;
  }

  abrirCaderno() {
    this.renderBancadas();
    this.renderLista();
    this.ficha.classList.add('oculto');
    this.lista.classList.remove('oculto');
    this.mostrar(this.caderno, true);
  }

  private renderBancadas() {
    const total = this.catalogo.tecnicas.length;
    const feitas = Object.keys(this.progresso.feitas).length;
    const geral = el('div', 'progresso-geral');
    geral.append(el('div', 'pg-num', `${feitas} / ${total}`), el('div', 'pg-rot', 'técnicas praticadas'));
    const barra = el('div', 'pg-barra');
    const v = el('div', 'pg-valor');
    v.style.width = `${(feitas / total) * 100}%`;
    barra.append(v);
    geral.append(barra);
    const itens = this.catalogo.bancadas.map((b) => {
      const ts = this.catalogo.tecnicas.filter((t) => t.bancada === b.id);
      const f = ts.filter((t) => this.progresso.feitas[t.id]).length;
      const item = el('button', `bancada ${b.id === this.bancadaAtual ? 'ativa' : ''}`);
      const cor = el('span', 'bancada-cor');
      cor.style.background = b.cor;
      item.append(cor, el('span', 'bancada-nome', b.nome), el('span', 'bancada-num', `${f}/${ts.length}`));
      item.addEventListener('click', () => {
        this.bancadaAtual = b.id;
        this.renderBancadas();
        this.renderLista();
        this.ficha.classList.add('oculto');
        this.lista.classList.remove('oculto');
      });
      return item;
    });
    this.bancadasEl.replaceChildren(geral, ...itens);
  }

  private renderLista() {
    for (const b of this.caderno.querySelectorAll<HTMLElement>('.chip[data-f]')) b.classList.toggle('ativo', b.dataset.f === this.filtro);
    let ts = this.catalogo.tecnicas;
    if (this.busca) {
      ts = ts.filter((t) => normal(`${t.nome} ${t.ingredientes.join(' ')} ${t.utensilios.join(' ')}`).includes(this.busca));
    } else ts = ts.filter((t) => t.bancada === this.bancadaAtual);
    if (this.filtro === 'pendentes') ts = ts.filter((t) => !this.progresso.feitas[t.id]);
    if (this.filtro === 'feitas') ts = ts.filter((t) => this.progresso.feitas[t.id]);
    const grupos = new Map<string, Tecnica[]>();
    for (const t of ts.slice(0, 400)) {
      const g = grupos.get(t.capitulo) ?? [];
      g.push(t);
      grupos.set(t.capitulo, g);
    }
    const filhos: HTMLElement[] = [];
    if (!ts.length) filhos.push(el('p', 'vazio', 'Nenhuma técnica aqui com esse filtro.'));
    for (const [cap, lista] of grupos) {
      filhos.push(el('div', 'grupo', cap));
      for (const t of lista) {
        const e = this.progresso.feitas[t.id] ?? 0;
        const item = el('button', `item ${e ? 'feito' : ''}`);
        const gestos = [...new Set(t.passos.map((p) => NOME_GESTO[p.gesto]))].slice(0, 3).join(' · ');
        item.append(el('span', 'item-nome', t.nome), el('span', 'item-gestos', gestos), el('span', 'item-estrelas', e ? estrelasTexto(e) : `${t.passos.length} passos`));
        item.addEventListener('click', () => this.abrirFicha(t));
        filhos.push(item);
      }
    }
    if (ts.length > 400) filhos.push(el('p', 'vazio', `Mostrando 400 de ${ts.length}. Refine a busca.`));
    this.lista.replaceChildren(...filhos);
    this.lista.scrollTop = 0;
  }

  abrirFicha(t: Tecnica) {
    this.bancadaAtual = t.bancada;
    this.renderBancadas();
    const e = this.progresso.feitas[t.id] ?? 0;
    const voltar = el('button', 'botao fantasma', '‹ Voltar à lista');
    voltar.addEventListener('click', () => {
      this.ficha.classList.add('oculto');
      this.lista.classList.remove('oculto');
    });
    const passos = el('ol', 'ficha-passos');
    for (const p of t.passos) {
      const li = el('li');
      li.append(el('span', 'ficha-gesto', NOME_GESTO[p.gesto]), document.createTextNode(` ${p.acao.replace(/\(.*\)/, '')}: ${p.alvo}${p.parametro ? ' (' + p.parametro + ')' : ''}`));
      passos.append(li);
    }
    const comecar = el('button', 'botao principal grande', e ? 'Praticar de novo' : 'Começar');
    comecar.addEventListener('click', () => this.acoes.comecar(t));
    const blocos: HTMLElement[] = [
      voltar,
      el('div', 'ficha-cap', t.capitulo),
      el('h3', 'ficha-nome', t.nome),
      ...(e ? [el('div', 'ficha-estrelas', estrelasTexto(e))] : []),
    ];
    if (t.ingredientes.length) {
      blocos.push(el('h4', '', 'Ingredientes'), el('p', 'ficha-texto', t.ingredientes.join(', ')));
    }
    if (t.utensilios.length) blocos.push(el('h4', '', 'Utensílios'), el('p', 'ficha-texto', t.utensilios.join(', ')));
    blocos.push(el('h4', '', 'Passos'), passos);
    if (t.ponto_critico) blocos.push(el('h4', '', 'O ponto certo'), el('p', 'ficha-texto destaque', t.ponto_critico));
    blocos.push(comecar);
    this.ficha.replaceChildren(...blocos);
    this.lista.classList.add('oculto');
    this.ficha.classList.remove('oculto');
    this.ficha.scrollTop = 0;
    if (!this.caderno.classList.contains('oculto')) return;
    this.renderLista();
    this.mostrar(this.caderno, true);
    this.lista.classList.add('oculto');
  }

  mostrarResultado(t: Tecnica, resultados: ResultadoPasso[], estrelas: number, aoRepetir: () => void, aoProxima: (() => void) | null, aoCaderno: () => void) {
    const p = el('div', 'painel resultado-painel');
    p.append(el('div', 'resultado-estrelas', estrelasTexto(estrelas)), el('h2', '', t.nome));
    const frase = estrelas === 3 ? 'Técnica dominada.' : estrelas === 2 ? 'Muito bem. Dá para lapidar.' : 'Feito! A prática deixa a mão leve.';
    p.append(el('p', 'resultado-frase', frase));
    const lista = el('ol', 'resultado-passos');
    resultados.forEach((r, i) => {
      const li = el('li', r.nota >= 0.85 ? 'bom' : r.nota >= 0.6 ? 'medio' : 'fraco');
      li.append(el('b', '', t.passos[i]?.acao.replace(/\(.*\)/, '') ?? ''), document.createTextNode(` ${r.comentario}`));
      lista.append(li);
    });
    p.append(lista);
    if (t.ponto_critico) p.append(el('h4', '', 'O ponto certo'), el('p', 'ficha-texto destaque', t.ponto_critico));
    if (t.erro_comum) p.append(el('h4', '', 'Cuidado com'), el('p', 'ficha-texto', t.erro_comum));
    const botoes = el('div', 'resultado-botoes');
    const rep = el('button', 'botao', 'Repetir');
    rep.addEventListener('click', aoRepetir);
    const cad = el('button', 'botao', 'Caderno');
    cad.addEventListener('click', aoCaderno);
    botoes.append(rep, cad);
    if (aoProxima) {
      const prox = el('button', 'botao principal', 'Próxima técnica');
      prox.addEventListener('click', aoProxima);
      botoes.append(prox);
    }
    p.append(botoes);
    this.resultado.replaceChildren(p);
    this.mostrar(this.resultado, true);
  }

  mostrar(e: HTMLElement, v: boolean) {
    e.classList.toggle('oculto', !v);
    void this.pai;
    this.atualizarMenuDepois();
  }
}
