// Utilidades
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value||0));
const todayISO = () => new Date().toISOString().split('T')[0];

// Persistência (localStorage)
const storage = {
  get(key, fallback) {
    const raw = localStorage.getItem(key);
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

// Estado
let transactions = storage.get('transactions', []);
let categories = storage.get('categories', [
  { id: 1, name: 'Alimentação', color: '#FFADAD' },   // soft red
  { id: 2, name: 'Transporte', color: '#A0C4FF' },    // soft blue
  { id: 3, name: 'Moradia', color: '#FDFFB6' },       // soft yellow
  { id: 4, name: 'Lazer', color: '#BDB2FF' },         // soft lavender
  { id: 5, name: 'Saúde', color: '#CAFFBF' },         // soft green
  { id: 6, name: 'Educação', color: '#FFD6A5' },      // soft peach
  { id: 7, name: 'Roupas', color: '#9ad5ca' },        // soft mint
  { id: 8, name: 'Outros', color: '#c7c7e2' },        // soft gray-lilac
]);
let monthlyGoal = storage.get('monthlyGoal', { amount: 2000 });
let categoryGoals = storage.get('categoryGoals', []);

// Helpers de cálculo
const currentMonthTransactions = () => {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  });
};
const monthlyIncome = () => currentMonthTransactions().filter(t => t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
const monthlyExpenses = () => currentMonthTransactions().filter(t => t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
const expensesByCat = () => {
  const map = {};
  currentMonthTransactions().filter(t=>t.type==='expense').forEach(t => {
    map[t.categoryId] = (map[t.categoryId]||0) + Number(t.amount);
  });
  return map;
};
const remainingBudget = () => Number(monthlyGoal.amount) - monthlyExpenses();
const budgetProgress = () => {
  const goal = Number(monthlyGoal.amount) || 0;
  return goal>0 ? (monthlyExpenses()/goal)*100 : 0;
};

// DOM refs
const pages = {
  dashboard: document.getElementById('page-dashboard'),
  transactions: document.getElementById('page-transactions'),
  categories: document.getElementById('page-categories'),
  goals: document.getElementById('page-goals'),
};
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const summaryIncomeEl = document.getElementById('summary-income');
const summaryExpenseEl = document.getElementById('summary-expense');
const summaryBalanceEl = document.getElementById('summary-balance');
const progressFillEl = document.getElementById('progress-fill');
const progressSpentEl = document.getElementById('progress-spent');
const progressGoalEl = document.getElementById('progress-goal');
const progressPercentEl = document.getElementById('progress-percent');
const progressWarningEl = document.getElementById('progress-warning');
const backBtn = document.getElementById('btn-back');
let currentRoute = 'dashboard';
let navHistory = [];

// Formulários
const formTx = document.getElementById('form-transaction');
const txDescriptionEl = document.getElementById('tx-description');
const txAmountEl = document.getElementById('tx-amount');
const txDateEl = document.getElementById('tx-date');
const txTypeEl = document.getElementById('tx-type');
const txCategoryEl = document.getElementById('tx-category');
const tableTransactionsTbody = document.getElementById('table-transactions');

const formCat = document.getElementById('form-category');
const catNameEl = document.getElementById('cat-name');
const catColorEl = document.getElementById('cat-color');
const gridCategoriesEl = document.getElementById('grid-categories');

const formMonthlyGoal = document.getElementById('form-monthly-goal');
const goalAmountEl = document.getElementById('goal-amount');

const formCategoryGoal = document.getElementById('form-category-goal');
const goalCategoryEl = document.getElementById('goal-category');
const goalCatAmountEl = document.getElementById('goal-cat-amount');
const listCategoryGoalsEl = document.getElementById('list-category-goals');

// Charts
let pieChart, barChart, goalProgressChart;

function hexToRgba(hex, alpha = 0.7) {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureCategoryProgressCard() {
  const container = document.getElementById('page-dashboard');
  if (!document.getElementById('bar-category-goal-progress')) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2 class="card-title">Progresso por Categoria (Meta)</h2>
      <canvas id="bar-category-goal-progress"></canvas>
      <div id="bar-category-goal-progress-note" class="progress-text"></div>
    `;
    container.appendChild(card);
  }
}

// Navegação
function showPage(route, opts = {}) {
  const fromBack = opts.fromBack || false;
  if (!fromBack && route !== currentRoute && currentRoute) {
    navHistory.push(currentRoute);
  }
  Object.values(pages).forEach(p => p.classList.add('hidden'));
  navLinks.forEach(a => a.classList.remove('active'));
  pages[route].classList.remove('hidden');
  const link = navLinks.find(a => a.dataset.route === route);
  if (link) link.classList.add('active');
  currentRoute = route;
  if (backBtn) backBtn.hidden = navHistory.length === 0;
  // Atualiza telas ao navegar
  renderAll();
}
function goBack() {
  if (!navHistory.length) return;
  const prev = navHistory.pop();
  showPage(prev, { fromBack: true });
}
navLinks.forEach(a => a.addEventListener('click', () => showPage(a.dataset.route)));

// Renderizações
function renderSummary() {
  summaryIncomeEl.textContent = formatCurrency(monthlyIncome());
  summaryExpenseEl.textContent = formatCurrency(monthlyExpenses());
  summaryBalanceEl.textContent = formatCurrency(remainingBudget());
}

function renderTransactions() {
  // Prepara select de categorias
  txCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (!txDateEl.value) txDateEl.value = todayISO();
  // Lista transações do mês
  const rows = currentMonthTransactions().map(t => {
    const cat = categories.find(c => c.id === Number(t.categoryId));
    const isIncome = t.type === 'income';
    return `<tr>
      <td>${new Date(t.date).toLocaleDateString('pt-BR')}</td>
      <td>${t.description}</td>
      <td><span class="badge" style="background:${cat?.color||'#999'}">${cat?.name||'Sem categoria'}</span></td>
      <td><span style="color:${isIncome?'#2e7d32':'#c62828'}">${isIncome?'+':'-'} ${formatCurrency(t.amount)}</span></td>
      <td><button class="action delete" data-id="${t.id}">Excluir</button></td>
    </tr>`;
  }).join('');
  tableTransactionsTbody.innerHTML = rows || `<tr><td colspan="5" style="text-align:center">Nenhuma transação registrada neste mês</td></tr>`;
  // Ações de excluir
  tableTransactionsTbody.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      transactions = transactions.filter(t => t.id !== id);
      storage.set('transactions', transactions);
      renderAll();
    });
  });
}

function renderCategories() {
  // select metas por categoria
  goalCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  // grid
  gridCategoriesEl.innerHTML = categories.map(c => `
    <div class="category-card" style="border-left-color:${c.color}">
      <div class="category-header">
        <h3>${c.name}</h3>
        <button class="action delete" data-id="${c.id}">Excluir</button>
      </div>
      <div class="category-color" style="background:${c.color}"></div>
    </div>
  `).join('');
  gridCategoriesEl.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      categories = categories.filter(c => c.id !== id);
      storage.set('categories', categories);
      // remove metas ligadas a categoria
      categoryGoals = categoryGoals.filter(g => g.categoryId !== id);
      storage.set('categoryGoals', categoryGoals);
      renderAll();
    });
  });
}

function renderGoals() {
  goalAmountEl.value = monthlyGoal.amount || '';
  // lista metas por categoria
  const byCatSpent = expensesByCat();
  listCategoryGoalsEl.innerHTML = categoryGoals.map(g => {
    const cat = categories.find(c => c.id === Number(g.categoryId));
    const spent = byCatSpent[g.categoryId] || 0;
    const progress = g.amount>0 ? (spent/g.amount)*100 : 0;
    const over = progress>100 ? `Meta excedida em ${formatCurrency(spent-g.amount)}` : '';
    return `
      <div class="goal-card" style="border-left-color:${cat?.color||'#999'}">
        <div class="goal-header">
          <h3>${cat?.name||'Categoria'}</h3>
          <button class="action delete" data-id="${g.id}">Excluir</button>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(progress,100)}%"></div></div>
        <div class="progress-text">
          <span>Gasto: ${formatCurrency(spent)}</span>
          <span>Meta: ${formatCurrency(g.amount)}</span>
        </div>
        <div class="progress-text">
          <span>Progresso: ${progress.toFixed(1)}%</span>
          <span class="warning">${over}</span>
        </div>
      </div>
    `;
  }).join('');
  listCategoryGoalsEl.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      categoryGoals = categoryGoals.filter(g => g.id !== id);
      storage.set('categoryGoals', categoryGoals);
      renderAll();
    });
  });
}

function renderDashboard() {
  ensureCategoryProgressCard();
  const pieInfoEl = document.getElementById('pie-info');
  // barra de progresso
  const spent = monthlyExpenses();
  const goal = Number(monthlyGoal.amount)||0;
  const progress = budgetProgress();
  progressFillEl.style.width = `${Math.min(progress,100)}%`;
  progressFillEl.style.backgroundColor = progress>100 ? 'var(--color-error)' : progress>80 ? 'var(--color-warning)' : 'var(--color-accent)';
  progressSpentEl.textContent = `Gasto: ${formatCurrency(spent)}`;
  progressGoalEl.textContent = `Meta: ${formatCurrency(goal)}`;
  progressPercentEl.textContent = `Progresso: ${progress.toFixed(1)}%`;
  if (progress > 100) {
    progressWarningEl.hidden = false;
    progressWarningEl.textContent = `Meta excedida em ${formatCurrency(spent-goal)}`;
  } else { progressWarningEl.hidden = true; progressWarningEl.textContent = ''; }

  // gráficos
  const byCat = expensesByCat();
  const labels = categories.filter(c => byCat[c.id]).map(c => c.name);
  const data = categories.filter(c => byCat[c.id]).map(c => byCat[c.id]);
  const colors = categories.filter(c => byCat[c.id]).map(c => c.color);
  const pieCtx = document.getElementById('pie-expenses-by-category');
  const barCtx = document.getElementById('bar-income-vs-expense');

  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();

  pieChart = new Chart(pieCtx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: colors }] },
    options: {
      maintainAspectRatio: window.innerWidth >= 900,
      aspectRatio: 1,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed;
              const total = ctx.dataset.data.reduce((s,v)=>s+v,0);
              const pct = total ? (value/total)*100 : 0;
              return `${ctx.label}: ${formatCurrency(value)} (${pct.toFixed(1)}%)`;
            }
          }
        }
      }
    }
  });

  // Atualiza info abaixo do gráfico ao passar mouse/clicar
  const updatePieInfoFromIndex = (index) => {
    if (index == null || index < 0) return;
    const value = data[index];
    const total = data.reduce((s,v)=>s+v,0);
    const pct = total ? (value/total)*100 : 0;
    const label = labels[index];
    if (pieInfoEl) pieInfoEl.textContent = `${label}: ${pct.toFixed(1)}%`;
  };
  pieCtx.addEventListener('click', (e) => {
    const els = pieChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
    if (els && els.length) updatePieInfoFromIndex(els[0].index);
  });
  pieCtx.addEventListener('mousemove', (e) => {
    const els = pieChart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
    if (els && els.length) updatePieInfoFromIndex(els[0].index);
  });

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas'],
      datasets: [{ label: 'Valor (R$)', data: [monthlyIncome(), monthlyExpenses()], backgroundColor: ['rgba(142,197,229,0.7)','rgba(255,179,186,0.7)'] }]
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  // gráfico: progresso da meta por categoria (horizontal)
  const byCatMap = byCat; // já calculado acima
  const goals = categoryGoals.map(g => {
    const cat = categories.find(c => c.id === Number(g.categoryId));
    const spentCat = byCatMap[g.categoryId] || 0;
    const pct = g.amount>0 ? (spentCat / g.amount) * 100 : 0;
    return {
      name: cat?.name || 'Categoria',
      color: cat?.color || '#999999',
      percent: Math.min(pct, 100),
      rawPercent: pct
    };
  });

  const goalCanvas = document.getElementById('bar-category-goal-progress');
  const noteEl = document.getElementById('bar-category-goal-progress-note');
  noteEl.textContent = goals.length ? goals.map(g => `${g.name}: ${g.rawPercent.toFixed(1)}%`).join(' • ') : 'Nenhuma meta por categoria definida';

  if (goalProgressChart) goalProgressChart.destroy();
  goalProgressChart = new Chart(goalCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: goals.map(g => g.name),
      datasets: [{
        label: '% da meta',
        data: goals.map(g => g.percent),
        backgroundColor: goals.map(g => hexToRgba(g.color, 0.7))
      }]
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Progresso (%) da Meta por Categoria' },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x.toFixed(1)}%` } }
      }
    }
  });
}

