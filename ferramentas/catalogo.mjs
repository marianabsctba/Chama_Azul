// Junta as partes do catálogo em src/dados/catalogo.json, liga cada passo a um gesto,
// extrai a meta numérica e reconhece os alimentos. Uso: node ferramentas/catalogo.mjs [--verificar]
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const fonte = path.join(raiz, 'dados', 'fonte');
const saida = path.join(raiz, 'src', 'dados', 'catalogo.json');

const GESTOS = {
  cortar: ['cortar', 'picar', 'fatiar', 'desossar', 'perfurar', 'descaroçar', 'rasgar', 'desfiar', 'eviscerar', 'lardear', 'marcar', 'abrir'],
  superficie: ['descascar', 'escamar', 'raspar', 'limpar', 'ralar', 'pincelar', 'polvilhar', 'espalhar', 'regar', 'glaçar', 'esfregar', 'empanar', 'temperar', 'lavar', 'secar', 'esfarelar'],
  ritmo: ['bater', 'mexer', 'misturar', 'dobrar(incorporar)', 'dobrar', 'emulsionar', 'sovar', 'moer', 'esmagar', 'amaciar', 'espremer', 'quebrar', 'abrir(frutos do mar)', 'abrir(rolo)', 'abrir(mãos)', 'laminar', 'esticar', 'prensar', 'torcer'],
  calor: ['aquecer', 'ferver', 'cozinhar-lento', 'pochê', 'vapor', 'fritar', 'saltear', 'grelhar', 'reduzir', 'caramelizar', 'branquear', 'escaldar', 'tostar', 'flambar', 'temperar-chocolate', 'assar', 'gratinar', 'assar-as-cegas', 'esterilizar', 'clarificar'],
  tempo: ['resfriar', 'congelar', 'descansar', 'fermentar', 'marinar', 'hidratar', 'deixar-de-molho', 'demolhar', 'descongelar', 'embeber', 'infusionar', 'armazenar'],
  verter: ['coar', 'peneirar', 'despejar', 'escumar', 'desengordurar', 'escorrer', 'mergulhar'],
  montar: ['montar', 'rechear', 'moldar', 'enrolar', 'amarrar', 'costurar', 'dobrar-folha', 'trançar', 'forrar', 'decorar', 'servir', 'desenformar', 'rechear-sob-pele', 'laminar(dobras)', 'selar', 'rolar', 'virar'],
  confeitar: ['confeitar(saco)', 'confeitar'],
  medir: ['medir', 'pesar'],
  testar: ['testar', 'inspecionar'],
  separar: ['separar'],
};
const acaoParaGesto = new Map();
for (const [g, lista] of Object.entries(GESTOS)) for (const a of lista) acaoParaGesto.set(a, g);

