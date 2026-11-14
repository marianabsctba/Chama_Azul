# Chama Azul

Uma cozinha-escola em 3D, em primeira pessoa, para relaxar e praticar técnicas de cozinha, uma por uma.

**Jogar:** https://marianabsctba.github.io/Chama_Azul/

Você anda por uma cozinha azul de azulejos portugueses, com chuva na janela e música calma, escolhe uma técnica no caderno e executa cada passo com as próprias mãos: risca o corte sobre a guia, passa o descascador, bate as claras na batedeira, regula a chama com o termômetro na mão, despeja num fio constante, confeita com o saco.

## O que tem

- **974 técnicas** em 15 bancadas: caldos e sopas, ovos e queijos, peixes e frutos do mar, aves, carnes, legumes, grãos, massas, molhos, pães, frutas, sobremesas, massas doces e folhadas, bolos e biscoitos, ervas e temperos.
- **3.767 passos**, cada um ligado a um de 11 gestos: faca, superfície, ritmo, calor, tempo, verter, montagem, confeitar, medida, olho de chef e separar.
- **Tudo em 3D gerado por código**: a cozinha, 520 alimentos, 155 famílias de utensílios, cortes de verdade (a peça se divide e mostra o miolo), casca que sai onde o descascador passa, cozimento que doura a peça.
- **O tempo como quarta dimensão**: no fogo, no forno e no descanso, segure Espaço para acelerar o relógio da cozinha. Um caldo de três horas passa em segundos.
- **Ponto pelo termômetro**: temperaturas de fritura, pontos do açúcar, temperagem do chocolate e temperatura interna das carnes seguem as tabelas clássicas.
- **Modo Zen** (padrão, sem pressa e sem erro que estrague) e **Modo Prova** (precisão vale estrelas).
- Som sintetizado na hora: chuva, acordes calmos, faca na tábua, fervura, fritura.
- Progresso salvo no navegador. `?tecnica=<id>` abre direto uma técnica.

## Controles

| Onde | Como |
|---|---|
| Andar | clique para olhar com o mouse, WASD para andar, Shift para correr, Esc solta o mouse |
| Caderno | clique no caderno do púlpito ou aperte C |
| Trabalhar | o mouse vira a mão; cada passo explica o gesto na parte de baixo da tela |
| Fogo e forno | roda do mouse, ou Q e E |
| Tempo | segure Espaço para acelerar |
| Celular e tablet | joystick para andar, arraste o dedo para olhar, botão Caderno; no trabalho, o dedo é a mão, os botões − e + regulam fogo, forno e timer, ⏩ acelera o tempo e dois dedos de lado giram a peça |

## Rodar localmente

```bash
npm install
npm run dev
```

## Testes

```bash
npm run teste
```

Além dos testes de catálogo, alimentos e utensílios, um robô joga as 974 técnicas do começo ao fim (sem navegador) e todas precisam terminar sem erro. O GitHub Actions roda os testes antes de cada publicação.

## Como é feito

- Three.js, TypeScript e Vite, publicado no GitHub Pages.
- `dados/fonte/`: o levantamento das técnicas, com texto próprio.
- `ferramentas/catalogo.mjs`: junta o levantamento, liga cada passo a um gesto e extrai temperaturas, tempos e medidas.
- `src/cena/`: a cozinha. `src/modelos/`: alimentos e utensílios. `src/pecas/`: peça cortável, conteúdo de recipiente, partículas. `src/gestos/`: os 11 gestos. `src/missao.ts`: a técnica passo a passo.

## Licença

MIT
