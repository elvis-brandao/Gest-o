# Gestão Financeira Pessoal (Projeto Principal)

Este repositório contém a aplicação principal construída com HTML + CSS + JavaScript puro. Não utiliza TypeScript, React ou Vite. Todo o código relevante está em `assets/` e é carregado diretamente por `index.html`.

## Visão Geral
- Linguagem: JavaScript puro (ES Modules via `<script type="module">`).
- Estilos: `assets/css/styles.css`.
- Lógica e UI: `assets/js/app.js`.
- Roteamento: `assets/js/main.js` + `assets/js/core/router.js` (hash-based: `#/auth`, `#/dashboard`, etc.).
- Páginas: `assets/js/pages/` (cada página exporta `mount()` que apenas delega para `window.App.showPage`).
- Serviços: `assets/js/services/` (integrações opcionais com Supabase; funcionam com fallback localStorage quando desativado).

## Como Rodar
1. No Windows, use o script PowerShell:
   - `powershell -ExecutionPolicy Bypass -File server.ps1 -p 8080`
2. Acesse:
   - `http://localhost:8080/#/dashboard` para o dashboard
   - `http://localhost:8080/#/auth` para autenticação

> Observação: o projeto também pode ser servido por qualquer servidor estático. O `server.ps1` facilita no Windows.

## Estrutura de Pastas (principal)
```
D:\Gestão
├── assets
│   ├── css\styles.css          # estilos globais
│   ├── js
│   │   ├── app.js               # lógica da UI e renderizações
│   │   ├── core\router.js       # roteador por hash
│   │   ├── main.js              # inicialização e navegação
│   │   ├── pages\*.js           # mounts por página
│   │   └── services\*.js        # serviços (Supabase, etc.)
├── index.html                   # layout e marcação das páginas
├── server.ps1                   # servidor estático (Windows)
└── service-worker.js            # PWA
```

## Dashboard
O conteúdo do dashboard está todo definido em `index.html` e renderizado por `assets/js/app.js`.
- Resumo no header: `#summary-income`, `#summary-expense`, `#summary-balance`.
- Meta mensal: barra de progresso com segmentos por categoria.
- Gráficos:
  - `canvas#bar-income-vs-expense` (Receitas vs Despesas)
  - `canvas#pie-expenses-by-category` (Pizza por categoria)
  - `canvas#pie-expenses-by-bank` (Pizza por banco)
  - `canvas#bar-category-goal-progress` + `#bar-category-goal-progress-note` (Progresso por categoria)

## Autenticação
- A UI de login/cadastro é exibida somente em `#/auth`.
- Regra de CSS garante que o login não aparece no dashboard:
  - `body.auth-mode #page-auth { display: block; }`.
- `assets/js/app.js` controla `auth-mode` para esconder sidebar/header durante autenticação.

## Supabase (Opcional)
- Variáveis de ambiente: `assets/js/env.local.js` (não versionado; exemplo em `assets/js/env.local.example.js`).
- Quando habilitado, serviços em `assets/js/services/` fazem hidratação e persistência remota; caso contrário, o app usa `localStorage`.

## Desenvolvimento
- Estilos e UI seguem abordagem mobile-first com responsividade via CSS.
- Drawer/menu hambúrguer funciona no mobile com `div.drawer-overlay` e classes `sidebar.open`.
- O roteador marca links ativos e mantém o título da página em `#page-title`.

## Limpeza do Repositório
Para eliminar confusão, a pasta `dash/` (projeto React/TypeScript isolado) foi removida. Ela não era utilizada pelo app principal.

## Remoções Efetuadas
Para tornar o repositório consistente e fácil de entender, estes itens foram removidos por completo:
- Pasta `dash/` inteira (projeto React/TypeScript com Vite).
- Arquivos de configuração e pacote: `dash/package.json`, `dash/package-lock.json`, `dash/vite.config.ts`.
- HTML e CSS do projeto isolado: `dash/index.html`, `dash/src/index.css`, `dash/src/styles/globals.css`.
- Código-fonte React/TSX: `dash/src/**/*.tsx`, incluindo componentes de UI (`ui/*.tsx`), telas (`AuthScreen.tsx`) e utilitários (`utils.ts`).
- Documentos auxiliares: `dash/README.md`, `dash/src/Attributions.md`, `dash/src/guidelines/Guidelines.md`.

Impacto:
- Nenhuma dependência do app principal foi afetada; o projeto sempre esteve em JS puro.
- A remoção reduz o ruído e evita confusão sobre linguagens/bundlers.

Como restaurar (se necessário):
- Caso use Git: recupere a pasta com `git checkout <commit_anteriores> -- dash`.
- Sem Git: restaure a pasta a partir de um backup externo.

## Próximos Passos Sugeridos
- Documentar endpoints e payloads dos serviços (Supabase) caso use integração.
- Adicionar um guia rápido para contribuições (convenções de CSS/JS e revisões).
- Criar testes simples de renderização (smoke tests) se desejar validar builds.