/** Variante de cada gesto, para o motor mudar o movimento pedido. */
function variante(acao, gesto, texto) {
  const t = texto.toLowerCase();
  switch (gesto) {
    case 'cortar':
      // faca deitada, paralela à tábua: borboleta, escalope, abrir na horizontal, filetar rente às costelas
      if (['cortar', 'fatiar', 'abrir'].includes(acao) && /corte horizontal|peito na horizontal|borboleta|faca (quase )?deitada|faca paralela|escalope|em duas camadas|ao meio na espessura|bolso/.test(t)) return 'deitado';
      if (acao === 'picar') return 'picar';
      if (acao === 'fatiar') return 'fatiar';
      if (acao === 'desossar' || acao === 'eviscerar' || acao === 'abrir') return 'contorno';
      if (acao === 'perfurar' || acao === 'lardear' || acao === 'marcar') return 'pontos';
      if (acao === 'descaroçar') return 'contorno';
      if (acao === 'rasgar' || acao === 'desfiar') return 'desfiar';
      if (/cubo|brunoise|dado|mirepoix|macedônia/.test(t)) return 'cubos';
      if (/julienne|palito|tira|chiffonade|bastonete/.test(t)) return 'tiras';
      return 'fatiar';
    case 'superficie':
      if (['descascar', 'escamar', 'raspar', 'ralar', 'esfarelar'].includes(acao)) return 'remover';
      if (['limpar', 'lavar', 'secar'].includes(acao)) return 'limpar';
      return 'cobrir';
    case 'ritmo':
      if (['bater', 'emulsionar'].includes(acao)) return 'circular-rapido';
      if (['mexer', 'misturar'].includes(acao)) return 'circular';
      if (['dobrar(incorporar)', 'dobrar'].includes(acao)) return 'dobrar';
      if (['sovar', 'abrir(rolo)', 'abrir(mãos)', 'laminar', 'esticar'].includes(acao)) return 'vaivem';
      if (['amaciar', 'quebrar'].includes(acao)) return 'golpes';
      return 'pressionar';
    case 'calor':
      if (['assar', 'gratinar', 'assar-as-cegas', 'tostar'].includes(acao) && !/frigideira|panela|wok/.test(t)) return 'forno';
      if (/\bforno\b/.test(t) && !/frigideira|wok|boca|fogo (alto|médio|baixo)/.test(t)) return 'forno';
      if (acao === 'grelhar' && /forno|salamandra/.test(t)) return 'forno';
      if (['fritar', 'saltear', 'caramelizar', 'flambar', 'tostar', 'grelhar'].includes(acao)) return 'frigideira';
      return 'panela';
    case 'tempo':
      if (['resfriar', 'congelar', 'descongelar', 'armazenar'].includes(acao) || /geladeira|congelador|gelo/.test(t)) return 'frio';
      if (acao === 'fermentar') return 'fermentar';
      return 'repouso';
    case 'verter':
      if (['escumar', 'desengordurar'].includes(acao)) return 'escumar';
      if (acao === 'peneirar') return 'peneirar';
      if (acao === 'mergulhar') return 'mergulhar';
      return 'despejar';
    case 'montar':
      if (['amarrar', 'costurar'].includes(acao)) return 'amarrar';
      if (['enrolar', 'rolar', 'trançar'].includes(acao)) return acao === 'trançar' ? 'trancar' : 'enrolar';
      if (['rechear', 'rechear-sob-pele'].includes(acao)) return 'rechear';
      if (['dobrar-folha', 'laminar(dobras)', 'selar'].includes(acao)) return 'dobrar';
      if (['decorar', 'servir'].includes(acao)) return 'decorar';
      if (['desenformar', 'virar'].includes(acao)) return 'virar';
      if (acao === 'forrar') return 'forrar';
      return 'moldar';
    case 'medir':
      return acao === 'pesar' ? 'balanca' : 'jarra';
    default:
      return acao;
  }
}

const num = (s) => parseFloat(s.replace(',', '.'));
/** Extrai a meta principal do parâmetro (temperatura tem prioridade, depois medida, depois tempo). */
function meta(texto) {
  const t = texto.replace(/(\d)\s*º/g, '$1°');
  const faixa = (re, unidade) => {
    const m = t.match(re);
    if (!m) return null;
    const a = num(m[1]);
    const b = m[2] ? num(m[2]) : undefined;
    return b && b > a ? { valor: a, max: b, unidade } : { valor: a, unidade };
  };
  const N = '(\\d+(?:[.,]\\d+)?)';
  const ATE = `(?:\\s*(?:a|e|-|ou)\\s*${N})?`;
  return (
    faixa(new RegExp(`${N}${ATE}\\s*°\\s*C`, 'i'), 'C') ||
    faixa(new RegExp(`${N}${ATE}\\s*mm\\b`, 'i'), 'mm') ||
    faixa(new RegExp(`${N}${ATE}\\s*cm\\b`, 'i'), 'cm') ||
    faixa(new RegExp(`${N}${ATE}\\s*(?:min|minutos?)\\b`, 'i'), 'min') ||
    faixa(new RegExp(`${N}${ATE}\\s*(?:h|horas?)\\b`, 'i'), 'h') ||
    faixa(new RegExp(`${N}${ATE}\\s*(?:s|segundos?)\\b`, 'i'), 's') ||
    faixa(new RegExp(`${N}${ATE}\\s*kg\\b`, 'i'), 'kg') ||
    faixa(new RegExp(`${N}${ATE}\\s*g\\b`, 'i'), 'g') ||
    faixa(new RegExp(`${N}${ATE}\\s*ml\\b`, 'i'), 'ml') ||
    faixa(new RegExp(`${N}${ATE}\\s*litros?\\b`, 'i'), 'l') ||
    undefined
  );
}

