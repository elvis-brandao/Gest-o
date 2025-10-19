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
let banks = storage.get('banks', []);

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
// Agregação: despesas por banco
const expensesByBank = () => {
  const map = {};
  currentMonthTransactions().filter(t=>t.type==='expense').forEach(t => {
    if (t.bankId != null) {
      const id = String(t.bankId);
      map[id] = (map[id]||0) + Number(t.amount);
    }
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
  banks: document.getElementById('page-banks'),
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

let currentRoute = 'dashboard';

// Formulários
const formTx = document.getElementById('form-transaction');
const txDescriptionEl = document.getElementById('tx-description');
const txAmountEl = document.getElementById('tx-amount');
const txDateEl = document.getElementById('tx-date');
const txTypeEl = document.getElementById('tx-type');
const txCategoryEl = document.getElementById('tx-category');
const txBankEl = document.getElementById('tx-bank');
const txBankGroupEl = document.getElementById('tx-bank-group');
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
// Bancos: refs de DOM
const formBank = document.getElementById('form-bank');
const bankNameEl = document.getElementById('bank-name');
const gridBanksEl = document.getElementById('grid-banks');

// Charts
let pieChart, barChart, goalProgressChart, bankPieChart;

function hexToRgba(hex, alpha = 0.7) {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ensureCategoryProgressCard() {
  // seção desativada conforme solicitado
}

// Navegação
function showPage(route, opts = {}) {
  Object.values(pages).forEach(p => p.classList.add('hidden'));
  navLinks.forEach(a => a.classList.remove('active'));
  pages[route].classList.remove('hidden');
  const link = navLinks.find(a => a.dataset.route === route);
  if (link) link.classList.add('active');
  currentRoute = route;
  // Atualiza título da página
  const pageTitleEl = document.getElementById('page-title');
  const titles = { dashboard: 'Dashboard', transactions: 'Transações', categories: 'Categorias', goals: 'Metas' };
  if (pageTitleEl) pageTitleEl.textContent = titles[route] || 'Dashboard';
  // Menu hambúrguer sempre visível
  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.hidden = false;
  // Atualiza telas ao navegar
  renderAll();
}

navLinks.forEach(a => a.addEventListener('click', () => showPage(a.dataset.route)));

// Renderizações
function renderSummary() {
  if (!summaryIncomeEl || !summaryExpenseEl || !summaryBalanceEl) return;
  summaryIncomeEl.textContent = formatCurrency(monthlyIncome());
  summaryExpenseEl.textContent = formatCurrency(monthlyExpenses());
  summaryBalanceEl.textContent = formatCurrency(remainingBudget());
}

function renderTransactions() {
  // Prepara select de categorias
  txCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  if (!txCategoryEl.value) txCategoryEl.value = categories[0]?.id || '';
  // Prepara select de bancos
  if (txBankEl) {
    txBankEl.innerHTML = `<option value="">Dinheiro</option>` + banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (!txDateEl.value) txDateEl.value = todayISO();
  // Ajusta visibilidade do banco conforme tipo
  updateBankVisibility();
  // Lista transações do mês
  const rows = currentMonthTransactions().map(t => {
    const cat = categories.find(c => c.id === Number(t.categoryId));
    const bank = banks.find(b => b.id === Number(t.bankId));
    const isIncome = t.type === 'income';
    return `<tr>
      <td>${new Date(t.date).toLocaleDateString('pt-BR')}</td>
      <td>${t.description}</td>
      <td><span class="badge" style="background:${cat?.color||'#999'}">${cat?.name||'Sem categoria'}</span></td>
      <td>${!isIncome ? `<span class=\"badge\">${bank?.name||'Dinheiro'}</span>` : '-'}</td>
      <td><span style="color:${isIncome?'#2e7d32':'#c62828'}">${isIncome?'+':'-'} ${formatCurrency(t.amount)}</span></td>
      <td><button class="action delete" data-id="${t.id}">Excluir</button></td>
    </tr>`;
  }).join('');
  tableTransactionsTbody.innerHTML = rows || `<tr><td colspan="6" style="text-align:center">Nenhuma transação registrada neste mês</td></tr>`;
  // Ações de excluir
  tableTransactionsTbody.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      transactions = transactions.filter(t => String(t.id) !== String(id));
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
        <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(progress,100)}%;background:${cat?.color||'#999'}"></div></div>
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
  // largura do preenchimento geral
  progressFillEl.style.width = `${Math.min(progress,100)}%`;
  // construir segmentos por categoria dentro do preenchimento
  progressFillEl.style.backgroundColor = 'transparent';
  while (progressFillEl.firstChild) progressFillEl.removeChild(progressFillEl.firstChild);
  const byCatSummary = expensesByCat();
  const totalCatSpent = Object.values(byCatSummary).reduce((s,v)=>s+Number(v),0);
  if (totalCatSpent > 0) {
    categories.forEach(c => {
      const catSpent = byCatSummary[c.id];
      if (catSpent) {
        const sharePct = (catSpent / totalCatSpent) * 100;
        const seg = document.createElement('div');
        seg.className = 'progress-segment';
        seg.style.width = `${sharePct}%`;
        seg.style.backgroundColor = c.color || '#999999';
        progressFillEl.appendChild(seg);
      }
    });
  }
  // textos e aviso
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
  // Novo: gráfico de despesas por banco
  const bankCtx = document.getElementById('pie-expenses-by-bank');
  const pieInfoBanksEl = document.getElementById('pie-info-banks');
  const byBank = expensesByBank();
  const bankLabels = banks.filter(b => byBank[String(b.id)]).map(b => b.name);
  const bankData = banks.filter(b => byBank[String(b.id)]).map(b => byBank[String(b.id)]);
  const pastelPalette = ['#FFADAD','#FFD6A5','#FDFFB6','#CAFFBF','#A0C4FF','#BDB2FF','#9ad5ca','#c7c7e2','#ffb3c1','#bde0fe','#bee1e6','#cfe1b9'];
  const bankColors = bankLabels.map((_, i) => pastelPalette[i % pastelPalette.length]);
  if (pieChart) pieChart.destroy();
  if (barChart) barChart.destroy();
  if (bankPieChart) bankPieChart.destroy();

  if (pieCtx) {
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


  }

  // Gráfico de despesas por banco
  if (bankCtx) {
    if (bankPieChart) bankPieChart.destroy();

    bankPieChart = new Chart(bankCtx, {
      type: 'pie',
      data: { labels: bankLabels, datasets: [{ data: bankData, backgroundColor: bankColors }] },
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


  }

  if (barCtx) {
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{ label: 'Valor (R$)', data: [monthlyIncome(), monthlyExpenses()], backgroundColor: ['rgba(142,197,229,0.7)','rgba(255,179,186,0.7)'] }]
      },
      options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
  }

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
  if (noteEl) {
    noteEl.textContent = goals.length ? goals.map(g => `${g.name}: ${g.rawPercent.toFixed(1)}%`).join(' • ') : 'Nenhuma meta por categoria definida';
  }
  if (goalCanvas) {
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
}

function renderAll() {
  renderSummary();
  renderDashboard();
  renderTransactions();
  renderCategories();
  renderGoals();
  renderBanks();
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
    categoryId: Number(txCategoryEl.value),
    bankId: txTypeEl.value==='expense' && txBankEl ? Number(txBankEl.value) : null
  };
  transactions.push(tx);
  storage.set('transactions', transactions);
  // reset
  txDescriptionEl.value = '';
  txAmountEl.value = '';
  txDateEl.value = todayISO();
  txTypeEl.value = 'expense';
  txCategoryEl.value = categories[0]?.id || '';
  if (txBankEl) txBankEl.value = '';
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

  // Atualiza visibilidade do banco conforme tipo
  txTypeEl?.addEventListener('change', updateBankVisibility);
  updateBankVisibility();
  // FAB: ação direta para nova transação
  const fab = document.querySelector('.fab-container');
  const fabMain = document.querySelector('.fab-main');
  if (fab && fabMain) {
    fabMain.addEventListener('click', (e) => {
      e.stopPropagation();
      showPage('transactions');
      txDescriptionEl?.focus();
    });
  }
});

// Menu hambúrguer: abrir/fechar drawer (mobile)
const sidebar = document.querySelector('.sidebar');
const overlay = document.querySelector('.drawer-overlay');
const btnMenu = document.getElementById('btn-menu');

const openDrawer = () => {
  sidebar?.classList.add('open');
  overlay?.classList.add('open');
};
const closeDrawer = () => {
  sidebar?.classList.remove('open');
  overlay?.classList.remove('open');
};
const toggleDrawer = () => {
  if (sidebar?.classList.contains('open')) closeDrawer(); else openDrawer();
};

btnMenu?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleDrawer();
});
overlay?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDrawer();
});
// Fecha drawer ao clicar em um link da navegação (mobile)
  document.querySelectorAll('.sidebar .nav-link').forEach((a) => {
    a.addEventListener('click', () => {
      if (window.innerWidth < 900) closeDrawer();
    });
  });
  // Garante estado correto ao mudar para desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 900) closeDrawer();
  });

function updateBankVisibility() {
  if (!txTypeEl || !txBankGroupEl) return;
  const isExpense = txTypeEl.value === 'expense';
  txBankGroupEl.style.display = isExpense ? '' : 'none';
}

function renderBanks() {
  if (!gridBanksEl) return;
  gridBanksEl.innerHTML = banks.map(b => `
    <div class="bank-card">
      <div class="bank-header">
        <h3>${b.name}</h3>
        <button class="action delete" data-id="${b.id}">Excluir</button>
      </div>
    </div>
  `).join('');
  gridBanksEl.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      banks = banks.filter(b => b.id !== id);
      storage.set('banks', banks);
      renderAll();
    });
  });
}
formBank?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = bankNameEl?.value.trim();
  if (!name) return alert('Informe o nome do banco');
  banks.push({ id: Date.now(), name });
  storage.set('banks', banks);
  if (bankNameEl) bankNameEl.value = '';
  renderAll();
});