function renderAll() {
  renderSummary();
  renderDashboard();
  renderTransactions();
  renderCategories();
  renderGoals();
}

// Eventos de formulário
formTx.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!txDescriptionEl.value || !txAmountEl.value || !txDateEl.value) return alert('Preencha todos os campos');
  const tx = {
    id: Date.now(),
    description: txDescriptionEl.value.trim(),
    amount: Number(txAmountEl.value),
    date: txDateEl.value,
    type: txTypeEl.value,
    categoryId: Number(txCategoryEl.value)
  };
  transactions.push(tx);
  storage.set('transactions', transactions);
  // reset
  txDescriptionEl.value = '';
  txAmountEl.value = '';
  txDateEl.value = todayISO();
  txTypeEl.value = 'expense';
  txCategoryEl.value = categories[0]?.id || '';
  renderAll();
});

formCat.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!catNameEl.value || !catColorEl.value) return alert('Preencha todos os campos');
  categories.push({ id: Date.now(), name: catNameEl.value.trim(), color: catColorEl.value });
  storage.set('categories', categories);
  catNameEl.value = '';
  catColorEl.value = '#6200ee';
  renderAll();
});

formMonthlyGoal.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = Number(goalAmountEl.value);
  if (!val) return alert('Informe um valor para a meta');
  monthlyGoal = { amount: val };
  storage.set('monthlyGoal', monthlyGoal);
  renderAll();
});