const BANCADAS = [
  { id: 'caldos', nome: 'Caldos e Sopas', cor: '#5fa8d3', teste: /^Caldos/ },
  { id: 'ovos', nome: 'Ovos, Queijos e Cremes', cor: '#f2d16b', teste: /^Ovos/ },
  { id: 'peixes', nome: 'Peixes e Frutos do Mar', cor: '#3d8eb9', teste: /^Peixes/ },
  { id: 'aves', nome: 'Aves', cor: '#d9a066', teste: /^Aves/ },
  { id: 'carnes', nome: 'Carnes', cor: '#c0504d', teste: /^Carnes/ },
  { id: 'legumes', nome: 'Legumes e Saladas', cor: '#6aa84f', teste: /^Legumes/ },
  { id: 'graos', nome: 'Grãos, Sementes e Castanhas', cor: '#b58b52', teste: /^Sementes/ },
  { id: 'massas', nome: 'Massas', cor: '#e8c170', teste: /^Massas/ },
  { id: 'molhos', nome: 'Molhos', cor: '#e07b39', teste: /^Molhos/ },
  { id: 'paes', nome: 'Pães', cor: '#c8955c', teste: /^Fazendo/ },
  { id: 'frutas', nome: 'Frutas', cor: '#e06666', teste: /^Frutas/ },
  { id: 'sobremesas', nome: 'Sobremesas', cor: '#c27ba0', teste: /^Sobremesas/ },
  { id: 'pastelaria', nome: 'Massas Doces e Folhadas', cor: '#f6b26b', teste: /^Pastelaria/ },
  { id: 'bolos', nome: 'Bolos e Biscoitos', cor: '#a64d79', teste: /^Bolos/ },
  { id: 'temperos', nome: 'Ervas e Temperos', cor: '#38761d', teste: /^Ervas/ },
];

const normal = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const semPlural = (w) => (w.length > 3 ? w.replace(/(oes|aes)$/, 'ao').replace(/(ns)$/, 'm').replace(/(es|s)$/, '') : w);
const chave = (s) => normal(s).split(' ').map(semPlural).join(' ');

const COBERTURA = /\b(azeite|oleo|manteiga|banha|gordura|sal|pimenta|acucar|farinha|mel|vinagre|molho|caldo|vinho|agua|leite|creme|gema|clara|ovo batido|glace|calda|geleia|marinada|tempero|especiaria|paprica|cominho|oregano|tomilho|alecrim|salsa|ervas?|alho picado|limao espremido|suco|fermento|amido|maisena|fuba|rosca|po)\b/;
function ehCobertura(id, nome) {
  const n = normal(`${id.replace(/[-_]/g, ' ')} ${nome}`);
  return COBERTURA.test(n);
}

