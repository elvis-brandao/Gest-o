// Utilidades
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value||0));
const todayISO = () => new Date().toISOString().split('T')[0];
const getMonthKeyFromDate = (dateStr) => {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth()+1).toString().padStart(2,'0');
  return `${y}-${m}`;
};
const getCurrentMonthKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth()+1).toString().padStart(2,'0');
  return `${y}-${m}`;
};
const getPrevMonthKey = (monthKey) => {
  const [y,m] = monthKey.split('-').map(Number);
  const d = new Date(y, m-2, 1);
  const yy = d.getFullYear();
  const mm = (d.getMonth()+1).toString().padStart(2,'0');
  return `${yy}-${mm}`;
};

// Persistência (localStorage)
const storage = {
  get(key, fallback) {
    const raw = localStorage.getItem(key);
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

// Valor padrão para meta mensal quando não existe registro
const DEFAULT_MONTHLY_GOAL = 5000;

// Estado
let transactions = storage.get('transactions', []);
let categories = storage.get('categories', []);
let monthlyGoal = storage.get('monthlyGoal', { amount: 0 });
let categoryGoals = storage.get('categoryGoals', []);
let banks = storage.get('banks', []);
let selectedMonth = storage.get('selectedMonth', getCurrentMonthKey());
let monthlyGoalsMap = storage.get('monthlyGoals', {});
const getSelectedMonthlyGoalAmount = () => Number(monthlyGoalsMap[selectedMonth] ?? 0);

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
    createdAt: row.created_at,
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
  const [yy, mm] = String(selectedMonth).split('-').map(Number);
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === yy && (d.getMonth() + 1) === mm;
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
const remainingBudget = () => getSelectedMonthlyGoalAmount() - monthlyExpenses();
const budgetProgress = () => {
  const goal = getSelectedMonthlyGoalAmount();
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
// Removido: duplicatas de declarações de resumo e progresso
// Adiciona refs para estatísticas grandes da meta
const goalSpentLargeEl = document.getElementById('goal-spent-large');
const goalMetaLargeEl = document.getElementById('goal-meta-large');
const goalRemainingTextEl = document.getElementById('goal-remaining-text');
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

// Seletor de mês (header)
const btnMonthFilterEl = document.getElementById('btn-month-filter');
const monthFilterPopoverEl = document.getElementById('month-filter-popover');
const monthFilterInputEl = document.getElementById('month-filter-input');
function openMonthPopover(){
  try {
    if (monthFilterPopoverEl) monthFilterPopoverEl.removeAttribute('hidden');
    if (monthFilterInputEl) monthFilterInputEl.value = selectedMonth;
  } catch {}
}
function closeMonthPopover(){
  try { monthFilterPopoverEl?.setAttribute('hidden',''); } catch {}
}
btnMonthFilterEl?.addEventListener('click', (e) => {
  e.stopPropagation();
  try {
    const isHidden = monthFilterPopoverEl?.hasAttribute('hidden');
    if (isHidden) openMonthPopover(); else closeMonthPopover();
  } catch {}
});
monthFilterInputEl?.addEventListener('change', async (e) => {
  const val = (e.target?.value || '').trim();
  if (!val) return;
  selectedMonth = val;
  storage.set('selectedMonth', selectedMonth);
  closeMonthPopover();
  try {
    await hydrateAllData();
  } catch {}
  try {
    const mg = await window.GoalsService?.fetchMonthlyGoalFor?.(selectedMonth);
    if (mg && mg.target_amount != null) {
      monthlyGoalsMap[selectedMonth] = Number(mg.target_amount)||0;
      storage.set('monthlyGoals', monthlyGoalsMap);
      // Atualiza imediatamente o campo da meta
      if (goalAmountEl) goalAmountEl.value = String(monthlyGoalsMap[selectedMonth] ?? '');
    } else {
      // Limpa se não houver meta
      if (goalAmountEl) goalAmountEl.value = '';
    }
  } catch {}
  renderAll();
});
document.addEventListener('click', (e) => {
  try {
    if (!monthFilterPopoverEl || monthFilterPopoverEl.hasAttribute('hidden')) return;
    const t = e.target;
    if (monthFilterPopoverEl.contains(t) || btnMonthFilterEl?.contains(t)) return;
    closeMonthPopover();
  } catch {}
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMonthPopover(); });
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

// Adiciona handlers de login/cadastro
formLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmailEl?.value?.trim();
  const password = loginPasswordEl?.value || '';
  authMsgEl && (authMsgEl.textContent = '');
  if (!email || !password) {
    authMsgEl && (authMsgEl.textContent = 'Informe email e senha');
    return;
  }
  try {
    if (!canUseSupabase() || !window.AuthService?.signIn) {
      throw new Error('Supabase não configurado');
    }
    await window.AuthService.signIn({ email, password });
    authMsgEl && (authMsgEl.textContent = 'Login realizado');
    // Navega para dashboard; roteador resolve e monta página
    location.hash = '#/dashboard';
  } catch (err) {
    const msg = (err && (err.message || err.error_description)) || 'Falha no login';
    authMsgEl && (authMsgEl.textContent = String(msg));
  }
});

formRegister?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = regNameEl?.value?.trim();
  const email = regEmailEl?.value?.trim();
  const password = regPasswordEl?.value || '';
  authMsgEl && (authMsgEl.textContent = '');
  if (!name || !email || !password) {
    authMsgEl && (authMsgEl.textContent = 'Preencha nome, email e senha');
    return;
  }
  try {
    if (!canUseSupabase() || !window.AuthService?.signUp) {
      throw new Error('Supabase não configurado');
    }
    await window.AuthService.signUp({ name, email, password });
    authMsgEl && (authMsgEl.textContent = 'Cadastro realizado');
    location.hash = '#/dashboard';
  } catch (err) {
    const msg = (err && (err.message || err.error_description)) || 'Falha no cadastro';
    authMsgEl && (authMsgEl.textContent = String(msg));
  }
});

