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

// Helpers Supabase/Mapeamentos
function canUseSupabase() {
  try {
    const AS = window.AuthService;
    return !!AS?.isSupabaseEnabled?.();
  } catch { return false; }
}
function mapDbTransactionToLocal(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    date: row.occurred_at,
    type: row.type,
    categoryId: row.category_id != null ? String(row.category_id) : null,
    bankId: row.bank_id != null ? String(row.bank_id) : null,
  };
}
function mapLocalTransactionToDb(tx) {
  return {
    description: tx.description,
    amount: Number(tx.amount),
    occurred_at: tx.date,
    type: tx.type,
    category_id: tx.categoryId ?? null,
    bank_id: tx.bankId ?? null,
  };
}
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
  auth: document.getElementById('page-auth'),
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

let currentRoute = 'auth';

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
const userInfoEl = document.getElementById('user-info');
const guestInfoEl = document.getElementById('guest-info');
const userNameEl = document.getElementById('user-name');
const userEmailEl = document.getElementById('user-email');
const btnLogoutEl = document.getElementById('btn-logout');

const formLogin = document.getElementById('form-login');
const loginEmailEl = document.getElementById('login-email');
const loginPasswordEl = document.getElementById('login-password');
const formRegister = document.getElementById('form-register');
const regNameEl = document.getElementById('reg-name');
const regEmailEl = document.getElementById('reg-email');
const regPasswordEl = document.getElementById('reg-password');
const authMsgEl = document.getElementById('auth-message');
const toggleToLoginEl = document.getElementById('auth-toggle-login');
const toggleToRegisterEl = document.getElementById('auth-toggle-register');

function updateAuthUI() {
  const AS = window.AuthService;
  const isAuth = !!AS && AS.isAuthenticated && AS.isAuthenticated();
  if (isAuth) {
    userInfoEl?.removeAttribute('hidden');
    guestInfoEl?.setAttribute('hidden', '');
    const name = AS.getDisplayName ? AS.getDisplayName() : 'Você';
    if (userNameEl) userNameEl.textContent = name;
    try {
      const user = AS.getUser ? AS.getUser() : null;
      const email = user?.email || '';
      if (userEmailEl) userEmailEl.textContent = email || '—';
    } catch {}
  } else {
    userInfoEl?.setAttribute('hidden', '');
    guestInfoEl?.removeAttribute('hidden');
    if (userNameEl) userNameEl.textContent = 'Usuário';
    if (userEmailEl) userEmailEl.textContent = '';
  }
}

// Gate simples na navegação
function showPage(route, opts = {}) {
  try {
    const AS = window.AuthService;
    const supEnabled = !!(window.__ENV?.USE_SUPABASE);
    const isAuth = !!AS && AS.isAuthenticated && AS.isAuthenticated();
    if (supEnabled && route !== 'auth' && !isAuth) {
      location.hash = '#/auth';
      route = 'auth';
    }
    if (supEnabled && route === 'auth' && isAuth) {
      location.hash = '#/dashboard';
      route = 'dashboard';
    }
  } catch {}

  Object.values(pages).forEach(p => p?.classList.add('hidden'));
  navLinks.forEach(a => a.classList.remove('active'));
  pages[route]?.classList.remove('hidden');
  const link = navLinks.find(a => a.dataset.route === route);
  if (link) link.classList.add('active');
  currentRoute = route;
  const pageTitleEl = document.getElementById('page-title');
  const titles = { dashboard: 'Dashboard', transactions: 'Transações', categories: 'Categorias', goals: 'Metas', banks: 'Bancos', auth: 'Entrar' };
  if (pageTitleEl) pageTitleEl.textContent = titles[route] || 'Dashboard';
  const menuBtn = document.getElementById('btn-menu');
  if (menuBtn) menuBtn.hidden = (route === 'auth');
  // Toggle modo auth para ajustar layout/ocultar sidebar/header
  const root = document.body;
  if (route === 'auth') root.classList.add('auth-mode'); else root.classList.remove('auth-mode');
  updateAuthUI();
  renderAll();
}

