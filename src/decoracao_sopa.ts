// Decorações de sopa feitas como no livro: cada técnica da bancada de decoração
// desenha sobre o caldo o que ela ensina (croûtons, corações de creme, treliça de
// cebolinha, redemoinho de pesto...), em vez de pôr a peça inteira na tigela.
import * as THREE from 'three';

/** Sopa de fundo que valoriza cada decoração (cor, brilho). */
export const SOPA_DA_DECORACAO: Record<string, [string, number]> = {
  'guarnicao-simples': ['#e8913a', 0.55],
  'anel-de-ervas': ['#f2e6c4', 0.5],
  'tomate-e-ervas': ['#e9e4c8', 0.45],
  'trelica-de-cebolinha': ['#f2e6c4', 0.5],
  'amendoas-tostadas': ['#efe0b8', 0.5],
  'petalas-de-azeitona': ['#f2e6c4', 0.5],
  'julienne-decorativa': ['#e3c47a', 0.9],
  'fitas-enroladas': ['#e3c47a', 0.9],
  'miscelanea-de-legumes': ['#e3c47a', 0.9],
  'figuras-de-pimentao': ['#f2e6c4', 0.5],
  'figuras-de-aspic': ['#b8732e', 0.95],
  minicogumelos: ['#8a7660', 0.5],
  croutons: ['#c8432b', 0.6],
  'creme-de-leite-em-sopa': ['#c8432b', 0.6],
  'borda-romantica': ['#c8432b', 0.6],
  'roda-da-catarina': ['#e8913a', 0.55],
};

const mat = (cor: string, rough = 0.6, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: rough, ...extra });

/** Gerador simples e repetível para espalhar as coisas sempre do mesmo jeito. */
function sorteio(semente: number) {
  let s = semente;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

/** Folhinha achatada (ervas, manjericão, salsinha). */
function folha(cor: string, tam: number) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(cor, 0.55));
  m.scale.set(tam, tam * 0.08, tam * 0.5);
  return m;
}

/** Coração de creme: duas gotas puxadas pela ponta da faca, unidas por um fio. */
function coracao(cor: string, tam: number) {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(0, -tam * 0.9);
  forma.bezierCurveTo(tam * 0.2, -tam * 0.5, tam, -tam * 0.2, tam * 0.95, tam * 0.35);
  forma.bezierCurveTo(tam * 0.9, tam, tam * 0.15, tam, 0, tam * 0.45);
  forma.bezierCurveTo(-tam * 0.15, tam, -tam * 0.9, tam, -tam * 0.95, tam * 0.35);
  forma.bezierCurveTo(-tam, -tam * 0.2, -tam * 0.2, -tam * 0.5, 0, -tam * 0.9);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(forma, 12), mat(cor, 0.4));
  m.rotation.x = -Math.PI / 2;
  g.add(m);
  return g;
}

/** Curva de creme/pesto achatada sobre o caldo. */
function fio(pts: THREE.Vector3[], esp: number, cor: string) {
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, esp, 6), mat(cor, 0.4));
  m.scale.y = 0.3;
  return m;
}

/**
 * Devolve a decoração da técnica sobre o caldo (y = 0 na superfície), ou null se a
 * técnica não for de decorar sopa. `r` é o raio útil da sopa.
 */