// Alterna entre tabs login/cadastro
function showAuthTab(tab) {
  try {
    document.querySelectorAll('.tabs-trigger').forEach((el) => {
      const isActive = el.getAttribute('data-tab') === tab;
      el.classList.toggle('active', isActive);
    });
    document.querySelectorAll('.tabs-content').forEach((el) => {
      const isActive = el.getAttribute('data-tab') === tab;
      // Garantir compatibilidade com CSS [hidden]
      try { el.toggleAttribute('hidden', !isActive); } catch {}
      // Manter compatibilidade com estilos inline existentes
      el.style.display = isActive ? 'block' : 'none';
    });
    if (tab === 'login') {
      loginEmailEl?.focus();
    } else {
      regNameEl?.focus();
    }
  } catch {}
}

// Conectar cliques das abas de login/cadastro
try {
  document.querySelectorAll('.tabs-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') || 'login';
      showAuthTab(tab);
    });
  });
} catch {}

toggleToLoginEl?.addEventListener('click', () => showAuthTab('login'));

toggleToRegisterEl?.addEventListener('click', () => showAuthTab('register'));

// Gate simples na navegação
function isUuid(v){ return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
// Removido: syncLocalDataOnPageEnter (transferências automáticas). Hidratação centralizada via hydrateAllData.
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

  // Hidratar dados ao entrar em qualquer página (não bloquear UI)
  try { hydrateAllData().then(() => renderAll()).catch(()=>{}); } catch {}

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
  const root = document.body;
  if (route === 'auth') { root.classList.add('auth-mode'); try { closeDrawer(); } catch {} } else { root.classList.remove('auth-mode'); }
  updateAuthUI();
  renderAll();
}

navLinks.forEach(a => a.addEventListener('click', () => {
  // Não chamar showPage aqui; deixar o Router cuidar da navegação
  try { closeDrawer(); } catch {}
}));

// Exposição mínima para integração com roteador modular
window.App = window.App || {};
window.App.showPage = showPage;

// Drawer/Menu toggle logic
const sidebarEl = document.querySelector('.sidebar');
const drawerOverlayEl = document.getElementById('drawer-overlay') || document.querySelector('.drawer-overlay');