function main() {
  const verificar = process.argv.includes('--verificar');
  const partes = fs.readdirSync(fonte).filter((f) => /^parte\d+\.json$/.test(f)).sort();
  const tecnicasBrutas = [];
  const alimentos = new Map();
  const tabelas = [];
  for (const f of partes) {
    const j = JSON.parse(fs.readFileSync(path.join(fonte, f), 'utf8'));
    tecnicasBrutas.push(...j.tecnicas);
    for (const a of j.alimentos ?? []) if (!alimentos.has(a.id)) alimentos.set(a.id, { id: a.id, nome: a.nome, forma: a.forma });
    tabelas.push(...(j.tabelas ?? []));
  }
  // alimentos que o levantamento não trouxe como peça, mas que as técnicas pedem (gengibre, sálvia, bacon...)
  const extras = path.join(raiz, 'dados', 'alimentos_extras.json');
  if (fs.existsSync(extras)) for (const a of JSON.parse(fs.readFileSync(extras, 'utf8'))) if (!alimentos.has(a.id)) alimentos.set(a.id, { id: a.id, nome: a.nome, forma: a.forma });
  // lotes de alimentos novos (um arquivo por grupo)
  const dirNovos = path.join(raiz, 'dados', 'alimentos_novos');
  if (fs.existsSync(dirNovos)) for (const f of fs.readdirSync(dirNovos).filter((x) => x.endsWith('.json')).sort()) for (const a of JSON.parse(fs.readFileSync(path.join(dirNovos, f), 'utf8'))) if (!alimentos.has(a.id)) alimentos.set(a.id, { id: a.id, nome: a.nome, forma: a.forma });

  // palavras soltas que não identificam um alimento sozinhas
  const GENERICAS_FORTES = new Set(['barriga', 'perna', 'peito', 'lombo', 'costela', 'paleta', 'asa', 'coxa', 'file', 'carne', 'peixe', 'osso', 'pele', 'cabeca', 'pe', 'furcula', 'carcaca', 'miolo']);
  // índice de alimentos por chave normalizada (nome e partes do nome antes de parênteses)
  const indice = [];
  for (const a of alimentos.values()) {
    const nomes = new Set([a.nome, a.nome.split('(')[0], a.nome.split(',')[0], a.id.replace(/[-_]/g, ' ')]);
    for (const n of nomes) {
      const k = chave(n);
      if (k.length >= 3 && !(GENERICAS_FORTES.has(k))) indice.push({ k, id: a.id });
    }
  }
  indice.sort((a, b) => b.k.length - a.k.length);
  // a primeira palavra do nome só vale quando é inequívoca (uma única comida começa com ela)
  // e não é palavra genérica: "filé", "carne", "barriga" não podem virar filé-mignon ou barriga de porco
  const GENERICAS = new Set(['peixe', 'carne', 'file', 'barriga', 'concha', 'musse', 'molho', 'massa', 'folha', 'caldo', 'creme', 'pao', 'bolo', 'torta', 'pasta', 'cabeca', 'perna', 'peito', 'lombo', 'costela', 'paleta', 'pe', 'asa', 'coxa', 'osso', 'miolo', 'polpa', 'casca', 'suco', 'calda', 'fruta', 'legume', 'erva', 'sementes', 'graos', 'po', 'oleo', 'vinho', 'agua']);
  const contagem = new Map();
  for (const a of alimentos.values()) {
    const w = chave(a.nome.split(/[ ,(-]/)[0]);
    contagem.set(w, [...(contagem.get(w) ?? []), a.id]);
  }
  const fracos = [];
  for (const [w, lista] of contagem) if (w.length >= 4 && lista.length === 1 && !GENERICAS.has(w) && !indice.some((e) => e.k === w)) fracos.push({ k: w, id: lista[0] });
  // apelidos de peças genéricas, para o texto do livro virar uma peça de verdade
  // [expressão, id, bancadas onde vale (vazio = todas), capítulo que precisa casar]
  const APELIDOS = [
    [/\b(peixes? chatos?|linguados?|solha)\b/, 'linguado', []],
    [/\b(file|files|filetes?|posta|postas|manta|mantas|lombo) de peixe\b/, 'salmao', []],
    [/\bpeixes?\b/, 'truta', []],
    [/\bpernas?\b/, 'perna-de-cordeiro', ['carnes'], /cordeiro/i],
    [/\bpaleta\b/, 'paleta-de-cordeiro', ['carnes'], /cordeiro/i],
    [/\bpernas?\b/, 'pernil', ['carnes'], /porco/i],
    // cortes ditos de forma genérica, pelo capítulo
    [/\bcarres?\b/, 'carre-de-cordeiro', ['carnes']],
    [/\bnoisettes?\b/, 'noisette-de-cordeiro', ['carnes']],
    [/\bcosteletas?\b/, 'costeleta-de-cordeiro', ['carnes'], /cordeiro/i],
    [/\bcosteletas?\b/, 'costeleta-de-porco', ['carnes'], /porco/i],
    [/\bcosteletas?\b/, 'costeleta-de-vitela', ['carnes'], /vitela|bovin/i],
    [/\bcostelas?\b/, 'costela-bovina', ['carnes'], /bovin/i],
    [/\b(files?|lombo)\b/, 'file-de-porco', ['carnes'], /porco/i],
    [/\b(files?|bifes?)\b/, 'file-mignon', ['carnes'], /bovin|vitela/i],
    [/\bsebo\b/, 'sebo-de-rim', ['carnes']],
    [/\b(carne|peca|pecas|cubos|assado)\b/, 'lombo-de-cordeiro', ['carnes'], /cordeiro/i],
    [/\b(carne|peca|pecas|cubos|assado)\b/, 'lombo-de-porco', ['carnes'], /porco/i],
    [/\b(carne|peca|pecas|cubos|assado)\b/, 'contrafile', ['carnes'], /bovin|vitela/i],
    [/\b(ave|aves|frango|galinha) (inteir[oa]s?|pequen[oa]s?)\b/, 'frango-inteiro', ['aves']],
    [/\bpeitos?( de (frango|ave|peru))?\b/, 'peito-de-frango', ['aves']],
    [/\b(coxas?|pernas?|sobrecoxas?)( de (frango|ave))?\b/, 'perna-de-frango', ['aves']],
    [/\basas?\b/, 'asa-de-frango', ['aves']],
    [/\b(aves?|frangos?)\b/, 'frango-inteiro', ['aves']],
  ].filter(([, id]) => alimentos.has(id));
  const reconhecer = (texto) => {
    const k = ' ' + chave(texto) + ' ';
    for (const e of indice) if (k.includes(' ' + e.k + ' ')) return e.id;
    return undefined;
  };
  const reconhecerFraco = (texto, bancada = '', capitulo = '') => {
    const k = ' ' + chave(texto) + ' ';
    for (const e of fracos) if (k.includes(' ' + e.k + ' ')) return e.id;
    const n = normal(texto);
    for (const [re, id, onde, cap] of APELIDOS) {
      if (onde.length && !onde.includes(bancada)) continue;
      if (cap && !cap.test(capitulo + ' ' + texto)) continue;
      if (re.test(n)) return id;
    }
    return undefined;
  };
  /** Partes de uma peça: o passo continua trabalhando a mesma peça do passo anterior. */
  const PARTES = /\b(furcula|pernas?|barriga|cabeca|rabo|cauda|pele|espinhas?|guelras?|costas|nadadeiras?|escamas|visceras|carne|files?|filetes?|peito|coxas?|osso|ossos|carcaca|pescoco|asas?|juntas?|tendoes|gordura|membrana|lado|lados|outro lado|metades?|pedacos?|peca|pecas|centro|ponta|pontas|bolso|cavidade|interior|superficie|corte|cortes|fatias?|tiras?|cubos?)\b/;

  const ids = new Set();
  const problemas = [];
  const tecnicas = tecnicasBrutas.map((t) => {
    if (ids.has(t.id)) problemas.push(`id repetido: ${t.id}`);
    ids.add(t.id);
    const bancada = BANCADAS.find((b) => b.teste.test(t.capitulo));
    if (!bancada) problemas.push(`capítulo sem bancada: ${t.capitulo}`);
    const alim = [...new Set(t.ingredientes.map((x) => reconhecer(x) ?? reconhecerFraco(x, bancada?.id, t.capitulo + ' ' + t.nome)).filter(Boolean))];
    // a peça principal é o primeiro ingrediente que não é tempero, gordura ou líquido de cobertura
    // nas bancadas de proteína, a principal é a ave, a carne ou o peixe (não a erva do tempero)
    const PROTEINA = { aves: /frango|galinha|pato|peru|codorna|faisao|ganso|pombo|perdiz|ave|coelho/, carnes: /bovin|vitela|porco|cordeiro|carne|file|lombo|pernil|costel|carre|alcatra|contrafile|paleta|perna|noisette|linguica|toucinho|bacon|presunto|figado|rim|coracao|lingua|miolo|rabada|moida|bife/, peixes: /truta|salmao|linguado|sardinha|bacalhau|peixe|cavala|arenque|robalo|tainha|merluza|atum|lagosta|camarao|caranguejo|mexilhao|ostra|vieira|lula|polvo|lagostim|ameijoa|buzio|enguia|carpa|vermelho|hadoque/ }[bancada?.id ?? ''];
    const naoCobertura = alim.filter((id) => !ehCobertura(id, alimentos.get(id)?.nome ?? ''));
    const principal = (PROTEINA && naoCobertura.find((id) => PROTEINA.test(id))) ?? naoCobertura[0] ?? alim[0];
    let anterior = principal;
    const passos = t.passos.map((p) => {
      const acao = p.acao.trim();
      let gesto = acaoParaGesto.get(acao);
      if (!gesto) {
        problemas.push(`ação sem gesto: ${acao} (${t.id})`);
        gesto = 'montar';
      }
      const texto = `${p.alvo} ${p.utensilio} ${p.parametro}`;
      const passo = {
        acao,
        gesto,
        variante: variante(acao, gesto, texto),
        alvo: p.alvo,
        utensilio: p.utensilio,
        parametro: p.parametro,
      };
      const m = meta(p.parametro || '');
      if (m) passo.meta = m;
      const cob = (id) => !!id && ehCobertura(id, alimentos.get(id)?.nome ?? '');
      const solido = gesto === 'superficie' || gesto === 'cortar' || gesto === 'montar' || gesto === 'separar';
      // nome completo no alvo vale sempre; parte de peça segue a peça anterior; só então os apelidos
      const forte = reconhecer(p.alvo);
      const r = forte ?? (PARTES.test(normal(p.alvo)) && anterior ? anterior : reconhecerFraco(p.alvo, bancada?.id, t.capitulo + ' ' + t.nome));
      // pincelar, regar, temperar: o que se reconhece no alvo é a cobertura, não a peça
      const a = solido ? [r, anterior, principal].find((x) => x && !cob(x)) : r ?? anterior ?? principal;
      if (a) {
        passo.alimento = a;
        if (!cob(a)) anterior = a;
      }
      return passo;
    });
    return {
      id: t.id,
      capitulo: t.capitulo,
      bancada: bancada?.id ?? 'temperos',
      nome: t.nome,
      ingredientes: t.ingredientes,
      alimentos: alim,
      utensilios: t.utensilios,
      passos,
      ponto_critico: t.ponto_critico,
      erro_comum: t.erro_comum,
    };
  });

  // composição revisada à mão: peça, o que se adiciona, meio, perguntas de inspeção e prato
  const dirComp = path.join(raiz, 'dados', 'composicao');
  const comp = {};
  if (fs.existsSync(dirComp)) {
    for (const f of fs.readdirSync(dirComp).filter((x) => /^parte\d+\.json$/.test(x)).sort()) Object.assign(comp, JSON.parse(fs.readFileSync(path.join(dirComp, f), 'utf8')));
  }
  const VARIANTES_CORTE = new Set(['fatiar', 'tiras', 'cubos', 'picar', 'deitado', 'contorno', 'pontos', 'aparar', 'desfiar']);
  const PREPARO = /^(recipiente|monte|pasta)$/;
  let aplicadas = 0;
  for (const t of tecnicas) {
    const c = comp[t.id];
    if (!c) continue;
    if (!Array.isArray(c.passos) || c.passos.length !== t.passos.length) {
      problemas.push(`composição com ${c.passos?.length} passos para ${t.passos.length}: ${t.id}`);
      continue;
    }
    aplicadas++;
    c.passos.forEach((cp, i) => {
      const p = t.passos[i];
      const valido = (id) => {
        if (!alimentos.has(id)) {
          problemas.push(`id de alimento inexistente "${id}" em ${t.id} passo ${i + 1}`);
          return false;
        }
        return true;
      };
      if ('alimento' in cp) {
        if (cp.alimento === null) delete p.alimento;
        else if (valido(cp.alimento)) p.alimento = cp.alimento;
      }
      if (cp.adicionar?.length) p.adicionar = cp.adicionar.filter(valido);
      for (const k of ['meio', 'recipiente', 'pergunta', 'explicacao']) if (typeof cp[k] === 'string' && cp[k]) p[k] = cp[k];
      // ficha de cena do passo: estado e ponto da peça, utensílio na mão
      if (cp.estado) {
        if (['inteiro', 'metades', 'fatias', 'tiras', 'cubos', 'picado'].includes(cp.estado)) p.estadoPeca = cp.estado;
        else problemas.push(`estado de peça desconhecido "${cp.estado}" em ${t.id} passo ${i + 1}`);
      }
      if (cp.ponto) {
        if (['cru', 'cozido', 'dourado', 'tostado'].includes(cp.ponto)) p.ponto = cp.ponto;
        else problemas.push(`ponto desconhecido "${cp.ponto}" em ${t.id} passo ${i + 1}`);
      }
      if (typeof cp.utensilio === 'string' && cp.utensilio) p.utensilio = cp.utensilio;
      if (Array.isArray(cp.opcoes) && cp.opcoes.length >= 2) {
        p.opcoes = cp.opcoes;
        p.correta = Math.max(0, Math.min(cp.opcoes.length - 1, cp.correta ?? 0));
      }
      if (Array.isArray(cp.objetos)) p.objetos = cp.objetos;
      if (cp.cheirar) p.cheirar = true;
      if (cp.corte && p.gesto === 'cortar' && VARIANTES_CORTE.has(cp.corte)) p.variante = cp.corte;
    });
    if (c.prato) {
      const pr = {};
      if (c.prato.principal && alimentos.has(c.prato.principal)) pr.principal = c.prato.principal;
      if (Array.isArray(c.prato.acompanhamentos)) pr.acompanhamentos = c.prato.acompanhamentos.filter((id) => alimentos.has(id)).slice(0, 3);
      if (['prato', 'tigela', 'travessa', 'taca', 'tabua', 'tigelinha', 'ramequim', 'xicara', 'molheira', 'pote', 'cumbuca', 'copo'].includes(c.prato.servir)) pr.servir = c.prato.servir;
      else if (c.prato.servir) problemas.push(`louça desconhecida "${c.prato.servir}" em ${t.id}`);
      if (['inteiro', 'fatias', 'medalhoes', 'tiras', 'cubos', 'pedacos', 'ralado', 'lascas', 'desfiado'].includes(c.prato.forma)) pr.forma = c.prato.forma;
      else if (c.prato.forma) problemas.push(`forma desconhecida "${c.prato.forma}" em ${t.id}`);
      if (['cru', 'cozido', 'dourado', 'tostado'].includes(c.prato.estado)) pr.estado = c.prato.estado;
      else if (c.prato.estado) problemas.push(`estado desconhecido "${c.prato.estado}" em ${t.id}`);
      if (Number.isInteger(c.prato.quantidade) && c.prato.quantidade > 1) pr.quantidade = Math.min(12, c.prato.quantidade);
      if (typeof c.prato.liquido === 'string' && /^#[0-9a-f]{6}$/i.test(c.prato.liquido)) pr.liquido = c.prato.liquido;
      else if (c.prato.liquido) problemas.push(`cor de líquido inválida "${c.prato.liquido}" em ${t.id}`);
      if (c.prato.claro) pr.claro = true;
      if (c.prato.granulado) pr.granulado = true;
      if (c.prato.textura === 'po' || c.prato.textura === 'picos') pr.textura = c.prato.textura;
      else if (c.prato.textura) problemas.push(`textura desconhecida "${c.prato.textura}" em ${t.id}`);
      t.prato = pr;
    }
  }
  void PREPARO;
  if (Object.keys(comp).length) console.log(`composição revisada aplicada em ${aplicadas} técnicas`);

  const texto = JSON.stringify(tecnicas);
  if (/[\u2013\u2014]/.test(texto)) problemas.push('travessão encontrado no catálogo');
  for (const t of tecnicas) if (!t.passos.length) problemas.push(`técnica sem passos: ${t.id}`);

  const catalogo = {
    bancadas: BANCADAS.map(({ teste, ...b }) => ({ ...b, capitulos: [...new Set(tecnicas.filter((t) => t.bancada === b.id).map((t) => t.capitulo))] })),
    tecnicas,
    alimentos: [...alimentos.values()],
    tabelas,
  };

  if (problemas.length) {
    console.error(problemas.join('\n'));
    process.exit(1);
  }
  const semAlimento = tecnicas.filter((t) => !t.alimentos.length).length;
  const comMeta = tecnicas.reduce((s, t) => s + t.passos.filter((p) => p.meta).length, 0);
  const totalPassos = tecnicas.reduce((s, t) => s + t.passos.length, 0);
  console.log(`catálogo: ${tecnicas.length} técnicas, ${totalPassos} passos (${comMeta} com meta), ${alimentos.size} alimentos, ${semAlimento} técnicas sem alimento reconhecido`);
  if (!verificar) {
    fs.mkdirSync(path.dirname(saida), { recursive: true });
    fs.writeFileSync(saida, JSON.stringify(catalogo));
  }
}

main();
