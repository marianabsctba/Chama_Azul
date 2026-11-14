// Robô que joga as técnicas sozinho, sem navegador: entrada, HUD, jogador e cozinha falsos,
// e uma estratégia de mão para cada gesto. Serve para provar que as 974 técnicas fecham.
import * as THREE from 'three';
import type { Cozinha, CenaEstacao, Estacao, Tecnica } from '../src/tipos';
import type { Hud, Medidor } from '../src/gestos/base';
import { Missao, type ResultadoPasso } from '../src/missao';

const LARG = 1000;
const ALT = 800;

export class EntradaFalsa {
  readonly ndc = new THREE.Vector2();
  readonly px = new THREE.Vector2(LARG / 2, ALT / 2);
  readonly deltaPx = new THREE.Vector2();
  readonly olhar = new THREE.Vector2();
  pressionado = false;
  cliqueNovo = false;
  soltouNovo = false;
  roda = 0;
  readonly teclas = new Set<string>();
  readonly teclasNovas = new Set<string>();
  private raycaster = new THREE.Raycaster();

  fimDoQuadro() {
    this.cliqueNovo = false;
    this.soltouNovo = false;
    this.roda = 0;
    this.deltaPx.set(0, 0);
    this.teclasNovas.clear();
  }
  apertou(k: string) {
    return this.teclasNovas.has(k);
  }
  raio(camera: THREE.Camera) {
    this.raycaster.setFromCamera(this.ndc, camera);
    return this.raycaster;
  }
  noPlano(camera: THREE.Camera, y: number, alvo = new THREE.Vector3()) {
    return this.raio(camera).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), alvo);
  }
  noPlanoQualquer(camera: THREE.Camera, plano: THREE.Plane, alvo = new THREE.Vector3()) {
    return this.raio(camera).ray.intersectPlane(plano, alvo);
  }
  tamanho() {
    return { w: LARG, h: ALT };
  }
  /** Move o ponteiro para um ponto do mundo, acumulando o deslocamento em pixels. */
  apontar(p: THREE.Vector3, camera: THREE.Camera) {
    const v = p.clone().project(camera);
    const x = ((v.x + 1) / 2) * LARG;
    const y = ((1 - v.y) / 2) * ALT;
    this.deltaPx.x += x - this.px.x;
    this.deltaPx.y += y - this.px.y;
    this.px.set(x, y);
    this.ndc.set(v.x, v.y);
  }
  moverPx(dx: number, dy: number) {
    this.px.x += dx;
    this.px.y += dy;
    this.deltaPx.x += dx;
    this.deltaPx.y += dy;
    this.ndc.set((this.px.x / LARG) * 2 - 1, -(this.px.y / ALT) * 2 + 1);
  }
}

export class HudFalso implements Hud {
  dicaTexto = '';
  meds: Medidor[] = [];
  botaoTexto: string | null = null;
  clicar = false;
  pergunta: string | null = null;
  responder = -1;
  dica(t: string) {
    this.dicaTexto = t;
  }
  medidores(l: Medidor[]) {
    this.meds = l;
  }
  botao(t: string | null) {
    this.botaoTexto = t;
    const c = this.clicar && t !== null;
    if (c) this.clicar = false;
    return c;
  }
  escolha(p: string | null) {
    this.pergunta = p;
    if (p === null) return -1;
    const r = this.responder;
    this.responder = -1;
    return r;
  }
  aviso() {}
  med(rotulo: string) {
    return this.meds.find((m) => m.rotulo === rotulo);
  }
}

function estacao(id: CenaEstacao, x: number, y: number, z: number): Estacao {
  const superficie = new THREE.Vector3(x, y, z);
  return { id, superficie, camera: superficie.clone().add(new THREE.Vector3(0, 0.55, 0.45)), olhar: superficie.clone() };
}