formCategoryGoal.addEventListener('submit', (e) => {
  e.preventDefault();
  const catId = Number(goalCategoryEl.value);
  const amount = Number(goalCatAmountEl.value);
  if (!catId || !amount) return alert('Preencha todos os campos');
  categoryGoals.push({ id: Date.now(), categoryId: catId, amount });
  storage.set('categoryGoals', categoryGoals);
  goalCategoryEl.value = categories[0]?.id || '';
  goalCatAmountEl.value = '';
  renderAll();
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // configura selects iniciais
  txDateEl.value = todayISO();
  renderAll();
  showPage('dashboard');
  // Botão Voltar (mobile)
  if (backBtn) {
    backBtn.hidden = true;
    backBtn.addEventListener('click', goBack);
  }
  // FAB: ações rápidas (mobile)
  const fab = document.querySelector('.fab-container');
  const fabMain = document.querySelector('.fab-main');
  const fabItems = document.querySelectorAll('.fab-item');
  if (fab && fabMain) {
    fabMain.addEventListener('click', (e) => {
      e.stopPropagation();
      fab.classList.toggle('open');
    });
    fabItems.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'add-transaction') {
          showPage('transactions');
          txDescriptionEl?.focus();
        } else if (action === 'add-category') {
          showPage('categories');
          catNameEl?.focus();
        } else if (action === 'add-goal') {
          showPage('goals');
          goalAmountEl?.focus();
        }
        fab.classList.remove('open');
      });
    });
    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target)) fab.classList.remove('open');
    });
  }
});