// Logout
btnLogoutEl?.addEventListener('click', async () => {
  try { await window.AuthService?.signOut?.(); } catch {}
  location.hash = '#/auth';
});

// Reage a mudanças de autenticação
window.addEventListener('auth:change', (ev) => {
  try { updateAuthUI(); } catch {}
  const user = ev?.detail?.user || null;
  if (user) {
    if ((location.hash || '#/auth') === '#/auth') {
      location.hash = '#/dashboard';
    }
    try { hydrateAllData().then(()=>renderAll()); } catch {}
  } else {
    location.hash = '#/auth';
  }
});

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
  if (txCategoryEl) {
    txCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (!txCategoryEl.value) txCategoryEl.value = categories[0]?.id || '';
  }
  // Prepara select de bancos
  if (txBankEl) {
    txBankEl.innerHTML = `<option value="">Dinheiro</option>` + banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (txDateEl && !txDateEl.value) txDateEl.value = todayISO();
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
      <td><button class="delete" data-id="${t.id}" type="button">Excluir</button></td>
    </tr>`;
  }).join('');
  if (tableTransactionsTbody) {
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
}

function renderCategories() {
  // seção de metas por categoria removida
  // grid
  if (!gridCategoriesEl) return;
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
  if (goalAmountEl) goalAmountEl.value = getSelectedMonthlyGoalAmount() || '';
}

// Visibilidade do campo de banco conforme tipo de transação
function updateBankVisibility(){
  try {
    if (!txBankGroupEl || !txTypeEl) return;
    const isExpense = String(txTypeEl.value) === 'expense';
    // Mostra o seletor de banco apenas para despesas
    txBankGroupEl.style.display = isExpense ? '' : 'none';
  } catch {}
}
// Mantém sincronizado quando o tipo muda
try { txTypeEl?.addEventListener('change', updateBankVisibility); } catch {}

// Renderização de bancos
function renderBanks() {
  const grid = document.getElementById('grid-banks');
  const banksCountEl = document.getElementById('banks-count');
  if (!grid) return;

  // Update count badge
  if (banksCountEl) {
    banksCountEl.textContent = String(banks.length);
  }

  grid.innerHTML = '';

  if (!banks || banks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhum banco cadastrado ainda';
    grid.appendChild(empty);
    return;
  }

  banks.forEach(b => {
    const card = document.createElement('div');
    card.className = 'bank-card';

    const header = document.createElement('div');
    header.className = 'bank-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'bank-name';
    nameEl.textContent = b.name;

    const actions = document.createElement('div');
    actions.className = 'bank-actions';

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.textContent = 'Excluir';
    btnDelete.addEventListener('click', async () => {
      try {
        if (window.env?.supabaseUrl && window.env?.supabaseAnonKey) {
          await window.BanksService?.deleteBank?.(b.id);
        }
      } catch (e) {
        console.error('Erro ao excluir banco (remoto):', e);
      }
      banks = banks.filter(x => x.id !== b.id);
      persist('banks', banks);
      renderBanks();
    });

    actions.appendChild(btnDelete);
    header.appendChild(nameEl);
    header.appendChild(actions);
    card.appendChild(header);

    grid.appendChild(card);
  });
}
// Bancos: submit de novo banco
formBank?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = bankNameEl?.value?.trim();
  if (!name) return;
  try {
    if (window.BanksService?.createBank) {
      const row = await window.BanksService.createBank({ name });
      banks = [row, ...banks];
      storage.set('banks', banks);
    }
  } catch (err) { console.warn('createBank error:', err); }
  if (bankNameEl) bankNameEl.value = '';
  renderAll();
});

function renderAll() {
  try {
    renderSummary();
    renderTransactions();
    renderCategories();
    renderGoals();
    renderBanks();
    if (typeof renderDashboard === 'function') { renderDashboard(); }
    ensureCategoryProgressCard();
  } catch (err) {
    console.warn('Falha ao renderizar:', err);
  }
}