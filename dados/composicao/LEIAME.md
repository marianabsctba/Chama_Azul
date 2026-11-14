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

- `prato.principal`: id do que vai ao prato no fim. `prato.acompanhamentos`: até 3 ids. `prato.servir`: `"prato"`, `"tigela"`, `"travessa"`, `"taca"` ou `"tabua"`.