navLinks.forEach(a => a.addEventListener('click', () => showPage(a.dataset.route)));

// Exposição mínima para integração com roteador modular
window.App = window.App || {};
window.App.showPage = showPage;

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
    const cat = categories.find(c => String(c.id) === String(t.categoryId));
    const bank = banks.find(b => String(b.id) === String(t.bankId));
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
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        if (canUseSupabase() && window.TransactionsService?.deleteTransaction) {
          await window.TransactionsService.deleteTransaction(id);
        }
      } catch (err) { console.warn('deleteTransaction supabase error:', err); }
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
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        if (canUseSupabase() && window.CategoriesService?.deleteCategory) {
          await window.CategoriesService.deleteCategory(id);
        }
      } catch (err) { console.warn('deleteCategory supabase error:', err); }
      categories = categories.filter(c => String(c.id) !== String(id));
      storage.set('categories', categories);
      categoryGoals = categoryGoals.filter(g => String(g.categoryId) !== String(id));
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
    const cat = categories.find(c => String(c.id) === String(g.categoryId));
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
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        if (canUseSupabase() && window.GoalsService?.deleteGoal) {
          await window.GoalsService.deleteGoal(id);
        }
      } catch (err) { console.warn('deleteGoal supabase error:', err); }
      categoryGoals = categoryGoals.filter(g => String(g.id) !== String(id));
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
  try {
    const goalSpentLargeEl = document.getElementById('goal-spent-large');
    if (goalSpentLargeEl) goalSpentLargeEl.textContent = formatCurrency(spent);
  } catch {}
  try {
    const goalMetaLargeEl = document.getElementById('goal-meta-large');
    if (goalMetaLargeEl) goalMetaLargeEl.textContent = formatCurrency(goal);
  } catch {}
  try {
    const goalRemainingTextEl = document.getElementById('goal-remaining-text');
    if (goalRemainingTextEl) goalRemainingTextEl.textContent = `Restante: ${formatCurrency(Math.max(goal - spent, 0))}`;
  } catch {}
  // largura do preenchimento geral
  if (progressFillEl) {
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
  }
  // textos e aviso
  if (progressSpentEl) progressSpentEl.textContent = `Gasto: ${formatCurrency(spent)}`;
  if (progressGoalEl) progressGoalEl.textContent = `Meta: ${formatCurrency(goal)}`;
  if (progressPercentEl) progressPercentEl.textContent = `Progresso: ${progress.toFixed(1)}%`;
  if (progressWarningEl) {
    if (progress > 100) {
      progressWarningEl.hidden = false;
      progressWarningEl.textContent = `Meta excedida em ${formatCurrency(spent-goal)}`;
    } else { progressWarningEl.hidden = true; progressWarningEl.textContent = ''; }
  }

  // gráficos
  const byCat = expensesByCat();
  const labels = categories.filter(c => byCat[c.id]).map(c => c.name);
  const data = categories.filter(c => byCat[c.id]).map(c => byCat[c.id]);
  const categoryPalette = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  const colors = labels.map((_, i) => categoryPalette[i % categoryPalette.length]);
  const pieCtx = document.getElementById('pie-expenses-by-category');
  const barCtx = document.getElementById('bar-income-vs-expense');
  // Novo: gráfico de despesas por banco
  const bankCtx = document.getElementById('pie-expenses-by-bank');
  const pieInfoBanksEl = document.getElementById('pie-info-banks');
  const byBank = expensesByBank();
  const bankLabels = banks.filter(b => byBank[String(b.id)]).map(b => b.name);
  const bankData = banks.filter(b => byBank[String(b.id)]).map(b => byBank[String(b.id)]);
  const bankPalette = ['#8b5cf6','#eab308','#f97316'];
  const bankColors = bankLabels.map((_, i) => bankPalette[i % bankPalette.length]);
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
          legend: {
            position: 'bottom',
            onHover: (e, legendItem, chart) => {
              const index = legendItem.index;
              chart.setActiveElements([{ datasetIndex: 0, index }]);
              chart.tooltip.setActiveElements([{ datasetIndex: 0, index }]);
              if (e?.native?.target) e.native.target.style.cursor = 'pointer';
              chart.update();
            },
            onLeave: (e, legendItem, chart) => {
              chart.setActiveElements([]);
              chart.tooltip.setActiveElements([]);
              if (e?.native?.target) e.native.target.style.cursor = 'default';
              chart.update();
            }
          },
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
          legend: {
            position: 'bottom',
            onHover: (e, legendItem, chart) => {
              const index = legendItem.index;
              chart.setActiveElements([{ datasetIndex: 0, index }]);
              chart.tooltip.setActiveElements([{ datasetIndex: 0, index }]);
              if (e?.native?.target) e.native.target.style.cursor = 'pointer';
              chart.update();
            },
            onLeave: (e, legendItem, chart) => {
              chart.setActiveElements([]);
              chart.tooltip.setActiveElements([]);
              if (e?.native?.target) e.native.target.style.cursor = 'default';
              chart.update();
            }
          },
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
    const cat = categories.find(c => String(c.id) === String(g.categoryId));
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
formTx.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!txDescriptionEl.value || !txAmountEl.value || !txDateEl.value) return alert('Preencha todos os campos');
  const localTx = {
    description: txDescriptionEl.value.trim(),
    amount: Number(txAmountEl.value),
    date: txDateEl.value,
    type: txTypeEl.value,
    categoryId: String(txCategoryEl.value),
    bankId: (txTypeEl.value==='expense' && txBankEl && txBankEl.value) ? String(txBankEl.value) : null
  };
  try {
    if (canUseSupabase() && window.TransactionsService?.createTransaction) {
      const created = await window.TransactionsService.createTransaction(mapLocalTransactionToDb(localTx));
      transactions.push({ id: created.id, ...localTx });
    } else {
      transactions.push({ id: Date.now(), ...localTx });
    }
  } catch (err) {
    console.warn('createTransaction supabase error, usando local:', err);
    transactions.push({ id: Date.now(), ...localTx });
  }
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

