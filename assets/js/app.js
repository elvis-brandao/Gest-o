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
  if (route === 'auth') { root.classList.add('auth-mode'); try { closeDrawer(); } catch {} } else { root.classList.remove('auth-mode'); }
  updateAuthUI();
  renderAll();
}

navLinks.forEach(a => a.addEventListener('click', () => showPage(a.dataset.route)));

// Exposição mínima para integração com roteador modular
window.App = window.App || {};
window.App.showPage = showPage;

// Drawer/Menu toggle logic
const sidebarEl = document.querySelector('.sidebar');
const drawerOverlayEl = document.getElementById('drawer-overlay') || document.querySelector('.drawer-overlay');
function openDrawer() {
  try {
    sidebarEl?.classList.add('open');
    drawerOverlayEl?.classList.add('open');
  } catch {}
}
function closeDrawer() {
  try {
    sidebarEl?.classList.remove('open');
    drawerOverlayEl?.classList.remove('open');
  } catch {}
}
const btnMenuEl = document.getElementById('btn-menu');
btnMenuEl?.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(); });
drawerOverlayEl?.addEventListener('click', () => closeDrawer());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

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
      <td><button class="action delete" data-id="${t.id}" aria-label="Excluir transação" title="Excluir" type="button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg></button></td>
    </tr>`;
  }).join('');
  tableTransactionsTbody.innerHTML = rows || `<tr><td colspan="6" style="text-align:center">Nenhuma transação registrada neste mês</td></tr>`;
  // Ações de excluir
  tableTransactionsTbody.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = window.confirm('Tem certeza que deseja excluir esta transação?');
      if (!ok) return;
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
  // seção de metas por categoria removida
  // grid
  gridCategoriesEl.innerHTML = categories.map(c => `
    <div class="category-card" style="border-left-color:${c.color}">
      <div class="category-header">
        <h3>${c.name}</h3>
        <button class="action delete" data-id="${c.id}" aria-label="Excluir categoria" title="Excluir" type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="category-color" style="background:${c.color}"></div>
    </div>
  `).join('');
  gridCategoriesEl.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = window.confirm('Tem certeza que deseja excluir esta categoria?');
      if (!ok) return;
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
}

function renderBanks() {

}

function renderBanks() {
  if (!gridBanksEl) return;
  gridBanksEl.innerHTML = banks.map(b => `
    <div class="bank-card">
      <div class="bank-header">
        <h3>${b.name}</h3>
        <button class="action delete" data-id="${b.id}" aria-label="Excluir banco" title="Excluir" type="button"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    </div>
  `).join('');
  gridBanksEl.querySelectorAll('button.delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const ok = window.confirm('Tem certeza que deseja excluir este banco?');
      if (!ok) return;
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
window.addEventListener('auth:change', async () => {
  updateAuthUI();
  try { await window.CategoriesService?.syncOutbox?.(); } catch {}
  if (canUseSupabase()) { hydrateUserData(); }
  applyRouteFromHash();
});
btnLogoutEl?.addEventListener('click', async () => {
  try { await window.AuthService?.signOut(); } catch {}
  location.hash = '#/auth';
});
// Abas de autenticação (login/cadastrar)
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

// ===== Funções auxiliares restauradas =====
function updateBankVisibility() {
  if (!txBankGroupEl || !txTypeEl) return;
  txBankGroupEl.hidden = (txTypeEl.value !== 'expense');
}
// Atualiza visibilidade ao trocar tipo de transação
try { txTypeEl?.addEventListener('change', updateBankVisibility); } catch {}

function renderDashboard() {
  // Resumo + barra de progresso da meta mensal
  renderSummary();
  const goal = Number(monthlyGoal.amount) || 0;
  const spent = monthlyExpenses();
  const pct = budgetProgress();
  if (progressFillEl) progressFillEl.style.width = Math.min(pct, 100) + '%';
  if (progressSpentEl) progressSpentEl.textContent = formatCurrency(spent);
  if (progressGoalEl) progressGoalEl.textContent = formatCurrency(goal);
  if (progressPercentEl) progressPercentEl.textContent = pct.toFixed(1) + '%';
  if (progressWarningEl) progressWarningEl.textContent = pct > 100 ? 'Meta mensal excedida' : '';
}

function renderAll() {
  try {
    renderSummary();
    renderTransactions();
    renderCategories();
    renderGoals();
    renderBanks();
    renderDashboard();
    ensureCategoryProgressCard();
  } catch (err) {
    console.warn('Falha ao renderizar:', err);
  }
}

async function hydrateMonthlyGoalFromSupabase() {
  try {
    if (canUseSupabase() && window.GoalsService?.fetchMonthlyGoal) {
      const res = await window.GoalsService.fetchMonthlyGoal();
      if (res && res.target_amount != null) {
        monthlyGoal.amount = Number(res.target_amount);
        storage.set('monthlyGoal', monthlyGoal);
      }
    }
  } catch (err) {
    console.warn('hydrateMonthlyGoalFromSupabase error:', err);
  }
}

async function hydrateAllData() {
  try {
    if (canUseSupabase()) {
      try {
        const cats = await window.CategoriesService?.fetchCategories?.();
        if (Array.isArray(cats) && cats.length) {
          categories = cats.map(c => ({ id: c.id, name: c.name, color: c.color }));
          storage.set('categories', categories);
        }
      } catch (err) { console.warn('hydrate categories error:', err); }
      try {
        const bks = await window.BanksService?.fetchBanks?.();
        if (Array.isArray(bks)) {
          banks = bks.map(b => ({ id: b.id, name: b.name }));
          storage.set('banks', banks);
        }
      } catch (err) { console.warn('hydrate banks error:', err); }
      try {
        const txs = await window.TransactionsService?.fetchTransactions?.();
        if (Array.isArray(txs)) {
          transactions = txs.map(mapDbTransactionToLocal);
          storage.set('transactions', transactions);
        }
      } catch (err) { console.warn('hydrate transactions error:', err); }
      try {
        const goals = await window.GoalsService?.fetchGoals?.();
        if (Array.isArray(goals)) {
          categoryGoals = goals.filter(g => g.category_id).map(g => ({ id: g.id, categoryId: String(g.category_id), amount: Number(g.target_amount || 0) }));
          storage.set('categoryGoals', categoryGoals);
        }
      } catch (err) { console.warn('hydrate goals error:', err); }
      try { await hydrateMonthlyGoalFromSupabase(); } catch {}
    }
  } catch (err) {
    console.warn('hydrateAllData error:', err);
  }
}

async function hydrateUserData() {
  await hydrateAllData();
}