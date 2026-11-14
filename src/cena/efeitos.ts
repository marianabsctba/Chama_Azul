// Efeitos animados por shader: chama azul, vidro com chuva, céu de fim de tarde e vapor.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sorteador } from './texturas';

const RUIDO = /* glsl */ `
float h11(float n){ return fract(sin(n*127.1)*43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float ruido(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ s += a*ruido(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

/* ------------------------------------------------------------------ */
/* Chama                                                               */
/* ------------------------------------------------------------------ */

export interface Chama {
  malha: THREE.Mesh;
  uniforms: { uTempo: { value: number }; uInt: { value: number } };
}

/** Coroa de línguas de fogo azuis em volta de um queimador (origem no centro do queimador). */
export function criarChama(raio = 0.05): Chama {
  const geos: THREE.BufferGeometry[] = [];
  const r = sorteador(77);
  const up = new THREE.Vector3(0, 1, 0);
  const camadas = [
    { n: 22, raio, alt: 0.05, larg: 0.011, incl: 0.45, tipo: 0 },
    { n: 16, raio: raio * 0.82, alt: 0.022, larg: 0.008, incl: 0.25, tipo: 1 },
  ];
  for (const cam of camadas) {
    for (let i = 0; i < cam.n; i++) {
      const a = (i / cam.n) * Math.PI * 2;
      const cone = new THREE.ConeGeometry(cam.larg, cam.alt, 5, 4, true);
      cone.translate(0, cam.alt / 2, 0);
      const n = cone.attributes.position.count;
      const alt = new Float32Array(n);
      for (let k = 0; k < n; k++) alt[k] = cone.attributes.position.getY(k) / cam.alt;
      const dir = new THREE.Vector3(Math.cos(a) * cam.incl, 1, Math.sin(a) * cam.incl).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const base = new THREE.Vector3(Math.cos(a) * cam.raio, 0, Math.sin(a) * cam.raio);
      cone.applyMatrix4(new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1)));
      const fase = r();
      cone.setAttribute('aAlt', new THREE.Float32BufferAttribute(alt, 1));
      cone.setAttribute('aFase', new THREE.Float32BufferAttribute(new Float32Array(n).fill(fase), 1));
      cone.setAttribute('aTipo', new THREE.Float32BufferAttribute(new Float32Array(n).fill(cam.tipo), 1));
      const bs = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        bs[k * 3] = base.x;
        bs[k * 3 + 1] = base.y;
        bs[k * 3 + 2] = base.z;
      }
      cone.setAttribute('aBase', new THREE.Float32BufferAttribute(bs, 3));
      cone.deleteAttribute('uv');
      cone.deleteAttribute('normal');
      geos.push(cone);
    }
  }
  const g = mergeGeometries(geos, false)!;
  const uniforms = { uTempo: { value: 0 }, uInt: { value: 0.6 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aAlt; attribute float aFase; attribute float aTipo; attribute vec3 aBase;
      uniform float uTempo; uniform float uInt;
      varying float vAlt; varying float vTipo;
      void main(){
        float osc = 0.82 + 0.12*sin(uTempo*23.0 + aFase*6.283) + 0.08*sin(uTempo*37.0 + aFase*11.0);
        float esc = mix(0.3, 1.35, uInt) * osc;
        vec3 d = position - aBase;
        vec3 p = aBase + vec3(d.x*(1.0 + (esc-1.0)*0.6), d.y*esc, d.z*(1.0 + (esc-1.0)*0.6));
        p.x += sin(uTempo*9.0 + aFase*20.0 + aAlt*3.0) * 0.0035 * aAlt;
        p.z += cos(uTempo*8.0 + aFase*17.0 + aAlt*3.0) * 0.0035 * aAlt;
        vAlt = aAlt; vTipo = aTipo;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uInt;
      varying float vAlt; varying float vTipo;
      void main(){
        vec3 cor = mix(vec3(0.35,0.62,1.0), vec3(0.06,0.2,1.0), smoothstep(0.0,0.45,vAlt));
        cor = mix(cor, vec3(0.3,0.12,0.75), smoothstep(0.55,1.0,vAlt));
        if (vTipo > 0.5) cor = mix(vec3(0.75,0.92,1.0), vec3(0.25,0.5,1.0), vAlt);
        float a = (1.0 - smoothstep(0.15, 1.0, vAlt)) * (0.5 + 0.5*uInt);
        gl_FragColor = vec4(cor * a * 1.5, a);
      }`,
  });
  const malha = new THREE.Mesh(g, mat);
  malha.name = 'chama';
  malha.renderOrder = 5;
  malha.frustumCulled = false;
  return { malha, uniforms };
}