formCat.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!catNameEl.value || !catColorEl.value) return alert('Preencha todos os campos');
  const name = catNameEl.value.trim();
  const color = catColorEl.value;
  try {
    if (canUseSupabase() && window.CategoriesService?.createCategory) {
      const created = await window.CategoriesService.createCategory({ name, color });
      categories.push({ id: created.id, name: created.name, color: created.color });
    } else {
      categories.push({ id: Date.now(), name, color });
    }
  } catch (err) {
    console.warn('createCategory supabase error, usando local:', err);
    categories.push({ id: Date.now(), name, color });
  }
  storage.set('categories', categories);
  catNameEl.value = '';
  catColorEl.value = '#6200ee';
  renderAll();
});

async function hydrateMonthlyGoalFromSupabase() {
  try {
    const svc = window.GoalsService;
    if (!svc || !svc.isSupabaseEnabled || !svc.isSupabaseEnabled()) return;
    const mg = await svc.fetchMonthlyGoal();
    if (mg && mg.target_amount != null) {
      monthlyGoal = { amount: Number(mg.target_amount) };
      storage.set('monthlyGoal', monthlyGoal);
      renderAll();
    }
  } catch (e) { console.warn('hydrateMonthlyGoalFromSupabase error:', e); }
}

// Hidrata dados do usuário a partir do Supabase
async function hydrateTransactionsFromSupabase() {
  try {
    if (!canUseSupabase() || !window.TransactionsService?.fetchTransactions) return;
    const rows = await window.TransactionsService.fetchTransactions();
    transactions = (rows || []).map(mapDbTransactionToLocal);
    storage.set('transactions', transactions);
  } catch (e) { console.warn('hydrateTransactionsFromSupabase error:', e); }
}
async function hydrateCategoriesFromSupabase() {
  try {
    if (!canUseSupabase() || !window.CategoriesService?.fetchCategories) return;
    const rows = await window.CategoriesService.fetchCategories();
    categories = (rows || []).map(r => ({ id: r.id, name: r.name, color: r.color }));
    storage.set('categories', categories);
  } catch (e) { console.warn('hydrateCategoriesFromSupabase error:', e); }
}
async function hydrateBanksFromSupabase() {
  try {
    if (!canUseSupabase() || !window.BanksService?.fetchBanks) return;
    const rows = await window.BanksService.fetchBanks();
    banks = (rows || []).map(r => ({ id: r.id, name: r.name }));
    storage.set('banks', banks);
  } catch (e) { console.warn('hydrateBanksFromSupabase error:', e); }
}
function mapDbGoalToLocal(row) {
  return {
    id: row.id,
    categoryId: row.category_id != null ? String(row.category_id) : null,
    amount: Number(row.target_amount || 0),
  };
}
async function hydrateCategoryGoalsFromSupabase() {
  try {
    const svc = window.GoalsService;
    if (!svc || !svc.isSupabaseEnabled || !svc.isSupabaseEnabled()) return;
    const all = await svc.fetchGoals();
    const catGoals = (all || []).filter(g => g.category_id != null && (g.name || '').toLowerCase() !== 'monthly');
    categoryGoals = catGoals.map(mapDbGoalToLocal);
    storage.set('categoryGoals', categoryGoals);
  } catch (e) { console.warn('hydrateCategoryGoalsFromSupabase error:', e); }
}
async function hydrateUserData() {
  await Promise.all([
    hydrateCategoriesFromSupabase(),
    hydrateBanksFromSupabase(),
    hydrateTransactionsFromSupabase(),
    hydrateMonthlyGoalFromSupabase(),
    hydrateCategoryGoalsFromSupabase(),
  ]);
  renderAll();
}

