# Gestão Financeira Pessoal

Aplicação principal construída com HTML + CSS + JavaScript puro (ES Modules), servida como site estático via `index.html`. Todo o código relevante está em `assets/`.

## Visão Geral
- Linguagem: JavaScript puro com módulos (`<script type="module">`).
- Estilos: `assets/css/styles.css`.
- Lógica e UI: `assets/js/app.js` (renderizações, gráficos, interações, estado local).
- Roteamento: `assets/js/main.js` (hash-based: `#/auth`, `#/dashboard`, etc.).
- Páginas: `assets/js/pages/` (cada página delega renderização para o app).
- Serviços: `assets/js/services/` (integrações opcionais com Supabase e modo offline via `localStorage`).
- Ambiente: `assets/js/env.js` mescla `window.__ENV` e `.env`/`env.local.js` quando presentes.

## Como Rodar
- Opção Node (dev):
  - `node dev-server.js` → abre em `http://localhost:5500/`.
- Opção Node (preview):
  - `node preview-server.js` → abre em `http://localhost:8080/` (ou `PORT=9000 node preview-server.js`).
- Opção PowerShell (Windows):
  - `powershell -ExecutionPolicy Bypass -File server.ps1 -Port 8080` → abre em `http://127.0.0.1:8080/`.

Qualquer servidor estático funciona (basta servir `index.html` na raiz).

## Estrutura
```
D:\Gestão
├── assets
│   ├── css\styles.css
│   ├── js
│   │   ├── app.js                 # lógica da UI e gráficos
│   │   ├── main.js                # inicialização e navegação
│   │   ├── core\*.js              # utilitários (ex.: supabaseClient)
│   │   ├── pages\*.js             # páginas
│   │   └── services\*.js          # serviços (Supabase, caches, sync)
├── index.html                      # layout e marcação
├── dev-server.js                   # servidor de desenvolvimento (Node)
├── preview-server.js               # servidor estático simples (Node)
├── server.ps1                      # servidor estático (PowerShell)
└── service-worker.js               # PWA
```

## Dashboard e Gráficos
- Resumo: `#summary-income`, `#summary-expense`, `#summary-balance`.
- Meta mensal: barra de progresso com gradiente por categorias do mês.
- Gráficos (canvas):
  - `canvas#bar-income-vs-expense` (“Gastos vs Meta — últimos 6 meses”).
    - Pares de barras (meta x gasto) por mês, com spacing ajustado para barras mais próximas dentro do par.
    - Tooltip interativo por par (desktop: hover; mobile: toque/click) com posicionamento e largura dinâmica.
    - Ajuste mobile: `margin-bottom` aumentado para evitar sobreposição com botão flutuante.
    - Layout: no desktop, o card desta seção ocupa largura total usando classe específica.
  - `canvas#pie-expenses-by-category` (“Despesas por Categoria”).
    - Tooltip mostra “Categoria: valor” e “percentual do gasto total do mês (1 casa)”.
    - Base do percentual: total de despesas do mês (não usa meta).
  - `canvas#pie-expenses-by-bank` (“Despesas por Banco”).
    - Tooltip mostra “Banco: valor” e “percentual do gasto total do mês (1 casa)”.
    - Base do percentual: total de despesas do mês (não usa meta).

### Responsividade e Layout
- Mobile-first; cards empilhados em telas pequenas com largura consistente e `shadow-sm`.
- Desktop:
  - Card “Gastos vs Meta” ocupa a largura total do grid (`.dashboard-grid-charts .chart-card-income-expense { grid-column: 1 / -1; }`).
  - Os dois gráficos de pizza permanecem lado a lado, respeitando `gap` e sombras.
- Evita sobreposição com botão flutuante no mobile via `margin-bottom` específico do `canvas#bar-income-vs-expense`.

### Interações e Tooltips
- Tooltip único `#chart-tooltip` reaproveitado por todos os gráficos.
- Posicionamento `position: fixed`, `pointer-events: none`, `z-index: 1000` para não bloquear toques.
- Desktop ativa hover; mobile ativa toque/click; tocar fora fecha.

## Configuração de Ambiente (Supabase opcional)
- Exemplos: `assets/js/env.local.example.js` e `.env.example`.
- Em produção, defina `window.__ENV` ou sirva `.env` para `assets/js/env.js` ler valores.
- Serviços em `assets/js/services/` fazem leitura/gravação local e sincronizam com Supabase quando habilitado.

## Decisões Recentes e Ajustes
- “Gastos vs Meta”
  - Gap interno entre barras reduzido para melhorar leitura sem alterar espaçamento entre pares.
  - Incremento do `margin-bottom` no mobile do canvas para não colidir com FAB.
  - Card configurado para ocupar largura total no desktop mantendo `shadow-sm` e margens existentes.
- “Despesas por Categoria” e “Despesas por Banco”
  - Tooltips com valor e percentual relativo ao gasto total do mês.
  - Detecção de segmento por raio/ângulo com suporte a hover/touch.
- Tooltip unificado
  - Evita interceptar toques (`pointer-events: none`) e calcula melhor orientação/largura.

## Desenvolvimento
- CSS e UI mobile-first; media queries para desktop.
- Drawer e overlay de navegação otimizados para toque.
- Serviços possuem modo offline-first com sincronização quando a rede volta.

## Próximos Passos Sugeridos
- Documentar convenções de código e CSS, e fluxo de contribuição.
- Adicionar testes de fumaça para renderizações críticas.
- Opcional: destacar visualmente o segmento selecionado nas pizzas (stroke/realce) e incluir o mês no conteúdo do tooltip.