/* ------------------------------------------------------------------ */
/* Vidro da janela com chuva escorrendo                                */
/* ------------------------------------------------------------------ */

export function materialJanela(largura: number, altura: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTempo: { value: 0 }, uTam: { value: new THREE.Vector2(largura, altura) } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTempo; uniform vec2 uTam;
      varying vec2 vUv;
      ${RUIDO}
      // Camada de gotas que descem em zigue-zague deixando rastro.
      float camada(vec2 uv, float t){
        vec2 asp = vec2(2.0, 1.0);
        vec2 st = uv * asp;
        st.y += t * 0.25;
        vec2 id = floor(st);
        vec2 gv = fract(st) - 0.5;
        float n = h21(id);
        t += n * 6.283;
        float w = uv.y * 10.0;
        float x = (n - 0.5) * 0.8;
        x += (0.4 - abs(x)) * sin(3.0*w) * pow(sin(w), 6.0) * 0.45;
        float y = -sin(t + sin(t + sin(t)*0.5)) * 0.45;
        y -= (gv.x - x) * (gv.x - x);
        vec2 pg = (gv - vec2(x, y)) / asp;
        float gota = smoothstep(0.05, 0.03, length(pg));
        vec2 pr = (gv - vec2(x, t*0.25)) / asp;
        pr.y = (fract(pr.y * 8.0) - 0.5) / 8.0;
        float rastro = smoothstep(0.03, 0.01, length(pr));
        float neb = smoothstep(-0.05, 0.05, pg.y) * smoothstep(0.5, y, gv.y);
        rastro *= neb;
        neb *= smoothstep(0.05, 0.04, abs(pg.x));
        return gota + rastro * 0.5 + neb * 0.18;
      }
      void main(){
        vec2 uv = vUv * uTam;
        float t = uTempo * 0.5;
        float g = camada(uv * 1.7, t) + camada(uv * 2.9 + vec2(1.3, 0.7), t * 1.15) * 0.7;
        vec2 c = uv * 38.0;
        vec2 sid = floor(c);
        vec2 sf = fract(c) - 0.5;
        float h = h21(sid);
        float est = smoothstep(0.22, 0.08, length(sf - (vec2(h, fract(h*7.0)) - 0.5) * 0.5)) * step(0.82, h);
        est *= clamp(sin(uTempo*0.4 + h*40.0)*1.5, 0.0, 1.0);
        float tot = clamp(g + est * 0.7, 0.0, 1.0);
        // Embaçado nas bordas de baixo.
        float emb = smoothstep(0.25, 0.0, vUv.y) * 0.15;
        vec3 cor = mix(vec3(0.55, 0.66, 0.82), vec3(0.92, 0.96, 1.0), tot);
        float a = 0.06 + emb + tot * 0.42;
        gl_FragColor = vec4(cor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------ */
/* Céu lá fora: fim de tarde azulado, cidade, árvores e chuva          */
/* ------------------------------------------------------------------ */

export function materialCeu(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTempo: { value: 0 } },
    depthWrite: true,
    vertexShader: /* glsl */ `
      varying vec3 vP;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vP = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTempo;
      varying vec3 vP;
      ${RUIDO}
      void main(){
        float y = vP.y; float x = vP.z;
        float k = clamp((y - 0.8) / 7.0, 0.0, 1.0);
        vec3 alto = vec3(0.07, 0.13, 0.32);
        vec3 meio = vec3(0.26, 0.40, 0.70);
        vec3 baixo = vec3(0.95, 0.66, 0.55);
        vec3 ceu = mix(baixo, meio, smoothstep(0.0, 0.3, k));
        ceu = mix(ceu, alto, smoothstep(0.25, 1.0, k));
        float sol = exp(-length(vec2((x + 2.5) * 0.22, (y - 1.9) * 0.7)));
        ceu += vec3(1.0, 0.6, 0.32) * sol * 0.9;
        float n = fbm(vec2(x * 0.16 + uTempo * 0.012, y * 0.38));
        ceu = mix(ceu, vec3(0.36, 0.42, 0.6) * (0.75 + 0.5*k), smoothstep(0.45, 0.85, n) * 0.55);
        vec3 cor = ceu;

        // Cidade distante com janelas acesas.
        float col = floor(x * 1.1);
        float alt = 0.9 + h11(col) * 1.7 + step(0.86, h11(col + 7.0)) * 1.3;
        float predio = step(y, alt);
        vec3 corPredio = mix(vec3(0.10, 0.14, 0.27), ceu, 0.3);
        vec2 cel = vec2(x * 7.0, y * 8.0);
        vec2 ic = floor(cel); vec2 fc = fract(cel);
        float janela = step(0.2, fc.x) * step(fc.x, 0.75) * step(0.25, fc.y) * step(fc.y, 0.7);
        float acesa = step(0.6, h21(ic + col * 3.1)) * janela * step(y, alt - 0.12);
        corPredio += vec3(1.0, 0.74, 0.4) * acesa * 0.9;
        cor = mix(cor, corPredio, predio);

        // Copas de árvores perto.
        float arv = 0.45 + fbm(vec2(x * 0.8, 3.0)) * 1.2;
        float copa = smoothstep(arv + 0.04, arv - 0.04, y);
        cor = mix(cor, vec3(0.05, 0.10, 0.13), copa);

        // Véu de chuva.
        cor = mix(cor, vec3(0.42, 0.5, 0.68), 0.16);
        float fx = x * 20.0;
        float idc = floor(fx);
        float fio = smoothstep(0.1, 0.0, abs(fract(fx) - 0.5)) * step(0.5, h11(idc));
        float q = fract(y * 0.3 + uTempo * (1.4 + h11(idc + 3.0)) + h11(idc));
        fio *= smoothstep(0.0, 0.1, q) * smoothstep(0.45, 0.1, q);
        cor += vec3(0.6, 0.7, 0.88) * fio * 0.14;
        gl_FragColor = vec4(cor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------ */
/* Vapor sutil                                                         */
/* ------------------------------------------------------------------ */

export interface Vapor {
  pontos: THREE.Points;
  uniforms: { uTempo: { value: number }; uEsc: { value: number }; uForca: { value: number } };
}

export function criarVapor(base: THREE.Vector3, quantidade = 26): Vapor {
  const g = new THREE.BufferGeometry();
  const r = sorteador(91);
  const sem = new Float32Array(quantidade);
  for (let i = 0; i < quantidade; i++) sem[i] = r();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(quantidade * 3), 3));
  g.setAttribute('aSem', new THREE.Float32BufferAttribute(sem, 1));
  const uniforms = { uTempo: { value: 0 }, uEsc: { value: 500 }, uForca: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uBase: { value: base.clone() } },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSem;
      uniform float uTempo; uniform float uEsc; uniform vec3 uBase;
      varying float vA;
      void main(){
        float vida = fract(uTempo * 0.11 + aSem);
        vec3 p = uBase;
        p.y += vida * 0.6;
        p.x += sin(aSem * 40.0 + uTempo * 0.7) * 0.04 * vida + (fract(aSem * 13.0) - 0.5) * 0.1;
        p.z += cos(aSem * 23.0 + uTempo * 0.5) * 0.04 * vida + (fract(aSem * 7.0) - 0.5) * 0.08;
        vA = smoothstep(0.0, 0.2, vida) * (1.0 - vida);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uEsc * (0.06 + vida * 0.16) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uForca;
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.16 * uForca;
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a);
      }`,
  });
  // Os uniforms do material são a fonte da verdade; expomos as mesmas referências.
  const u = mat.uniforms as unknown as Vapor['uniforms'];
  const pontos = new THREE.Points(g, mat);
  pontos.frustumCulled = false;
  pontos.renderOrder = 6;
  pontos.name = 'vapor';
  pontos.onBeforeRender = (renderer, _cena, camera) => {
    const cam = camera as THREE.PerspectiveCamera;
    u.uEsc.value = renderer.domElement.height * cam.projectionMatrix.elements[5] * 0.5;
  };
  return { pontos, uniforms: u };
}