formMonthlyGoal.addEventListener('submit', async (e) => {
  e.preventDefault();
  const val = Number(goalAmountEl.value);
  if (!val) return alert('Informe um valor para a meta');
  monthlyGoal = { amount: val };
  storage.set('monthlyGoal', monthlyGoal);
  try { await window.GoalsService?.saveMonthlyGoal?.(val); } catch (err) { console.warn('saveMonthlyGoal error:', err); }
  renderAll();
});

formCategoryGoal.addEventListener('submit', async (e) => {
  e.preventDefault();
  const catId = String(goalCategoryEl.value);
  const amount = Number(goalCatAmountEl.value);
  if (!catId || !amount) return alert('Preencha todos os campos');
  try {
    if (canUseSupabase() && window.GoalsService?.createGoal) {
      const created = await window.GoalsService.createGoal({ category_id: catId, target_amount: amount });
      categoryGoals.push({ id: created.id, categoryId: catId, amount });
    } else {
      categoryGoals.push({ id: Date.now(), categoryId: catId, amount });
    }
  } catch (err) {
    console.warn('createGoal supabase error, usando local:', err);
    categoryGoals.push({ id: Date.now(), categoryId: catId, amount });
  }
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
  // Em vez de fixar 'auth', segue o hash atual
  applyRouteFromHash();
  hydrateMonthlyGoalFromSupabase();
  if (canUseSupabase()) { hydrateUserData(); }
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
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        if (canUseSupabase() && window.BanksService?.deleteBank) {
          await window.BanksService.deleteBank(id);
        }
      } catch (err) { console.warn('deleteBank supabase error:', err); }
      banks = banks.filter(b => String(b.id) !== String(id));
      storage.set('banks', banks);
      renderAll();
    });
  });
}
formBank?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = bankNameEl?.value.trim();
  if (!name) return alert('Informe o nome do banco');
  try {
    if (canUseSupabase() && window.BanksService?.createBank) {
      const created = await window.BanksService.createBank({ name });
      banks.push({ id: created.id, name: created.name });
    } else {
      banks.push({ id: Date.now(), name });
    }
  } catch (err) {
    console.warn('createBank supabase error, usando local:', err);
    banks.push({ id: Date.now(), name });
  }
  storage.set('banks', banks);
  if (bankNameEl) bankNameEl.value = '';
  renderAll();
});

