# OpenBlast NBR 9653 | GitHub Pages

Projeto estático para ler múltiplos CSVs de sismogramas no navegador e gerar:

1. Gráfico de pressão sonora conforme ABNT NBR 9653:2018
2. Gráfico de vibração conforme referência visual da NBR 9653:2018
3. Gráfico adicional de vibração com eixos lineares partindo de zero
4. Tabela consolidada dos eventos
5. Exportação dos gráficos em SVG/PNG
6. Exportação do resumo em CSV

## Como usar localmente

Abra `index.html` no navegador e suba os arquivos `.csv`.

O processamento é local. Os arquivos não são enviados para servidor.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub
2. Envie todos os arquivos deste projeto para a branch `main`
3. Abra `Settings > Pages`
4. Em `Build and deployment`, selecione:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Salve
6. Acesse a URL gerada pelo GitHub Pages

## Estrutura

```text
openblast-nbr9653-github-pages/
├── index.html
├── styles.css
├── app.js
├── .nojekyll
├── assets/
│   └── logo-openblast.png
├── sample/
│   └── mini-sismograma.csv
└── codex-prompt.md
```

## Modelo de CSV suportado

O parser foi feito para o padrão exportado pelo Micromate/Instantel em CSV, com metadados como:

```text
"EventDate","2026-06-10"
"EventTime","11:56:39"
"TitleString1","COMUNIDADE DE LAGOA DO MEL"
"GpsDistance","1450.5 m"
"TranPPV","0.662 mm/s"
"VertPPV","0.567 mm/s"
"LongPPV","0.465 mm/s"
"TranZCFreq","23.3 Hz"
"VertZCFreq","32.0 Hz"
"LongZCFreq","28.4 Hz"
"MicPSPL","114.6 dB(L)"
"Tran","Vert","Long","MicL"
```

Se algum PPV, PSPL ou PVS não vier nos metadados, o sistema tenta calcular a partir da forma de onda.

## Observação técnica

A curva de vibração foi implementada com os pontos de referência visual:

- 4 Hz / 15 mm/s
- 15 Hz / 20 mm/s
- 40 Hz / 50 mm/s
- acima de 40 Hz / 50 mm/s

Abaixo de 4 Hz, o status usa 15 mm/s como verificação conservadora.
