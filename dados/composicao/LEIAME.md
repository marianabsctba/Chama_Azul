# Composição das técnicas

Arquivos `parte1.json` a `parte4.json`: para cada técnica, o que aparece em cena em cada passo. O `ferramentas/catalogo.mjs` aplica estes dados por cima do levantamento e valida tudo.

Formato (as chaves são ids de técnica; `passos` tem exatamente o mesmo número e a mesma ordem dos passos da técnica):

```json
{
  "peixes.sushi-rolo": {
    "passos": [
      { "alimento": "atum" },
      { "alimento": "alga-nori" },
      { "alimento": "alga-nori", "adicionar": ["arroz_japones"] },
      { "alimento": "alga-nori", "adicionar": ["wasabi", "atum"] },
      { "alimento": "alga-nori" },
      { "alimento": "alga-nori" },
      { "alimento": "alga-nori" },
      { "alimento": "alga-nori" },
      { "alimento": "alga-nori", "adicionar": ["gengibre", "pepino"] }
    ],
    "prato": { "principal": "alga-nori", "acompanhamentos": ["gengibre", "pepino"], "servir": "prato" }
  }
}
```

Campos de cada passo (todos opcionais):

- `alimento`: id da peça sólida trabalhada no passo (a que se corta, se tempera, vai ao fogo, se monta). `null` quando o passo trata só de um líquido ou preparo de tigela (caldo, molho, massa mole, claras).
- `adicionar`: ids que entram neste passo e ficam sobre ou dentro da peça (recheio, cobertura, guarnição, tiras arrumadas). Aparecem pequenos sobre a peça e seguem com ela até o prato.
- `meio`: o líquido ou gordura do recipiente, em texto curto (`"azeite"`, `"óleo"`, `"manteiga"`, `"água"`, `"caldo"`, `"leite"`, `"calda de açúcar"`, `"vinho"`). Nunca vira peça.
- `recipiente`: texto do recipiente quando importa (`"frigideira"`, `"wok"`, `"panela"`, `"assadeira"`, `"tigela"`, `"esteira de bambu"`).
- Só em passos de inspecionar ou testar: `pergunta`, `opcoes` (3 frases curtas), `correta` (índice 0 a 2), `explicacao` (uma frase) e `objetos` (lista entre `"embalagem"`, `"termometro"`, `"palito"`, `"copo-agua"`, `"faca"`, `"garfo"`, `"colher"`), e `cheirar: true` quando o teste é pelo cheiro.

Campos da técnica:

- `prato.principal`: id do que vai ao prato no fim. Omitido quando o resultado é só líquido, molho ou pasta.
- `prato.acompanhamentos`: até 3 ids, só o que o livro serve junto. Nada de guarnição que o livro não pede.
- `prato.servir`: a louça. `"prato"`, `"travessa"` (peça grande inteira), `"tigela"` (sopa e caldo encorpado), `"taca"`, `"tabua"` (técnica que não é prato: avaliar, escolher, guardar, conservar, e pães e queijos), `"tigelinha"` (pasta, molho frio, tempero, creme), `"ramequim"` (creme assado, suflê, manteiga), `"xicara"` (caldo claro e consomê), `"molheira"` (molho quente), `"pote"` (conserva, marinada, guardar em vidro), `"cumbuca"` (gratinado individual, sopa de cebola) ou `"copo"` (massa líquida, bebida, infusão).
- `prato.forma`: como o principal aparece. `"inteiro"`, `"fatias"` (em leque), `"medalhoes"`, `"tiras"`, `"cubos"`, `"pedacos"`, `"ralado"`, `"lascas"` ou `"desfiado"`.
- `prato.estado`: o ponto do principal. `"cru"`, `"cozido"` (pochê, cozido, vapor), `"dourado"` (frito, grelhado, assado, salteado) ou `"tostado"`.
- `prato.quantidade`: quantas unidades do principal vão à louça (de 2 a 12), quando o livro faz várias (crêpes, bolinhos, quenelles).
- `prato.liquido`: cor `"#rrggbb"` do líquido, molho ou pasta que enche a louça.
- `prato.claro`: `true` para líquido translúcido (caldo claro, consomê, calda).
- `prato.granulado`: `true` para pasta com grão aparente (pesto no pilão, tapenade).