export function cozinhaFalsa(): Cozinha {
  const estacoes = {
    corte: estacao('corte', 0, 0.94, 0),
    fogao: estacao('fogao', -2, 0.95, -2.5),
    forno: estacao('forno', 2.8, 0.85, -2),
    pia: estacao('pia', 2, 0.9, -2.8),
    confeitaria: estacao('confeitaria', -3, 0.92, 0.5),
    geladeira: estacao('geladeira', 3.5, 1.1, -1),
    caderno: estacao('caderno', 1.5, 1.2, 1.5),
    balanca: estacao('balanca', 1, 0.94, -2.8),
  } as Record<CenaEstacao, Estacao>;
  return {
    grupo: new THREE.Group(),
    estacoes,
    colisores: [],
    inicio: { posicao: new THREE.Vector3(0, 1.65, 3), olhar: new THREE.Vector3(0, 1, 0) },
    atualizar() {},
    definirChama() {},
    definirForno() {},
    abrirPorta() {},
  };
}

export function jogadorFalso(camera: THREE.PerspectiveCamera) {
  return {
    camera,
    modo: 'trabalho',
    voando: false,
    voar(pos: THREE.Vector3, olhar: THREE.Vector3, _d?: number, cb?: () => void) {
      camera.position.copy(pos);
      camera.lookAt(olhar);
      camera.updateMatrixWorld(true);
      cb?.();
    },
    direcao() {
      return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    },
  };
}

/** Estado interno do robô durante um passo. */
interface Memoria {
  t: number;
  fase: number;
  ang: number;
  alvoIdx: number;
  sinal: number;
  acc: number;
}

function visiveis(cena: THREE.Object3D, filtro: (m: THREE.Mesh) => boolean) {
  const out: THREE.Mesh[] = [];
  cena.traverse((o) => {
    if (o instanceof THREE.Mesh && filtro(o)) {
      let v = true;
      let p: THREE.Object3D | null = o;
      while (p) {
        if (!p.visible) v = false;
        p = p.parent;
      }
      if (v) out.push(o);
    }
  });
  return out;
}

