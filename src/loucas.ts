// Louças pequenas e específicas que o livro pede para servir o que não é prato:
// tigelinha (pastas, molhos frios), ramequim (cremes, suflês), xícara de consomê,
// molheira, pote de vidro, cumbuca de barro e copo.
import * as THREE from 'three';

export type LoucaPequena = 'tigelinha' | 'ramequim' | 'xicara' | 'molheira' | 'pote' | 'cumbuca' | 'copo';
export const LOUCAS_PEQUENAS: LoucaPequena[] = ['tigelinha', 'ramequim', 'xicara', 'molheira', 'pote', 'cumbuca', 'copo'];

export interface LoucaMontada {
  g: THREE.Group;
  /** Raio útil no fundo, para assentar peças. */
  poco: number;
  /** Altura do fundo por dentro. */
  piso: number;
  /** Altura da superfície do líquido ou da pasta. */
  nivel: number;
  /** Raio da superfície do líquido nessa altura. */
  raioLiquido: number;
  /** Líquido transparente pede material de vidro. */
  vidro: boolean;
}

const branca = () => new THREE.MeshStandardMaterial({ color: '#f7f5f0', roughness: 0.25, metalness: 0.02 });
const vidroMat = () => new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.04, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });

function torno(perfil: [number, number][], mat: THREE.Material, seg = 64) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(perfil.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Pires sob xícara, ramequim e molheira: dá escala e acabamento de serviço. */
function pires(r: number) {
  return torno([[0, 0], [r * 0.7, 0], [r * 0.95, 0.006], [r, 0.009], [r * 0.97, 0.01], [r * 0.7, 0.004], [0, 0.004]], branca());
}

export function criarLoucaPequena(tipo: LoucaPequena): LoucaMontada {
  const g = new THREE.Group();
  switch (tipo) {
    case 'tigelinha': {
      const r = 0.06;
      g.add(torno([[0, 0], [r * 0.55, 0], [r * 0.62, 0.004], [r * 0.85, 0.02], [r, 0.04], [r * 0.97, 0.042], [r * 0.82, 0.024], [r * 0.58, 0.008], [0, 0.007]], branca()));
      return { g, poco: r * 0.5, piso: 0.008, nivel: 0.033, raioLiquido: r * 0.9, vidro: false };
    }
    case 'cumbuca': {
      const r = 0.07;
      g.add(torno([[0, 0], [r * 0.6, 0], [r * 0.66, 0.005], [r * 0.9, 0.025], [r, 0.05], [r * 0.95, 0.052], [r * 0.86, 0.03], [r * 0.6, 0.01], [0, 0.009]], new THREE.MeshStandardMaterial({ color: '#8a4a2a', roughness: 0.7 })));
      return { g, poco: r * 0.55, piso: 0.01, nivel: 0.042, raioLiquido: r * 0.9, vidro: false };
    }
    case 'ramequim': {
      const r = 0.045;
      g.add(pires(0.075));
      const corpo = torno([[0, 0], [r, 0], [r, 0.042], [r * 0.93, 0.042], [r * 0.93, 0.006], [0, 0.006]], branca(), 48);
      corpo.position.y = 0.006;
      g.add(corpo);
      // caneluras de ramequim
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.04, 6), branca());
        c.position.set(Math.cos(a) * r, 0.027, Math.sin(a) * r);
        g.add(c);
      }
      return { g, poco: r * 0.85, piso: 0.012, nivel: 0.044, raioLiquido: r * 0.92, vidro: false };
    }
    case 'xicara': {
      const r = 0.048;
      g.add(pires(0.085));
      const corpo = torno([[0, 0], [r * 0.6, 0], [r * 0.85, 0.012], [r, 0.04], [r * 0.97, 0.042], [r * 0.82, 0.014], [r * 0.58, 0.004], [0, 0.004]], branca());
      corpo.position.y = 0.006;
      g.add(corpo);
      // xícara de consomê: duas asas
      for (const s of [-1, 1]) {
        const asa = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0028, 8, 20, Math.PI), branca());
        asa.rotation.set(0, s > 0 ? 0 : Math.PI, -Math.PI / 2);
        asa.position.set(s * r * 1.02, 0.03, 0);
        g.add(asa);
      }
      return { g, poco: r * 0.5, piso: 0.01, nivel: 0.04, raioLiquido: r * 0.9, vidro: false };
    }
    case 'molheira': {
      g.add(pires(0.09));
      const corpo = torno([[0, 0], [0.03, 0], [0.04, 0.012], [0.045, 0.035], [0.043, 0.037], [0.037, 0.014], [0.026, 0.004], [0, 0.004]], branca());
      corpo.scale.set(1.5, 1, 1);
      corpo.position.y = 0.006;
      g.add(corpo);
      const bico = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 12, 1, true), branca());
      bico.rotation.z = Math.PI / 2 + 0.3;
      bico.position.set(0.075, 0.04, 0);
      g.add(bico);
      const asa = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.003, 8, 20, Math.PI * 1.2), branca());
      asa.rotation.set(0, Math.PI, -Math.PI / 2);
      asa.position.set(-0.07, 0.03, 0);
      g.add(asa);
      return { g, poco: 0.025, piso: 0.012, nivel: 0.036, raioLiquido: 0.04, vidro: false };
    }
    case 'pote': {
      const r = 0.042;
      g.add(torno([[0, 0], [r, 0], [r, 0.09], [r * 0.85, 0.095], [r * 0.85, 0.1], [r * 0.8, 0.1], [r * 0.8, 0.094], [r * 0.95, 0.088], [r * 0.95, 0.004], [0, 0.004]], vidroMat()));
      // tampa encostada ao lado
      const tampa = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.012, 32), new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.3, metalness: 0.8 }));
      tampa.position.set(r * 2.2, 0.006, r * 0.6);
      g.add(tampa);
      return { g, poco: r * 0.8, piso: 0.005, nivel: 0.07, raioLiquido: r * 0.94, vidro: true };
    }
    case 'copo': {
      const r = 0.034;
      g.add(torno([[0, 0], [r * 0.9, 0], [r, 0.1], [r * 0.95, 0.1], [r * 0.86, 0.008], [0, 0.008]], vidroMat()));
      return { g, poco: r * 0.7, piso: 0.008, nivel: 0.075, raioLiquido: r * 0.92, vidro: true };
    }
  }
}

/** Superfície de líquido ou pasta dentro da louça pequena. */
export function superficie(raio: number, cor: string | THREE.Color, claro: boolean, textura: 'liso' | 'granulado' = 'liso'): THREE.Mesh {
  const geo = new THREE.CircleGeometry(raio, 48, 0, Math.PI * 2);
  if (textura === 'granulado') {
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setZ(i, (Math.sin(pos.getX(i) * 900) * Math.cos(pos.getY(i) * 800)) * 0.0008);
    geo.computeVertexNormals();
  }
  const m = new THREE.Mesh(geo, claro
    ? new THREE.MeshStandardMaterial({ color: new THREE.Color(cor).multiplyScalar(0.85), roughness: 0.02, metalness: 0.1, transparent: true, opacity: 0.93, emissive: new THREE.Color(cor).multiplyScalar(0.12) })
    : new THREE.MeshStandardMaterial({ color: cor, roughness: textura === 'granulado' ? 0.8 : 0.35 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