// Roteamento por hash
function getRouteFromHash() {
  const hash = String(location.hash || '').toLowerCase();
  if (hash.includes('#/dashboard')) return 'dashboard';
  if (hash.includes('#/transactions')) return 'transactions';
  if (hash.includes('#/categories')) return 'categories';
  if (hash.includes('#/banks')) return 'banks';
  if (hash.includes('#/goals')) return 'goals';
  return 'auth';
}
function applyRouteFromHash() {
  const route = getRouteFromHash();
  showPage(route);
}
window.addEventListener('hashchange', applyRouteFromHash);

// Auth listeners
window.addEventListener('auth:change', () => {
  updateAuthUI();
  if (canUseSupabase()) { hydrateUserData(); }
  applyRouteFromHash();
});
btnLogoutEl?.addEventListener('click', async () => {
  try { await window.AuthService?.signOut(); } catch {}
  location.hash = '#/auth';
});
// Abas de autenticação (login/cadastro)
const authTabTriggers = Array.from(document.querySelectorAll('.tabs-trigger'));
const authTabContents = Array.from(document.querySelectorAll('.tabs-content'));
const showAuthTab = (name) => {
  authTabContents.forEach((c) => {
    if (c.dataset.tab === name) c.removeAttribute('hidden'); else c.setAttribute('hidden', '');
  });
  authTabTriggers.forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  // Limpar mensagem ao alternar entre Entrar/Cadastrar
  if (authMsgEl) authMsgEl.textContent = '';
};
authTabTriggers.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab || 'login';
    showAuthTab(tab);
    if (tab === 'login') loginEmailEl?.focus(); else regNameEl?.focus();
  });
});
// Garantir aba inicial
showAuthTab('login');

toggleToLoginEl?.addEventListener('click', () => {
  pages.auth?.classList.remove('hidden');
  showAuthTab('login');
  loginEmailEl?.focus();
});

toggleToRegisterEl?.addEventListener('click', () => {
  pages.auth?.classList.remove('hidden');
  showAuthTab('register');
  regNameEl?.focus();
});

formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmailEl?.value?.trim();
  const password = loginPasswordEl?.value || '';
  authMsgEl.textContent = '';
  try {
    await window.AuthService?.signIn({ email, password });
    authMsgEl.textContent = 'Login realizado com sucesso';
    // Hidratar dados do usuário
    try { await hydrateMonthlyGoalFromSupabase(); } catch {}
    location.hash = '#/dashboard';
  } catch (err) {
    const raw = String(err?.message || '');
    const isInvalid = /invalid login credentials/i.test(raw);
    const isEmailNotConfirmed = /confirm/i.test(raw) && /email/i.test(raw);
    if (isInvalid) {
      authMsgEl.textContent = 'Não foi possível entrar. Verifique email e senha, ou se sua conta já foi criada.';
    } else if (isEmailNotConfirmed) {
      authMsgEl.textContent = 'Email não confirmado. Verifique sua caixa de entrada e confirme seu cadastro.';
    } else {
      authMsgEl.textContent = 'Não foi possível entrar. Verifique os dados e tente novamente.';
    }
    console.warn('Falha no login:', err);
  }
});

formRegister?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = regNameEl?.value?.trim();
  const email = regEmailEl?.value?.trim();
  const password = regPasswordEl?.value || '';
  authMsgEl.textContent = '';
  try {
    const res = await window.AuthService?.signUp({ name, email, password });
    // Em ambientes sem confirmação de email, garantir sessão ativa
    try { await window.AuthService?.signIn({ email, password }); } catch {}
    authMsgEl.textContent = 'Conta criada e sessão iniciada';
    try { await hydrateMonthlyGoalFromSupabase(); } catch {}
    location.hash = '#/dashboard';
  } catch (err) {
    authMsgEl.textContent = (err?.message) || 'Falha no cadastro';
    console.warn('Falha no cadastro:', err);
  }
});