/** Uma jogada do robô: ajusta a entrada para o quadro seguinte. */
export function jogar(m: Missao, e: EntradaFalsa, h: HudFalso, cam: THREE.PerspectiveCamera, cena: THREE.Scene, mem: Memoria, dt: number) {
  const passo = m.tecnica.passos[m.indice];
  if (!passo) return;
  const mesa = m.mesa;
  mem.t += dt;
  e.pressionado = false;
  e.teclas.clear();
  const v = passo.variante;
  const peca = mesa.peca;
  const segurar = (p: THREE.Vector3) => {
    e.apontar(p, cam);
    if (!e.pressionado) e.pressionado = true;
  };
  // escolhas e botões genéricos
  if (h.pergunta) h.responder = 1;
  if (h.botaoTexto && /Pronto|Tirar|Flambar/.test(h.botaoTexto)) h.clicar = true;

  switch (passo.gesto) {
    case 'cortar': {
      if (!peca) return;
      if (v === 'contorno' || v === 'pontos' || v === 'desfiar') {
        const marcas = visiveis(cena, (o) => o.renderOrder === 6 && (o.material as THREE.MeshBasicMaterial).opacity === 0.75);
        const alvo = marcas[0];
        if (!alvo) return;
        e.apontar(alvo.getWorldPosition(new THREE.Vector3()), cam);
        if (v === 'pontos') {
          if (mem.fase++ % 2 === 0) e.cliqueNovo = true;
        } else e.pressionado = true;
        return;
      }
      const guia = peca.children.find((c) => c instanceof THREE.Mesh && c.renderOrder === 5 && c.visible && (c.material as THREE.MeshBasicMaterial).opacity === 0.75) as THREE.Mesh | undefined;
      if (!guia) return;
      guia.geometry.computeBoundingBox();
      const bb = guia.geometry.boundingBox!;
      const eixoX = bb.max.x - bb.min.x < 1e-4; // plano perpendicular a X
      const c = guia.position.clone();
      const larg = eixoX ? bb.max.z : bb.max.x;
      const a = peca.localToWorld(eixoX ? c.clone().setZ(-larg * 1.1) : c.clone().setX(-larg * 1.05));
      const b = peca.localToWorld(eixoX ? c.clone().setZ(larg * 1.1) : c.clone().setX(larg * 1.05));
      const alturaPlano = peca.position.y + peca.altura * peca.scale.y * 0.6;
      a.y = b.y = alturaPlano;
      // risco em 3 quadros: clica, arrasta, solta
      const f = mem.fase++ % 3;
      if (f === 0) {
        e.apontar(a, cam);
        e.cliqueNovo = true;
        e.pressionado = true;
      } else if (f === 1) {
        e.apontar(b, cam);
        e.pressionado = true;
      } else {
        e.apontar(b, cam);
        e.soltouNovo = true;
      }
      return;
    }
    case 'superficie': {
      if (!peca) return;
      // mira os pontos visíveis ainda não trabalhados, como quem olha a peça e passa o pincel
      const am = (peca as unknown as { amostras: THREE.Vector3[]; marcadas: Uint8Array }).amostras;
      const mk = (peca as unknown as { marcadas: Uint8Array }).marcadas;
      if (!am.length) return;
      let i = mem.alvoIdx % am.length;
      for (let k = 0; k < am.length && mk[i]; k++) i = (i + 1) % am.length;
      mem.alvoIdx = i;
      // vai e vem curto entre dois pontos vizinhos da superfície, como uma pincelada
      const j = mem.fase++ % 2 ? (i + 1) % am.length : i;
      segurar(peca.localToWorld(am[j].clone()));
      return;
    }
    case 'ritmo': {
      const vel = h.med('Velocidade');
      if (vel?.faixa) {
        const alvo = (vel.faixa[0] + vel.faixa[1]) / 2;
        if (vel.valor < alvo - 0.03) e.roda = -1;
        else if (vel.valor > alvo + 0.03) e.roda = 1;
        return;
      }
      if (v === 'circular' || v === 'circular-rapido') {
        if (mesa.conteudo && mesa.recipiente) {
          const w = v === 'circular-rapido' ? 13 : 5;
          mem.ang += w * dt;
          const c = mesa.centro.clone();
          const y = mesa.conteudo.position.y + mesa.conteudo.estado.nivel;
          segurar(new THREE.Vector3(c.x + Math.cos(mem.ang) * mesa.bocaRaio * 0.5, y, c.z + Math.sin(mem.ang) * mesa.bocaRaio * 0.5));
          return;
        }
      }
      if (v === 'dobrar' && mesa.conteudo) {
        e.pressionado = true;
        if (mem.fase++ % 6 === 0) mem.sinal = mem.sinal === 1 ? -1 : 1;
        e.moverPx(0, mem.sinal * 12);
        return;
      }
      if (v === 'golpes') {
        if (mem.fase++ % 6 === 0) e.cliqueNovo = true;
        return;
      }
      if (v === 'pressionar') {
        e.pressionado = true;
        const f = h.med('Força');
        if (!f || f.valor < 0.6) e.moverPx(0, 8);
        return;
      }
      // vaivem e dobrar sem tigela
      e.pressionado = true;
      if (mem.fase++ % 5 === 0) mem.sinal = mem.sinal === 1 ? -1 : 1;
      e.moverPx(0, mem.sinal * 15);
      return;
    }
    case 'calor': {
      e.teclas.add(' ');
      const termo = h.med('Termômetro');
      const forno = h.med('Forno');
      if (termo?.faixa) {
        const alvo = (termo.faixa[0] + termo.faixa[1]) / 2;
        if (forno) {
          // no forno, o ajuste é pela roda; mira o centro da faixa
          const ajuste = forno.valor * 260;
          const desejado = alvo * 280;
          if (ajuste < desejado - 3) e.roda = -1;
          else if (ajuste > desejado + 3) e.roda = 1;
        } else if (termo.valor < alvo - 0.004) e.teclas.add('e');
        else if (termo.valor > alvo + 0.004) e.teclas.add('q');
      }
      return;
    }
    case 'tempo': {
      const timer = h.med('Timer');
      if (timer && h.botaoTexto === 'Iniciar') {
        if (timer.valor < 0.5) e.roda = -1;
        else h.clicar = true;
      }
      e.teclas.add(' ');
      return;
    }
    case 'verter': {
      if (v === 'escumar') {
        if (!mesa.recipiente || !mesa.conteudo) return;
        mem.ang += dt * 3;
        const r = mesa.bocaRaio * (0.1 + 0.75 * ((mem.t * 0.37) % 1));
        const c = mesa.centro;
        segurar(new THREE.Vector3(c.x + Math.cos(mem.ang) * r, mesa.conteudo.position.y + mesa.conteudo.estado.nivel, c.z + Math.sin(mem.ang) * r));
        return;
      }
      if (v === 'peneirar') {
        e.pressionado = true;
        if (mem.fase++ % 3 === 0) mem.sinal = mem.sinal === 1 ? -1 : 1;
        e.moverPx(mem.sinal * 40, 0);
        return;
      }
      e.pressionado = true;
      const fio = h.med('Fio');
      if (!fio || fio.valor < 0.3) e.moverPx(0, -5);
      else if (fio.valor > 0.6) e.moverPx(0, 5);
      return;
    }
    case 'medir': {
      const m2 = h.med('Balança') ?? h.med('Jarra');
      if (m2?.faixa && m2.valor < (m2.faixa[0] + m2.faixa[1]) / 2 - 0.004) e.pressionado = true;
      else if (h.botaoTexto === 'Pronto') h.clicar = true;
      return;
    }
    case 'montar': {
      const marcas = visiveis(cena, (o) => o.renderOrder === 6 && Math.abs(o.scale.x - 0.011) < 1e-4);
      if (marcas.length) {
        e.apontar(marcas[0].getWorldPosition(new THREE.Vector3()), cam);
        if (mem.fase++ % 2 === 0) e.cliqueNovo = true;
        return;
      }
      if (v === 'enrolar' || v === 'virar') {
        e.pressionado = true;
        e.moverPx(0, -25);
      } else if (v === 'trancar') {
        if (mem.fase++ % 2 === 0) e.cliqueNovo = true;
      } else if (v === 'rechear') {
        const r = h.med('Recheio');
        if (r?.faixa && r.valor < (r.faixa[0] + r.faixa[1]) / 2) e.pressionado = true;
        else if (h.botaoTexto === 'Pronto') h.clicar = true;
      } else if (v === 'dobrar') {
        const f = mem.fase++ % 3;
        if (f === 0) {
          e.cliqueNovo = true;
          e.pressionado = true;
          e.px.set(600, 400);
        } else if (f === 1) {
          e.pressionado = true;
          e.moverPx(-120, 0);
        } else e.soltouNovo = true;
      } else if (v === 'forrar') {
        const pc = m.mesa.peca;
        const est = pc ? pc.position.clone().setY(pc.position.y + pc.altura * pc.scale.y + 0.004) : new THREE.Vector3();
        if (mem.t < 1.2) segurar(est);
      } else {
        e.pressionado = true;
        e.moverPx(mem.fase++ % 2 ? 40 : -40, 0);
      }
      return;
    }
    case 'confeitar': {
      const guias = visiveis(cena, (o) => (o.material as THREE.MeshBasicMaterial)?.opacity === 0.45 && Math.abs(o.scale.x - 0.003) < 1e-5);
      if (!guias.length) {
        h.clicar = true;
        return;
      }
      // segue o guia mais próximo do ponteiro
      const atual = e.noPlano(cam, guias[0].position.y) ?? guias[0].position;
      guias.sort((a, b) => a.position.distanceTo(atual) - b.position.distanceTo(atual));
      const alvo = guias[0].position.clone();
      const passo2 = alvo.clone().sub(atual);
      const p = passo2.length() > 0.008 ? atual.clone().addScaledVector(passo2.normalize(), 0.008) : alvo;
      segurar(p);
      return;
    }
    case 'testar':
      h.responder = 1;
      return;
    case 'separar': {
      if (!peca) return;
      const base = peca.localToWorld(new THREE.Vector3(peca.comprimento * 0.25, 0, 0));
      base.y = peca.position.y + 0.02;
      const dir = peca.localToWorld(new THREE.Vector3(1, 0, 0)).sub(peca.position).setY(0).normalize();
      if (mem.fase === 0) {
        e.apontar(base, cam);
        e.cliqueNovo = true;
        e.pressionado = true;
        mem.fase = 1;
        mem.acc = 0;
      } else {
        mem.acc += dt * 0.08;
        segurar(base.clone().addScaledVector(dir, mem.acc));
      }
      return;
    }
  }
}

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
