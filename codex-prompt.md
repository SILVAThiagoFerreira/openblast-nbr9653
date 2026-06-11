Você está trabalhando em um projeto estático para GitHub Pages chamado OpenBlast NBR 9653.

Objetivo:
- Manter um site estático em HTML, CSS e JavaScript puro
- Permitir upload de múltiplos CSVs de sismogramas Micromate/Instantel
- Gerar gráficos ABNT NBR 9653:2018:
  1. Pressão sonora com limite de 134 dB
  2. Vibração normativa com eixo X logarítmico e curva 4 Hz/15 mm/s, 15 Hz/20 mm/s, 40 Hz/50 mm/s, >40 Hz/50 mm/s
  3. Vibração personalizada com eixos X e Y lineares partindo de zero
- Usar tema clean corporativo, fundo branco, estilo consultoria, com logo pequeno no canto
- Não usar backend
- Não enviar CSVs para servidor
- Manter compatibilidade com GitHub Pages
- Priorizar SVG nativo, sem dependência pesada

Arquivos principais:
- index.html
- styles.css
- app.js
- assets/logo-openblast.png

Tarefas futuras possíveis:
- Melhorar responsividade
- Adicionar exportação em PDF
- Adicionar leitura de coordenadas UTM/lat-long
- Adicionar gráfico de forma de onda por canal
- Adicionar validação de calibração por data
- Adicionar importação de pasta inteira de CSVs