export function decorarSopa(idTecnica: string, r: number): THREE.Group | null {
  const nome = idTecnica.replace(/^decoracao\./, '');
  if (!idTecnica.startsWith('decoracao.') || !(nome in SOPA_DA_DECORACAO)) return null;
  const g = new THREE.Group();
  const rnd = sorteio(nome.length * 131 + 7);
  const espalhar = (n: number, raio: number, criar: (i: number) => THREE.Object3D, altura = 0.002) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * raio;
      const o = criar(i);
      o.position.set(Math.cos(a) * d, altura, Math.sin(a) * d);
      o.rotation.y = rnd() * Math.PI * 2;
      g.add(o);
    }
  };
  switch (nome) {
    case 'guarnicao-simples': {
      // ninho de chiffonade de espinafre e uma pitada de páprica
      espalhar(26, r * 0.12, () => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.0006, 0.0024), mat('#2f5a26', 0.6));
        f.rotation.set((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.6);
        return f;
      }, 0.003);
      espalhar(40, r * 0.35, () => new THREE.Mesh(new THREE.SphereGeometry(0.0007, 4, 3), mat('#9a2a14')), 0.0005);
      break;
    }
    case 'anel-de-ervas': {
      // anel de raminhos de endro no meio do caminho entre o centro e a borda
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const f = folha('#5f8a3a', 0.009);
        f.position.set(Math.cos(a) * r * 0.45, 0.001, Math.sin(a) * r * 0.45);
        f.rotation.y = -a + (rnd() - 0.5) * 0.6;
        g.add(f);
      }
      break;
    }
    case 'tomate-e-ervas': {
      // montinho de concassée no centro, folhas de manjericão em volta
      for (let i = 0; i < 40; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.005, 0.005), mat(rnd() < 0.15 ? '#e8705a' : '#c8302a', 0.45));
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * 0.018;
        c.position.set(Math.cos(a) * d, 0.0025 + (1 - d / 0.02) * 0.008 * rnd(), Math.sin(a) * d);
        c.rotation.set(rnd(), rnd() * 3, rnd());
        g.add(c);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const f = folha('#2f7a2a', 0.011);
        f.position.set(Math.cos(a) * 0.03, 0.001, Math.sin(a) * 0.03);
        f.rotation.y = -a;
        g.add(f);
      }
      break;
    }
    case 'trelica-de-cebolinha': {
      // hastes cruzadas em losango
      const L = r * 1.1;
      for (const giro of [0.5, -0.5]) {
        for (let i = -2; i <= 2; i++) {
          const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, L, 6), mat('#3f7a2a', 0.5));
          h.rotation.z = Math.PI / 2;
          const eixo = new THREE.Group();
          h.position.z = i * 0.014;
          eixo.add(h);
          eixo.rotation.y = giro;
          eixo.position.y = 0.0015 + (giro > 0 ? 0.0012 : 0);
          g.add(eixo);
        }
      }
      break;
    }
    case 'amendoas-tostadas': {
      espalhar(16, r * 0.3, () => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(rnd() < 0.5 ? '#c8904a' : '#e0b070', 0.6));
        m.scale.set(0.007, 0.0012, 0.0045);
        return m;
      });
      break;
    }
    case 'petalas-de-azeitona': {
      // flor de rodelas de azeitona com salsinha no centro
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const anel = new THREE.Mesh(new THREE.TorusGeometry(0.0045, 0.0022, 6, 16), mat('#1e1a14', 0.3));
        anel.rotation.x = -Math.PI / 2;
        anel.scale.z = 0.5;
        anel.position.set(Math.cos(a) * 0.011, 0.0012, Math.sin(a) * 0.011);
        g.add(anel);
      }
      const s = folha('#3f8a2a', 0.008);
      s.position.y = 0.002;
      g.add(s);
      break;
    }
    case 'julienne-decorativa': {
      espalhar(36, 0.012, () => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.0025, 0.0025), mat(rnd() < 0.55 ? '#e8782a' : '#9ac25a', 0.5));
        p.rotation.y = (rnd() - 0.5) * 0.4;
        return p;
      }, 0.002);
      break;
    }
    case 'fitas-enroladas': {
      // fitas finas de cenoura e abobrinha enroladas em espiral
      [['#e8782a', -0.014], ['#7aa84a', 0.014]].forEach(([cor, x]) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 40; i++) {
          const t = i / 40;
          const a = t * Math.PI * 4;
          pts.push(new THREE.Vector3(Math.cos(a) * 0.009 * (0.3 + t), t * 0.006, Math.sin(a) * 0.009 * (0.3 + t)));
        }
        const fita = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0018, 4), mat(cor as string, 0.5));
        fita.scale.set(1, 1.6, 1);
        fita.position.set(x as number, 0.001, 0);
        g.add(fita);
      });
      break;
    }
    case 'miscelanea-de-legumes': {
      const cores = ['#e8782a', '#7aa84a', '#c8d890'];
      espalhar(45, r * 0.4, (i) => new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.004), mat(cores[i % 3], 0.5)), 0.0015);
      break;
    }
    case 'figuras-de-pimentao': {
      // estrelinhas e losangos de pimentão escaldado
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const forma = new THREE.Shape();
        for (let k = 0; k < 10; k++) {
          const ang = (k / 10) * Math.PI * 2;
          const rr = k % 2 ? 0.003 : 0.007;
          if (k === 0) forma.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
          else forma.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), mat(i % 2 ? '#d8a02a' : '#c8202a', 0.35, { side: THREE.DoubleSide }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(Math.cos(a) * r * 0.4, 0.001, Math.sin(a) * r * 0.4);
        g.add(m);
      }
      break;
    }
    case 'figuras-de-aspic': {
      // cubinhos e losangos de gelatina brilhante boiando no consomê
      espalhar(9, r * 0.35, (i) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.004, i % 2 ? 0.009 : 0.005), mat('#d89a4a', 0.05, { transparent: true, opacity: 0.75 }));
        return m;
      }, 0.0015);
      break;
    }
    case 'minicogumelos': {
      // fatias de cogumelo douradas, em leque
      for (let i = 0; i < 5; i++) {
        const forma = new THREE.Shape();
        forma.moveTo(-0.004, -0.009);
        forma.lineTo(-0.004, -0.002);
        forma.absarc(0, -0.001, 0.011, Math.PI * 1.05, -0.05, true);
        forma.lineTo(0.004, -0.002);
        forma.lineTo(0.004, -0.009);
        forma.lineTo(-0.004, -0.009);
        const m = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.002, bevelEnabled: false }), mat('#d8b07a', 0.6));
        m.rotation.x = -Math.PI / 2;
        const a = -0.8 + i * 0.4;
        m.position.set(Math.cos(a) * 0.012 - 0.006, 0.0012 + i * 0.0005, Math.sin(a) * 0.012);
        m.rotation.z = a;
        g.add(m);
      }
      break;
    }
    case 'croutons': {
      espalhar(14, r * 0.35, () => {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.008), mat(rnd() < 0.5 ? '#d89a3a' : '#c07a2a', 0.85));
        c.rotation.set(rnd() * 0.5, rnd() * 3, rnd() * 0.5);
        return c;
      }, 0.003);
      break;
    }
    case 'creme-de-leite-em-sopa': {
      // espiral de creme puxada do centro
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const a = t * Math.PI * 5;
        pts.push(new THREE.Vector3(Math.cos(a) * r * 0.6 * t, 0, Math.sin(a) * r * 0.6 * t));
      }
      g.add(fio(pts, 0.0022, '#fbf7ee'));
      break;
    }
    case 'borda-romantica': {
      // corações de creme em volta, ligados por um fio
      const n = 9;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const c = coracao('#fbf7ee', 0.0055);
        c.position.set(Math.cos(a) * r * 0.62, 0.0012, Math.sin(a) * r * 0.62);
        c.rotation.y = -a - Math.PI / 2;
        g.add(c);
      }
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r * 0.62, 0.0008, Math.sin(a) * r * 0.62));
      }
      g.add(fio(pts, 0.0007, '#fbf7ee'));
      break;
    }
    case 'roda-da-catarina': {
      // redemoinho de pesto com creme: braços puxados do centro para fora
      const disco = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24), mat('#8ab04a', 0.4));
      disco.rotation.x = -Math.PI / 2;
      disco.position.y = 0.0008;
      g.add(disco);
      for (let k = 0; k < 8; k++) {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const a = (k / 8) * Math.PI * 2 + t * 1.2;
          pts.push(new THREE.Vector3(Math.cos(a) * (0.008 + t * r * 0.55), 0.0006, Math.sin(a) * (0.008 + t * r * 0.55)));
        }
        g.add(fio(pts, 0.0016 * (1 - 0.3 * (k % 2)), '#8ab04a'));
      }
      break;
    }
  }
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}
