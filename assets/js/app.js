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
// Removido: armazenamento local de dados do banco (migrado para Supabase)
// Mantemos localStorage apenas para estados de UI (ex.: cores recentes)

// Valor padrão para meta mensal quando não existe registro
const DEFAULT_MONTHLY_GOAL = 5000;

// Estado
let transactions = [];
let categories = [];
let banks = [];
let selectedMonth = getCurrentMonthKey();
let monthlyGoalsMap = {};
const getSelectedMonthlyGoalAmount = () => Number(monthlyGoalsMap[selectedMonth] ?? 0);

// Hidratação central de dados: sincroniza bancos do serviço (Supabase quando disponível)
async function hydrateAllData() {
  try {
    if (window.BanksService?.fetchBanks) {
      const items = await window.BanksService.fetchBanks();
      if (Array.isArray(items)) {
        banks = items.map(b => ({ id: b.id, name: b.name, icon: b.icon ?? null, color: b.color ?? null }));
      }
    }
  } catch (e) {
    console.warn('hydrateAllData(banks) error:', e);
  }
  try {
    if (window.CategoriesService?.fetchCategories) {
      const items = await window.CategoriesService.fetchCategories();
      if (Array.isArray(items)) {
        categories = items.map(c => ({ id: c.id, name: c.name, color: c.color ?? '#6200ee' }));
      }
    }
  } catch (e) {
    console.warn('hydrateAllData(categories) error:', e);
  }
  try {
    if (window.TransactionsService?.fetchTransactionsByMonth) {
      const rows = await window.TransactionsService.fetchTransactionsByMonth(selectedMonth);
      if (Array.isArray(rows)) {
        transactions = rows.map(mapDbTransactionToLocal);
      }
    } else if (window.TransactionsService?.fetchTransactions) {
      const rows = await window.TransactionsService.fetchTransactions();
      if (Array.isArray(rows)) {
        transactions = rows.map(mapDbTransactionToLocal);
      }
    }
  } catch (e) {
    console.warn('hydrateAllData(transactions) error:', e);
  }
  try {
    if (window.GoalsService?.fetchMonthlyGoalFor) {
      const mg = await window.GoalsService.fetchMonthlyGoalFor(selectedMonth);
      if (mg && mg.target_amount != null) {
        monthlyGoalsMap[selectedMonth] = Number(mg.target_amount) || 0;
      } else {
        // se não houver meta, mantém mapa sem valor para cair no default
      }
    }
  } catch (e) {
    console.warn('hydrateAllData(goals) error:', e);
  }
}

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
// Utilidades de data em formato BR
function formatDateBRFromISO(iso) {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function parseDateBRToISO(str) {
  const m = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(String(str || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
function todayBR() { return formatDateBRFromISO(); }
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

// Overlay global de carregamento
let __loadingOverlayEl = null;
function ensureLoadingOverlay() {
  if (__loadingOverlayEl) return __loadingOverlayEl;
  const el = document.createElement('div');
  el.id = 'global-loading-overlay';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.background = 'rgba(0,0,0,0.35)';
  el.style.display = 'none';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.zIndex = '9999';
  el.innerHTML = '<div class="loading-card"><div class="spinner"></div><div id="loading-text">Carregando...</div></div>';
  document.body.appendChild(el);
  __loadingOverlayEl = el;
  return el;
}
function showLoading(text = 'Carregando...') {
  const el = ensureLoadingOverlay();
  try { el.querySelector('#loading-text').textContent = text; } catch {}
  el.style.display = 'flex';
}
function hideLoading() {
  if (__loadingOverlayEl) __loadingOverlayEl.style.display = 'none';
}

// Formulários
const formTx = document.getElementById('form-transaction');
const txDescriptionEl = document.getElementById('tx-description');
const txAmountEl = document.getElementById('tx-amount');
const txDateEl = document.getElementById('tx-date');
const txTypeEl = document.getElementById('tx-type');
// Preencher data padrão imediatamente (robusto independente de renderTransactions)
try { if (txDateEl && !txDateEl.value) { txDateEl.value = todayISO(); } } catch {}
const txCategoryEl = document.getElementById('tx-category');
const txBankEl = document.getElementById('tx-bank');
const txBankGroupEl = document.getElementById('tx-bank-group');
const listTransactionsEl = document.getElementById('list-transactions');
// Elementos do dropdown pesquisável de categorias
const catPickerEl = document.getElementById('tx-category-picker');
const catFilterEl = document.getElementById('tx-category-filter');
const catListEl = document.getElementById('tx-category-list');
const formCat = document.getElementById('form-category');
const catNameEl = document.getElementById('cat-name');
const catColorEl = document.getElementById('cat-color');
const gridCategoriesEl = document.getElementById('grid-categories');
// Popup central com botão gatilho e cores recentes
try {
  const btnOpenColorEl = document.getElementById('btn-open-color');
  const colorDotEl = document.getElementById('color-dot');
  const popupEl = document.getElementById('cat-color-popup');
  const customColorEl = document.getElementById('cat-color-custom');
  const applyBtnEl = document.getElementById('btn-color-apply');
  const overlayEl = document.getElementById('color-overlay');
  const announceEl = document.getElementById('color-announce');
  const colorsContainerEl = popupEl.querySelector('.color-options');
  let tempColor = null;
  const DEFAULT_COLORS = ['#6200ee','#ff6b6b','#ffd166','#06d6a0','#118ab2','#8338ec','#ff9f1c','#2ec4b6','#e0e0e0','#3a86ff','#8d99ae','#ef476f'];
  const getRecentColors = () => {
    try {
      const arr = JSON.parse(localStorage.getItem('recentCategoryColors')||'[]');
      return Array.isArray(arr) && arr.length ? arr.slice(0,12) : DEFAULT_COLORS.slice(0,12);
    } catch { return DEFAULT_COLORS.slice(0,12); }
  };
  const setRecentColors = (arr) => localStorage.setItem('recentCategoryColors', JSON.stringify(arr.slice(0,12)));
  const pushRecentColor = (color) => {
    if (!color) return;
    let arr = getRecentColors();
    // FIFO: adiciona a nova cor no início e, se exceder 12, remove a mais antiga (final)
    arr = [color, ...arr];
    if (arr.length > 12) arr = arr.slice(0, 12);
    setRecentColors(arr);
    renderRecentColors();
  };
  const renderRecentColors = () => {
    if (!colorsContainerEl) return;
    const arr = getRecentColors();
    colorsContainerEl.innerHTML = '';
    arr.forEach((color) => {
      const btn = document.createElement('button');
      btn.className = 'color-swatch';
      btn.setAttribute('data-color', color);
      btn.style.backgroundColor = color;
      btn.addEventListener('click', () => {
        tempColor = color;
        colorsContainerEl.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateApplyPreview(tempColor);
        if (catColorEl) catColorEl.value = tempColor; // refletir em tempo real
        if (announceEl) announceEl.textContent = `Cor selecionada ${color}`;
      });
      colorsContainerEl.appendChild(btn);
    });
  };
  const updateApplyPreview = (color) => {
    if (!applyBtnEl) return;
    // Não alterar o fundo do botão (conforme requisito)
    applyBtnEl.style.backgroundColor = '';
    // Borda sólida de no mínimo 3px e cor igual ao input em tempo real
    applyBtnEl.style.borderStyle = 'solid';
    applyBtnEl.style.borderWidth = '3px';
    if (color) {
      applyBtnEl.style.borderColor = color;
    }
  };
  // Restaura última cor
  const lastColor = localStorage.getItem('lastCategoryColor');
  if (lastColor && catColorEl) {
    catColorEl.value = lastColor;
    colorDotEl && (colorDotEl.style.backgroundColor = lastColor);
    customColorEl && (customColorEl.value = lastColor);
    updateApplyPreview(lastColor);
  } else if (catColorEl && colorDotEl) {
    colorDotEl.style.backgroundColor = catColorEl.value || '#6200ee';
    updateApplyPreview(catColorEl.value || '#6200ee');
  }
  renderRecentColors();
  const ensureInBody = () => {
    try {
      if (overlayEl && overlayEl.parentNode !== document.body) document.body.appendChild(overlayEl);
      if (popupEl && popupEl.parentNode !== document.body) document.body.appendChild(popupEl);
      if (popupEl) popupEl.style.position = 'fixed';
      if (overlayEl) overlayEl.style.position = 'fixed';
    } catch {}
  };
  const positionPopupCenteredToContent = () => {
    try {
      const container = document.querySelector('.page-container') || document.body;
      const rect = container.getBoundingClientRect();
      const centerX = Math.round(rect.left + rect.width / 2 + window.scrollX);
      const centerY = Math.round(window.scrollY + window.innerHeight / 2);
      popupEl.style.left = `${centerX}px`;
      popupEl.style.top = `${centerY}px`;
      popupEl.style.transform = 'translate(-50%, -50%)';
      popupEl.style.right = 'auto';
      popupEl.style.bottom = 'auto';
    } catch {}
  };
  const openPopup = () => {
    if (!popupEl) return;
    ensureInBody();
    positionPopupCenteredToContent();
    popupEl.hidden = false;
    popupEl.classList.add('show');
    overlayEl && (overlayEl.hidden = false, overlayEl.classList.add('show'));
    btnOpenColorEl && btnOpenColorEl.setAttribute('aria-expanded','true');
    const firstInteractive = popupEl.querySelector('.color-swatch') || customColorEl;
    if (firstInteractive && firstInteractive.focus) firstInteractive.focus();
    if (announceEl) announceEl.textContent = 'Seleção de cor aberta';
  };
  const closePopup = () => {
    if (!popupEl) return;
    popupEl.classList.remove('show');
    popupEl.hidden = true;
    overlayEl && (overlayEl.classList.remove('show'), overlayEl.hidden = true);
    btnOpenColorEl && btnOpenColorEl.setAttribute('aria-expanded','false');
    if (announceEl) announceEl.textContent = 'Seleção de cor fechada';
  };
  // Abrir via botão gatilho
  btnOpenColorEl?.addEventListener('click', () => openPopup());
  // Fechar ao clicar fora
  overlayEl?.addEventListener('click', () => closePopup());
  // Seleção via swatches da paleta fixa
  // Substituída por lista dinâmica de 12 cores de histórico criada em renderRecentColors()
  popupEl?.querySelectorAll('.color-options .color-swatch')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      tempColor = color;
      popupEl.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateApplyPreview(tempColor);
      if (catColorEl) catColorEl.value = tempColor; // refletir em tempo real
      if (announceEl) announceEl.textContent = `Cor selecionada ${color}`;
    });
  });
  // Seleção via input de cor personalizado em tempo real
  customColorEl?.addEventListener('input', () => {
    tempColor = customColorEl.value;
    updateApplyPreview(tempColor);
    if (catColorEl) catColorEl.value = tempColor; // refletir em tempo real
  });
  // Confirmar
  applyBtnEl?.addEventListener('click', () => {
    const chosen = tempColor || customColorEl?.value || catColorEl?.value;
    if (chosen && catColorEl) {
      catColorEl.value = chosen;
      localStorage.setItem('lastCategoryColor', chosen);
      pushRecentColor(chosen);
      colorDotEl && (colorDotEl.style.backgroundColor = chosen);
      try { catColorEl.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
      try { showCategoriesFeedback('Cor confirmada', 'success'); } catch {}
      if (announceEl) announceEl.textContent = `Cor confirmada ${chosen}`;
    }
    closePopup();
  });
  // Fechar com ESC
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup(); });
  // Reposicionar ao redimensionar
  window.addEventListener('resize', () => { if (!popupEl?.hidden) positionPopupCenteredToContent(); });
} catch {}
const formMonthlyGoal = document.getElementById('form-monthly-goal');

// Categorias: submit de nova categoria
formCat?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = catNameEl?.value?.trim();
  const color = catColorEl?.value || '#6200ee';
  if (!name) return;
  showLoading('Salvando categoria...');
  try {
    const row = await window.CategoriesService?.createCategory?.({ name, color });
    try {
      const refreshed = await window.CategoriesService?.fetchCategories?.();
      categories = Array.isArray(refreshed) ? refreshed : [row, ...categories];
    } catch {
      categories = [row, ...categories];
    }
  } catch (err) { console.warn('createCategory error:', err); }
  hideLoading();
  if (catNameEl) catNameEl.value = '';
  renderCategories();
  const el = document.getElementById('categories-feedback');
  if (el) {
    el.textContent = `Categoria "${name}" adicionada com sucesso`;
    el.classList.remove('success', 'error');
    el.classList.add('success');
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, 2500);
  }
  try { window.StateMonitor?.markWrite?.('categories'); } catch {}
});
const goalAmountEl = document.getElementById('goal-amount');
// Metas mensais: submit para salvar/atualizar
formMonthlyGoal?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const amount = Number(goalAmountEl?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    showLoading('Salvando meta...');
    const saved = await window.GoalsService?.saveMonthlyGoalFor?.(selectedMonth, amount);
    const finalAmount = Number(saved?.target_amount ?? amount) || 0;
    monthlyGoalsMap[selectedMonth] = finalAmount;
    renderGoals();
    renderSummary();
    showGoalsFeedback('Meta atualizada com sucesso', 'success');
    try { window.StateMonitor?.markWrite?.('goals'); } catch {}
  } catch (err) {
    console.warn('saveMonthlyGoalFor error:', err);
    showGoalsFeedback('Falha ao atualizar meta', 'error');
  } finally {
    hideLoading();
  }
});

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
  closeMonthPopover();
  showLoading('Carregando mês...');
  try {
    await hydrateAllData();
  } catch {}
  try {
    const mg = await window.GoalsService?.fetchMonthlyGoalFor?.(selectedMonth);
    if (mg && mg.target_amount != null) {
      monthlyGoalsMap[selectedMonth] = Number(mg.target_amount)||0;
      if (goalAmountEl) goalAmountEl.value = String(monthlyGoalsMap[selectedMonth] ?? '');
    } else {
      monthlyGoalsMap[selectedMonth] = 0; // sem meta cadastrada para o mês
      if (goalAmountEl) goalAmountEl.value = '';
    }
  } catch {
    monthlyGoalsMap[selectedMonth] = 0; // erro ao buscar: assume zero
    if (goalAmountEl) goalAmountEl.value = '';
  }
  try { renderAll(); } catch {}
  hideLoading();
});
document.addEventListener('click', (e) => {
  try {
    if (!monthFilterPopoverEl || monthFilterPopoverEl.hasAttribute('hidden')) return;
    const t = e.target;
    if (monthFilterPopoverEl.contains(t) || btnMonthFilterEl?.contains(t)) return;
    closeMonthPopover();
  } catch {}
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMonthPopover(); try { document.querySelectorAll('.tooltip.open').forEach(el => { el.classList.remove('open'); el.previousElementSibling?.setAttribute('aria-expanded','false'); }); } catch {} } });
// Tooltips: largura dinâmica e clique para alternar (mobile); hover via CSS
function setTooltipMaxWidth(icon, tip) {
  try {
    const iconRect = icon.getBoundingClientRect();
    const card = icon.closest('.stat-card');
    const cardRect = card ? card.getBoundingClientRect() : { width: 300 };
    const minWidth = Math.floor(cardRect.width * 2 / 3);
    const availableLeft = Math.max(160, Math.floor(iconRect.right - 8));
    const maxWidth = Math.min(availableLeft, Math.floor(window.innerWidth - 16));
    const finalMin = Math.min(minWidth, maxWidth);
    const finalWidth = Math.max(finalMin, Math.min(cardRect.width, maxWidth));
    tip.style.minWidth = finalMin + 'px';
    tip.style.maxWidth = maxWidth + 'px';
    tip.style.width = finalWidth + 'px';
    tip.style.whiteSpace = 'normal';
    tip.style.wordBreak = 'break-word';
    tip.style.overflowWrap = 'anywhere';
  } catch {}
}
document.addEventListener('click', (e) => {
  try {
    const icon = e.target.closest('.info-icon');
    if (icon) {
      const tipId = icon.getAttribute('aria-controls') || icon.getAttribute('aria-describedby');
      const tip = tipId ? document.getElementById(tipId) : icon.nextElementSibling;
      if (tip && tip.classList.contains('tooltip')) {
        const isOpen = tip.classList.contains('open');
        document.querySelectorAll('.tooltip.open').forEach(el => {
          el.classList.remove('open');
          el.previousElementSibling?.setAttribute('aria-expanded','false');
        });
        if (!isOpen) {
          tip.classList.add('open');
          icon.setAttribute('aria-expanded', 'true');
          setTooltipMaxWidth(icon, tip);
        }
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    // Fechar tooltips abertas ao clicar fora
    document.querySelectorAll('.tooltip.open').forEach(el => {
      if (!el.contains(e.target)) {
        el.classList.remove('open');
        el.previousElementSibling?.setAttribute('aria-expanded','false');
      }
    });
  } catch {}
});
try {
  document.querySelectorAll('.info-icon').forEach((icon) => {
    const tipId = icon.getAttribute('aria-controls') || icon.getAttribute('aria-describedby');
    const tip = tipId ? document.getElementById(tipId) : icon.nextElementSibling;
    icon.addEventListener('mouseenter', () => { if (tip) setTooltipMaxWidth(icon, tip); });
    icon.addEventListener('focus', () => { if (tip) setTooltipMaxWidth(icon, tip); });
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.info-icon').forEach((icon) => {
      const tipId = icon.getAttribute('aria-controls') || icon.getAttribute('aria-describedby');
      const tip = tipId ? document.getElementById(tipId) : icon.nextElementSibling;
      if (tip && tip.classList.contains('open')) setTooltipMaxWidth(icon, tip);
    });
  });
  // Fallback de polling quando realtime não estiver ativo
  let __pollTimer = null;
  window.addEventListener('db:subscription', (ev) => {
    const status = ev?.detail?.status;
    if (status === 'SUBSCRIBED') {
      if (__pollTimer) { clearInterval(__pollTimer); __pollTimer = null; }
    } else {
      if (!__pollTimer) {
        __pollTimer = setInterval(async () => {
          try {
            await hydrateAllData();
            renderAll();
            if (currentRoute === 'transactions') {
              try { await loadTransactionsPage(transactionsPage); } catch {}
            }
          } catch {}
        }, 5000);
      }
    }
  });
} catch {}

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

// Dashboard: renderização de meta, progresso e gráficos
function renderDashboard() {
  try {
    const spent = monthlyExpenses();
    const goal = getSelectedMonthlyGoalAmount();
    const remaining = remainingBudget();

    if (goalSpentLargeEl) goalSpentLargeEl.textContent = formatCurrency(spent);
    if (goalMetaLargeEl) goalMetaLargeEl.textContent = formatCurrency(goal);
    if (goalRemainingTextEl) {
      const rem = Math.max(0, Number(remaining) || 0);
      goalRemainingTextEl.textContent = `Restante: ${formatCurrency(rem)}`;
    }

    const progress = Math.max(0, Math.min(100, Number(budgetProgress()) || 0));
    if (progressFillEl) {
      progressFillEl.style.width = `${progress}%`;
      // Gradiente multicolor proporcional às despesas por categoria no mês
      try {
        const map = expensesByCat();
        const entries = Object.entries(map).filter(([k, v]) => k != null && Number(v) > 0);
        const total = entries.reduce((s, [, v]) => s + Number(v), 0);
        if (total > 0 && entries.length > 0) {
          const sorted = entries.sort((a, b) => Number(b[1]) - Number(a[1]));
          let acc = 0;
          const stops = [];
          for (const [catId, val] of sorted) {
            const part = (Number(val) / total) * 100;
            const start = acc;
            const end = acc + part;
            const cat = categories.find(c => String(c.id) === String(catId));
            const color = cat?.color || '#9ca3af';
            stops.push(`${color} ${start.toFixed(2)}%`, `${color} ${end.toFixed(2)}%`);
            acc = end;
          }
          progressFillEl.style.backgroundImage = `linear-gradient(to right, ${stops.join(', ')})`;
          progressFillEl.style.backgroundColor = '';
        } else {
          progressFillEl.style.backgroundImage = '';
          progressFillEl.style.backgroundColor = '#3b82f6';
        }
      } catch {
        progressFillEl.style.backgroundImage = '';
        progressFillEl.style.backgroundColor = '#3b82f6';
      }
    }
    if (progressPercentEl) {
      const pctStr = Number.isFinite(progress) ? Number(progress).toFixed(1) : '0.0';
      progressPercentEl.textContent = `Progresso: ${pctStr}%`;
    }
    if (progressWarningEl) {
      const over = (goal > 0) && (spent > goal);
      progressWarningEl.hidden = !over;
      if (over) progressWarningEl.textContent = 'Atenção: meta excedida';
    }
    if (progressSpentEl) progressSpentEl.textContent = `Gasto: ${formatCurrency(spent)}`;
    if (progressGoalEl) progressGoalEl.textContent = `Meta: ${formatCurrency(goal)}`;

    // Gráficos mínimos em canvas
    drawIncomeVsExpense();
    drawPieExpensesByCategory();
    drawPieExpensesByBank();
  } catch (e) {
    console.warn('renderDashboard error:', e);
  }
}

function drawIncomeVsExpense() {
  const canvas = document.getElementById('bar-income-vs-expense');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth || 320);
  const h = (canvas.height = canvas.clientHeight || 160);
  ctx.clearRect(0, 0, w, h);

  // Gráfico: Gastos vs Meta para os últimos 6 meses (pares de barras)
  const months = [];
  let mk = getCurrentMonthKey();
  for (let i = 0; i < 6; i++) { months.push(mk); mk = getPrevMonthKey(mk); }

  const expensesForMonth = (monthKey) => {
    const [yy, mm] = monthKey.split('-').map(Number);
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return (d.getFullYear() === yy) && ((d.getMonth()+1) === mm) && t.type === 'expense';
      })
      .reduce((s, t) => s + Number(t.amount), 0);
  };
  const goalForMonth = (monthKey) => Number(monthlyGoalsMap[monthKey] ?? DEFAULT_MONTHLY_GOAL);

  const data = months.map(m => ({ m, expense: expensesForMonth(m), goal: goalForMonth(m) }));
  const maxVal = Math.max(...data.map(d => Math.max(d.expense, d.goal)), 1);

  const paddingTop = 20, paddingBottom = 24;
  const baseY = h - paddingBottom;
  const scale = (h - paddingTop - paddingBottom) / maxVal;

  // Ajuste de espaçamento: margem externa e espaçamento entre pares
  const outerPaddingX = 12;
  const availableW = Math.max(60, w - outerPaddingX * 2);
  const pairSpacing = Math.floor(availableW / months.length);
  const barW = Math.max(10, Math.min(28, Math.floor(pairSpacing * 0.35)));
  const innerGap = Math.max(2, Math.min(6, Math.floor(barW * 0.15)));

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = '11px system-ui, sans-serif';

  const rects = [];
  const pairs = [];

  months.forEach((m, i) => {
    // xCenter calculado da direita para a esquerda: mês mais recente no extremo direito
    const xCenter = outerPaddingX + availableW - pairSpacing * (i + 0.5);
    const { expense, goal } = data[i];

    const goalH = Math.round(goal * scale);
    const expH = Math.round(expense * scale);

    // Meta (barra esquerda do par)
    const goalX = xCenter - innerGap - barW;
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(goalX, baseY - goalH, barW, goalH);
    rects.push({ type: 'goal', month: m, value: goal, x: goalX, y: baseY - goalH, w: barW, h: goalH });

    // Gastos (barra direita do par)
    const expX = xCenter + innerGap;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(expX, baseY - expH, barW, expH);
    rects.push({ type: 'expense', month: m, value: expense, x: expX, y: baseY - expH, w: barW, h: expH });

    // Registrar grupo do par
    const left = Math.min(goalX, expX);
    const right = Math.max(goalX + barW, expX + barW);
    const top = Math.min(baseY - goalH, baseY - expH);
    pairs.push({ month: m, goal, expense, xCenter, left, right, top, baseY });

    // Label do mês
    const [yy, mm] = m.split('-');
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${mm}/${String(yy).slice(-2)}`, xCenter, h - 6);
  });

  // Linha de base
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(outerPaddingX, baseY + 0.5);
  ctx.lineTo(w - outerPaddingX, baseY + 0.5);
  ctx.stroke();

  // Tooltips interativos por PAR (hover desktop, click mobile) com orientação e limites
  canvas._barRects = rects;
  canvas._pairs = pairs;
  if (!canvas._tooltipBound) {
    canvas._tooltipBound = true;

    const ensureTip = () => {
      let tip = document.getElementById('chart-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 'chart-tooltip';
        tip.className = 'tooltip';
        tip.style.position = 'fixed';
        tip.style.pointerEvents = 'none'; // não bloquear toques no mobile
        tip.style.zIndex = '1000';
        document.body.appendChild(tip);
      }
      return tip;
    };
    const tip = ensureTip();
    const hideTip = () => tip.classList.remove('open');

    const findHit = (ev) => {
      const cRect = canvas.getBoundingClientRect();
      // Normaliza coordenadas para mouse, touch e pointer
      const norm = (() => {
        if (ev && ev.touches && ev.touches.length) {
          return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        }
        if (ev && ev.changedTouches && ev.changedTouches.length) {
          return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        }
        const x = (typeof ev.clientX === 'number') ? ev.clientX : (typeof ev.pageX === 'number' ? ev.pageX - window.scrollX : 0);
        const y = (typeof ev.clientY === 'number') ? ev.clientY : (typeof ev.pageY === 'number' ? ev.pageY - window.scrollY : 0);
        return { x, y };
      })();
      const cx = norm.x - cRect.left;
      const cy = norm.y - cRect.top;
      // primeiro tenta achar uma barra
      for (let i = 0; i < canvas._barRects.length; i++) {
        const r = canvas._barRects[i];
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
          const pIndex = canvas._pairs.findIndex(p => p.month === r.month);
          return { index: pIndex, pair: canvas._pairs[pIndex], cRect };
        }
      }
      // se não achou, tenta região do par
      for (let i = 0; i < canvas._pairs.length; i++) {
        const p = canvas._pairs[i];
        if (cx >= p.left && cx <= p.right && cy >= p.top && cy <= p.baseY) {
          return { index: i, pair: p, cRect };
        }
      }
      return { index: -1, pair: null, cRect };
    };

    const showTipForPair = (pair, cRect) => {
      const absLeft = cRect.left + pair.left;
      const absRight = cRect.left + pair.right;
      const absTop = cRect.top + pair.top;
      const viewportCenter = window.innerWidth / 2;
      const absCenter = cRect.left + pair.xCenter;
      const orientation = absCenter < viewportCenter ? 'ltr' : 'rtl';

      const percent = pair.goal > 0 ? (pair.expense / pair.goal) * 100 : null;
      tip.innerHTML = `Meta: ${formatCurrency(pair.goal)}<br>Gasto: ${formatCurrency(pair.expense)}${percent !== null ? ` (${percent.toFixed(1)}%)` : ''}`;

      // Primeiro define lado e largura máxima para não ultrapassar a tela
      if (orientation === 'rtl') {
        const rightPx = Math.max(8, window.innerWidth - absRight + 8);
        tip.style.right = rightPx + 'px';
        tip.style.left = 'auto';
        const availableLeft = absRight - 8;
        tip.style.maxWidth = Math.max(140, Math.min(360, availableLeft)) + 'px';
      } else {
        const leftPx = Math.max(8, absLeft - 8);
        tip.style.left = leftPx + 'px';
        tip.style.right = 'auto';
        const availableRight = window.innerWidth - absLeft - 8;
        tip.style.maxWidth = Math.max(140, Math.min(360, availableRight)) + 'px';
      }

      // Torna visível para medir altura e ajustar top
      tip.classList.add('open');
      const tipH = tip.offsetHeight || 28;
      const topPx = Math.max(8, absTop - tipH - 8);
      tip.style.top = topPx + 'px';
    };

    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (hasHover) {
      canvas.addEventListener('mousemove', (ev) => {
        const { index, pair, cRect } = findHit(ev);
        if (index >= 0) {
          showTipForPair(pair, cRect);
        } else {
          hideTip();
        }
      });
      canvas.addEventListener('mouseleave', hideTip);
    }

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouch) {
      const handleTap = (ev) => {
        const { index, pair, cRect } = findHit(ev);
        if (index >= 0) {
          showTipForPair(pair, cRect);
        } else {
          hideTip();
        }
      };
      // Suporte amplo: 'touchstart' e 'click'
      canvas.addEventListener('touchstart', handleTap, { passive: true });
      canvas.addEventListener('click', handleTap);
      // Fecha ao tocar fora
      const closeOnOutside = (ev) => {
        const cRect = canvas.getBoundingClientRect();
        const getXY = () => {
          if (ev && ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
          if (ev && ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
          const x = (typeof ev.clientX === 'number') ? ev.clientX : (typeof ev.pageX === 'number' ? ev.pageX - window.scrollX : 0);
          const y = (typeof ev.clientY === 'number') ? ev.clientY : (typeof ev.pageY === 'number' ? ev.pageY - window.scrollY : 0);
          return { x, y };
        };
        const { x, y } = getXY();
        const insideCanvas = x >= cRect.left && x <= cRect.right && y >= cRect.top && y <= cRect.bottom;
        if (!insideCanvas) hideTip();
      };
      document.addEventListener('touchstart', closeOnOutside, { passive: true });
      document.addEventListener('click', closeOnOutside);
    }
  }
}

function drawPieFromMap(canvasId, map, colorGetter, labelGetter = (key) => String(key)) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth || 240);
  const h = (canvas.height = canvas.clientHeight || 240);
  ctx.clearRect(0, 0, w, h);

  const entries = Object.entries(map).filter(([_, v]) => Number(v) > 0);
  const total = entries.reduce((s, [, v]) => s + Number(v), 0);
  if (!entries.length || total <= 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem dados', w / 2, h / 2);
    return;
  }

  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 10;
  const slices = [];
  let start = -Math.PI / 2;
  entries.forEach(([key, val], idx) => {
    const value = Number(val);
    const frac = value / total;
    const end = start + frac * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    const color = colorGetter(key, idx);
    ctx.fillStyle = color;
    ctx.fill();
    slices.push({ key, label: labelGetter(key), value, start, end, frac });
    start = end;
  });

  // Interação: hover (desktop) e toque/click (mobile)
  const ensureTip = () => {
    let tip = document.getElementById('chart-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'chart-tooltip';
      tip.className = 'tooltip';
      tip.style.position = 'fixed';
      tip.style.pointerEvents = 'none';
      tip.style.zIndex = '1000';
      document.body.appendChild(tip);
    }
    return tip;
  };
  const tip = ensureTip();
  const hideTip = () => tip.classList.remove('open');

  const findSlice = (ev) => {
    const cRect = canvas.getBoundingClientRect();
    const getXY = () => {
      if (ev && ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
      if (ev && ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
      const x = (typeof ev.clientX === 'number') ? ev.clientX : (typeof ev.pageX === 'number' ? ev.pageX - window.scrollX : 0);
      const y = (typeof ev.clientY === 'number') ? ev.clientY : (typeof ev.pageY === 'number' ? ev.pageY - window.scrollY : 0);
      return { x, y };
    };
    const { x, y } = getXY();
    const lx = x - cRect.left;
    const ly = y - cRect.top;
    const dx = lx - cx;
    const dy = ly - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > r || dist < 0) return { index: -1, slice: null, cRect };
    let ang = Math.atan2(dy, dx); // [-PI, PI]
    // normaliza para nosso sistema (com início em -PI/2)
    // Não precisa converter; basta comparar com start/end diretamente
    for (let i = 0; i < slices.length; i++) {
      const s = slices[i];
      // trata wrap de ângulo
      if (ang >= s.start && ang <= s.end) return { index: i, slice: s, cRect };
    }
    return { index: -1, slice: null, cRect };
  };

  const showTipForSlice = (slice, cRect) => {
    const mid = (slice.start + slice.end) / 2;
    const px = cRect.left + cx + Math.cos(mid) * (r * 0.7);
    const py = cRect.top + cy + Math.sin(mid) * (r * 0.7);
    const orientation = (px < (window.innerWidth / 2)) ? 'ltr' : 'rtl';

    const pct = (slice.value / total) * 100;
    tip.innerHTML = `${slice.label}: ${formatCurrency(slice.value)} (${pct.toFixed(1)}%)`;

    tip.classList.add('open');
    const tipW = tip.offsetWidth || 160;
    const tipH = tip.offsetHeight || 28;
    const leftPad = 8, rightPad = 8, topPad = 8;

    if (orientation === 'rtl') {
      const rightPx = Math.max(rightPad, window.innerWidth - px + rightPad);
      tip.style.right = rightPx + 'px';
      tip.style.left = 'auto';
      const availableLeft = px - rightPad;
      tip.style.maxWidth = Math.max(140, Math.min(360, availableLeft)) + 'px';
    } else {
      const leftPx = Math.max(leftPad, px - leftPad);
      tip.style.left = leftPx + 'px';
      tip.style.right = 'auto';
      const availableRight = window.innerWidth - px - rightPad;
      tip.style.maxWidth = Math.max(140, Math.min(360, availableRight)) + 'px';
    }
    const topPx = Math.max(topPad, py - tipH - 10);
    tip.style.top = topPx + 'px';
  };

  // Bind handlers por canvas
  const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  if (hasHover) {
    canvas.addEventListener('mousemove', (ev) => {
      const { index, slice, cRect } = findSlice(ev);
      if (index >= 0) {
        showTipForSlice(slice, cRect);
      } else {
        hideTip();
      }
    });
    canvas.addEventListener('mouseleave', hideTip);
  }
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch) {
    const handleTap = (ev) => {
      const { index, slice, cRect } = findSlice(ev);
      if (index >= 0) showTipForSlice(slice, cRect); else hideTip();
    };
    canvas.addEventListener('touchstart', handleTap, { passive: true });
    canvas.addEventListener('click', handleTap);
    const closeOnOutside = (ev) => {
      const cRect = canvas.getBoundingClientRect();
      const getXY = () => {
        if (ev && ev.touches && ev.touches.length) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY };
        if (ev && ev.changedTouches && ev.changedTouches.length) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
        const x = (typeof ev.clientX === 'number') ? ev.clientX : (typeof ev.pageX === 'number' ? ev.pageX - window.scrollX : 0);
        const y = (typeof ev.clientY === 'number') ? ev.clientY : (typeof ev.pageY === 'number' ? ev.pageY - window.scrollY : 0);
        return { x, y };
      };
      const { x, y } = getXY();
      const inside = x >= cRect.left && x <= cRect.right && y >= cRect.top && y <= cRect.bottom;
      if (!inside) hideTip();
    };
    document.addEventListener('touchstart', closeOnOutside, { passive: true });
    document.addEventListener('click', closeOnOutside);
  }
}

function drawPieExpensesByCategory() {
  const map = expensesByCat();
  const colorGetter = (key, idx) => {
    const cat = categories.find(c => String(c.id) === String(key));
    const base = cat?.color || ['#3b82f6','#f59e0b','#10b981','#ef4444','#6366f1','#14b8a6','#f43f5e','#84cc16'][idx % 8];
    return hexToRgba(base, 0.8);
  };
  const labelGetter = (key) => {
    const cat = categories.find(c => String(c.id) === String(key));
    return cat?.name || 'Sem categoria';
  };
  drawPieFromMap('pie-expenses-by-category', map, colorGetter, labelGetter);
}

function drawPieExpensesByBank() {
  const map = expensesByBank();
  const colorGetter = (_key, idx) => {
    const palette = ['#0ea5e9','#f97316','#22c55e','#eab308','#a855f7','#06b6d4','#ef4444','#84cc16'];
    return hexToRgba(palette[idx % palette.length], 0.8);
  };
  const labelGetter = (key) => {
    const bank = banks.find(b => String(b.id) === String(key));
    return bank?.name || 'Banco';
  };
  drawPieFromMap('pie-expenses-by-bank', map, colorGetter, labelGetter);
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
  try { closeDrawer(); } catch {}
  if (route === 'auth') { root.classList.add('auth-mode'); } else { root.classList.remove('auth-mode'); }
  updateAuthUI();
  renderAll();
  if (route === 'transactions') {
    try { loadTransactionsPage(1); } catch {}
  }
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
  // Prepara selects
  if (txCategoryEl) {
    txCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (!txCategoryEl.value) txCategoryEl.value = categories[0]?.id || '';
  }
  if (txBankEl) {
    txBankEl.innerHTML = `<option value="">Dinheiro</option>` + banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (txDateEl && !txDateEl.value) txDateEl.value = todayISO();
  updateBankVisibility();

  // Cards de transações do mês
  const cards = currentMonthTransactions().map(t => {
    const cat = categories.find(c => String(c.id) === String(t.categoryId));
    const bank = banks.find(b => String(b.id) === String(t.bankId));
    const isIncome = t.type === 'income';
    const icon = isIncome
      ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"></path></svg>`
      : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7l-6 6-4-4-8 8"></path></svg>`;
    const bankLabel = bank?.name ? bank.name : (!isIncome ? 'Dinheiro' : '');
    const meta = [
      new Date(t.date).toLocaleDateString('pt-BR'),
      cat?.name || 'Sem categoria',
      bankLabel
    ].filter(Boolean).map(x => `<span>${x}</span>`).join('');
    const amountHtml = `<span class="tx-amount ${isIncome?'income':'expense'}">${isIncome?'+':'-'} ${formatCurrency(t.amount)}</span>`;
    return `
      <div class="tx-card">
        <div class="tx-left">
          <div class="tx-icon ${isIncome?'income':'expense'}">${icon}</div>
          <div class="tx-info">
            <p class="tx-title">${t.description}</p>
            <div class="tx-meta">${meta}</div>
          </div>
        </div>
        <div class="tx-right">
          ${amountHtml}
          <button class="tx-delete action delete" data-id="${t.id}" type="button" aria-label="Excluir">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('');

  if (listTransactionsEl) {
    listTransactionsEl.innerHTML = cards || `<div class="muted" style="text-align:center">Nenhuma transação registrada neste mês</div>`;
    // Ações de excluir (delegação em captura para bloquear handlers paralelos)
    listTransactionsEl.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest?.('.tx-delete');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      try { e.stopImmediatePropagation?.(); } catch {}
      const id = btn.dataset.id;
      try {
        showLoading('Excluindo transação...');
        if (window.TransactionsService?.deleteTransaction) {
          await window.TransactionsService.deleteTransaction(id);
        }
        // Recarregar dados via serviço (mês selecionado) e re-renderizar
        try { await hydrateAllData(); } catch {}
        renderAll();
        showTransactionsFeedback('Transação excluída com sucesso', 'success');
        try { window.StateMonitor?.markWrite?.('transactions'); } catch {}
      } catch (err) {
        console.error('Erro ao excluir transação:', err);
        showTransactionsFeedback('Erro ao excluir transação', 'error');
      } finally {
        hideLoading();
      }
    }, { capture: true });
  }
}


function renderCategories() {
  const grid = document.getElementById('grid-categories');
  const categoriesCountEl = document.getElementById('categories-count');
  if (!grid) return;

  // Update count badge
  if (categoriesCountEl) {
    categoriesCountEl.textContent = String(categories.length);
  }

  grid.innerHTML = '';

  if (!categories || categories.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhuma categoria cadastrada ainda';
    grid.appendChild(empty);
    return;
  }

  categories.forEach(c => {
    const card = document.createElement('div');
    card.className = 'category-card';

    const header = document.createElement('div');
    header.className = 'category-header';

    const title = document.createElement('div');
    title.className = 'category-title';

    const colorDot = document.createElement('span');
    colorDot.className = 'category-dot';
    colorDot.style.background = c.color || '#6200ee';

    const nameEl = document.createElement('div');
    nameEl.className = 'category-name';
    nameEl.textContent = c.name;

    title.appendChild(colorDot);
    title.appendChild(nameEl);

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'category-delete action delete';
    btnDelete.setAttribute('aria-label', 'Excluir categoria');
    btnDelete.setAttribute('title', 'Excluir');
    btnDelete.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>`;

    btnDelete.addEventListener('click', async () => {
      const catName = c.name;
      btnDelete.disabled = true;
      showLoading('Excluindo categoria...');
      try {
        await window.CategoriesService?.deleteCategory?.(c.id);
      } catch (e) {
        console.error('Erro ao excluir categoria:', e);
      }
      let refreshed = null;
      try {
        refreshed = await window.CategoriesService?.fetchCategories?.();
      } catch {}
      const refreshedList = Array.isArray(refreshed) ? refreshed : categories.filter(x => x.id !== c.id);
      const stillExists = refreshedList.some(x => String(x.id) === String(c.id));
      categories = refreshedList;
      if (!stillExists) {
        // Limpa metas associadas à categoria excluída (somente memória)
        if (typeof categoryGoals !== 'undefined' && Array.isArray(categoryGoals)) {
          categoryGoals = categoryGoals.filter(g => String(g.categoryId) !== String(c.id));
        }
      }
      renderCategories();
      const el = document.getElementById('categories-feedback');
      if (el) {
        el.textContent = stillExists ? `Falha ao excluir categoria "${catName}"` : `Categoria "${catName}" excluída com sucesso`;
        el.classList.remove('success', 'error');
        el.classList.add(stillExists ? 'error' : 'success');
        el.hidden = false;
        setTimeout(() => { el.hidden = true; }, 2500);
      }
      try { window.StateMonitor?.markWrite?.('categories'); } catch {}
      btnDelete.disabled = false;
      hideLoading();
    });

    header.appendChild(title);
    card.appendChild(header);
    card.appendChild(btnDelete);

    grid.appendChild(card);
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
function showBanksFeedback(message, type = 'success') {
  const el = document.getElementById('banks-feedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('success', 'error');
  el.classList.add(type);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

function showGoalsFeedback(message, type = 'success') {
  const el = document.getElementById('goals-feedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('success', 'error');
  el.classList.add(type);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

function showCategoriesFeedback(message, type = 'success') {
  const el = document.getElementById('categories-feedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('success', 'error');
  el.classList.add(type);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

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

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'bank-delete action delete';
    btnDelete.setAttribute('aria-label', 'Excluir banco');
    btnDelete.setAttribute('title', 'Excluir');
    btnDelete.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>`;
    btnDelete.addEventListener('click', async () => {
      const bankName = b.name;
      // Evitar múltiplos cliques
      btnDelete.disabled = true;
      showLoading('Excluindo banco...');
      try {
        if (window.BanksService?.deleteBank) {
          await window.BanksService.deleteBank(b.id);
        }
      } catch (e) { console.error('Erro ao excluir banco:', e); }
      // Refazer fetch para espelhar estado do servidor ou cache do serviço
      let refreshed = null;
      try {
        refreshed = await window.BanksService?.fetchBanks?.();
      } catch {}
      const refreshedList = Array.isArray(refreshed) ? refreshed : banks.filter(x => x.id !== b.id);
      const stillExists = refreshedList.some(x => String(x.id) === String(b.id));
      banks = refreshedList;
      renderBanks();
      showBanksFeedback(stillExists ? `Falha ao excluir banco "${bankName}"` : `Banco "${bankName}" excluído com sucesso`, stillExists ? 'error' : 'success');
      try { window.StateMonitor?.markWrite?.('banks'); } catch {}
      btnDelete.disabled = false;
      hideLoading();
    });

    header.appendChild(nameEl);
    card.appendChild(header);
    card.appendChild(btnDelete);

    grid.appendChild(card);
  });
}

// Bancos: submit de novo banco
formBank?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = bankNameEl?.value?.trim();
  if (!name) return;
  showLoading('Criando banco...');
  try {
    if (window.BanksService?.createBank) {
      const row = await window.BanksService.createBank({ name });
      // Após criar, preferir refetch remoto para garantir consistência
      try {
        const refreshed = await window.BanksService?.fetchBanks?.();
        banks = Array.isArray(refreshed) ? refreshed : [row, ...banks];
      } catch {
        banks = [row, ...banks];
      }
    }
  } catch (err) { console.warn('createBank error:', err); }
  if (bankNameEl) bankNameEl.value = '';
  renderAll();
  showBanksFeedback(`Banco "${name}" adicionado com sucesso`, 'success');
  try { window.StateMonitor?.markWrite?.('banks'); } catch {}
  hideLoading();
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

// Inicializa monitoramento de estado e feedback visual
try {
  window.StateMonitor?.init?.();
  // Feedback visual de sincronização
  window.addEventListener('sync:refresh-start', () => {
    if (currentRoute === 'categories') showCategoriesFeedback('Atualizando dados...', 'success');
    if (currentRoute === 'banks') showBanksFeedback('Atualizando dados...', 'success');
  });
  window.addEventListener('sync:refresh-done', (ev) => {
    const ok = !!ev?.detail?.ok;
    if (currentRoute === 'categories') showCategoriesFeedback(ok ? 'Dados atualizados' : 'Falha ao atualizar', ok ? 'success' : 'error');
    if (currentRoute === 'banks') showBanksFeedback(ok ? 'Dados atualizados' : 'Falha ao atualizar', ok ? 'success' : 'error');
    try { renderAll(); } catch {}
  });
  // Auto-refresh via realtime
  window.addEventListener('db:change', async (ev) => {
    const tbl = ev?.detail?.table;
    if (['banks','categories','transactions','monthly_goals'].includes(tbl)) {
      try {
        await hydrateAllData();
        renderAll();
        if (currentRoute === 'transactions') {
          try { await loadTransactionsPage(transactionsPage); } catch {}
        }
      } catch (e) { console.warn('auto-refresh error:', e); }
    }
  });
} catch {}

// Renderização de transações
function renderTransactions(transactions = []) {
  // Prepara selects
  if (txCategoryEl) {
    txCategoryEl.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (!txCategoryEl.value) txCategoryEl.value = categories[0]?.id || '';
  }
  if (txBankEl) {
    txBankEl.innerHTML = `<option value="">Dinheiro</option>` + banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (txDateEl && !txDateEl.value) txDateEl.value = todayISO();
  updateBankVisibility();
  const listEl = document.getElementById('list-transactions');
  if (!listEl) return;

  // Usa a lista passada; se vazia, cai para transações do mês atual
  const list = (Array.isArray(transactions) && transactions.length)
    ? transactions
    : (typeof currentMonthTransactions === 'function' ? currentMonthTransactions() : []);

  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

  listEl.innerHTML = (list || []).map((tx) => {
    const isIncome = tx.type === 'income';
    const iconClass = isIncome ? 'income' : 'expense';
    const amountSign = isIncome ? '+' : '-';
    const amountClass = isIncome ? 'income' : 'expense';

    const categoryName = tx.categoryName || (window.Categories?.findCategoryName?.(tx.categoryId)) || (Array.isArray(categories) ? (categories.find(c => String(c.id)===String(tx.categoryId))?.name) : '') || 'Sem categoria';
    const bankName = tx.bankName || tx.bank || (window.Banks?.findBankName?.(tx.bankId)) || (Array.isArray(banks) ? (banks.find(b => String(b.id)===String(tx.bankId))?.name) : '') || '';
    const dateStr = window.formatDate?.(tx.date) || (tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '') || '';
    const amountStr = window.formatCurrency?.(tx.amount) || `R$ ${Number(tx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    return `
      <div class="tx-card" data-id="${tx.id}">
        <div class="tx-header">
          <div class="tx-left">
            <div class="tx-icon ${iconClass}">${isIncome ? '↑' : '↓'}</div>
            <h4 class="tx-title">${escapeHtml(tx.description)}</h4>
          </div>
          <div class="tx-date">${escapeHtml(dateStr)}</div>
        </div>
        <div class="tx-body">
          <div class="tx-meta">
            <span>${escapeHtml(categoryName)}</span>
            ${bankName ? `<span class="sep">-</span><span>${escapeHtml(bankName)}</span>` : ''}
          </div>
          <div class="tx-right">
            <div class="tx-amount ${amountClass}">${amountSign} ${amountStr}</div>
            <button class="tx-delete" data-id="${tx.id}" aria-label="Excluir transação">
              <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Ações de exclusão (delegação em captura para bloquear handlers paralelos)
  listEl.addEventListener('click', async (e) => {
    const btn = e.target && e.target.closest?.('.tx-delete');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.stopImmediatePropagation?.(); } catch {}
    const id = btn.dataset.id;
    try {
      showLoading('Excluindo transação...');
      if (window.TransactionsService?.deleteTransaction) {
        await window.TransactionsService.deleteTransaction(id);
      }
      // Recarregar dados via serviço (mês selecionado) e re-renderizar
      try { await hydrateAllData(); } catch {}
      renderAll();
      showTransactionsFeedback('Transação excluída com sucesso', 'success');
      try { window.StateMonitor?.markWrite?.('transactions'); } catch {}
    } catch (err) {
      console.error('Erro ao excluir transação:', err);
      showTransactionsFeedback('Erro ao excluir transação', 'error');
    } finally {
      hideLoading();
    }
  }, { capture: true });
}


try {
  formTx?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = String(txDescriptionEl?.value || '').trim();
    const amount = Number(txAmountEl?.value || 0);
    const dateInput = String(txDateEl?.value || '');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? dateInput : parseDateBRToISO(dateInput) || todayISO();
    const type = String(txTypeEl?.value || 'expense');
    const categoryId = String(txCategoryEl?.value || '');
    const bankId = type === 'expense' ? String(txBankEl?.value || '') : '';

    if (!description || !amount || !date || !categoryId || !type) {
      showTransactionsFeedback('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    const localTx = { id: crypto.randomUUID(), description, amount, date, type, categoryId, bankId: bankId || null };

    try {
    showLoading('Adicionando transação...');
    let created = null;
    if (window.TransactionsService?.createTransaction) {
      created = await window.TransactionsService.createTransaction(mapLocalTransactionToDb(localTx));
    }
    const newLocal = created ? mapDbTransactionToLocal(created) : localTx;
    transactions.unshift(newLocal);
    showTransactionsFeedback('Transação adicionada com sucesso', 'success');
    // Após criar, refetch do mês atual para sincronizar todos os componentes
    try { await hydrateAllData(); } catch {}
    renderAll();
    try { window.StateMonitor?.markWrite?.('transactions'); } catch {}

    // Resetar formulário
    if (txDescriptionEl) txDescriptionEl.value = '';
    if (txAmountEl) txAmountEl.value = '';
    if (txDateEl) txDateEl.value = todayISO();
    if (txTypeEl) txTypeEl.value = 'expense';
    updateBankVisibility();
    if (txCategoryEl) txCategoryEl.value = categories[0]?.id || '';
    if (txBankEl) txBankEl.value = '';
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    showTransactionsFeedback('Falha ao adicionar a transação', 'error');
  } finally {
    hideLoading();
  }
});
} catch {}
function showTransactionsFeedback(message, type = 'success') {
  const el = document.getElementById('transactions-feedback');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('success', 'error');
  el.classList.add(type);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}

// Paginação simples de transações (lista)
const TRANSACTIONS_LIMIT = 20;
let transactionsPage = 1;
let transactionsPageRows = [];

async function loadTransactionsPage(page = 1) {
  showLoading('Carregando transações...');
  try {
    const rows = await window.TransactionsService?.fetchTransactionsByMonth?.(selectedMonth, { page, limit: TRANSACTIONS_LIMIT }) || [];
    transactionsPageRows = rows.map(mapDbTransactionToLocal);
    transactionsPage = page;
    renderTransactionsPage();
  } catch (e) {
    console.warn('loadTransactionsPage error:', e);
  } finally {
    hideLoading();
  }
}

function renderTransactionsPage() {
  const listEl = document.getElementById('list-transactions');
  if (!listEl) return;
  const list = Array.isArray(transactionsPageRows) ? transactionsPageRows : [];
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
  listEl.innerHTML = (list || []).map((tx) => {
    const isIncome = tx.type === 'income';
    const iconClass = isIncome ? 'income' : 'expense';
    const amountSign = isIncome ? '+' : '-';
    const amountClass = isIncome ? 'income' : 'expense';
    const categoryName = tx.categoryName || (Array.isArray(categories) ? (categories.find(c => String(c.id)===String(tx.categoryId))?.name) : '') || 'Sem categoria';
    const bankName = tx.bankName || tx.bank || (Array.isArray(banks) ? (banks.find(b => String(b.id)===String(tx.bankId))?.name) : '') || '';
    const dateStr = tx.date ? new Date(tx.date).toLocaleDateString('pt-BR') : '';
    const amountStr = `R$ ${Number(tx.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return `
      <div class="tx-card" data-id="${tx.id}">
        <div class="tx-header">
          <div class="tx-left">
            <div class="tx-icon ${iconClass}">${isIncome ? '↑' : '↓'}</div>
            <h4 class="tx-title">${escapeHtml(tx.description)}</h4>
          </div>
          <div class="tx-date">${escapeHtml(dateStr)}</div>
        </div>
        <div class="tx-body">
          <div class="tx-meta">
            <span>${escapeHtml(categoryName)}</span>
            ${bankName ? `<span>${escapeHtml(bankName)}</span>` : ''}
          </div>
          <div class="tx-amount ${amountClass}">${amountSign} ${escapeHtml(amountStr)}</div>
        </div>
        <div class="tx-actions">
          <button class="tx-delete action delete" data-id="${tx.id}" type="button" aria-label="Excluir">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
        </div>
      </div>`;
  }).join('') || `<div class="muted" style="text-align:center">Nenhuma transação nesta página</div>`;

  // Ações: exclusão
  const deleteButtons = listEl.querySelectorAll('.tx-delete');
  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const ok = window.confirm('Excluir esta transação?');
      if (!ok) return;
      showLoading('Excluindo transação...');
      try {
        await window.TransactionsService?.deleteTransaction?.(id);
        // Recarregar dados e manter página atual
        await hydrateAllData();
        renderAll();
        await loadTransactionsPage(transactionsPage);
      } catch (err) {
        console.warn('Erro ao excluir transação:', err);
        showTransactionsFeedback('Falha ao excluir', true);
      } finally {
        hideLoading();
      }
    });
  });

  // Controles de paginação
  let pagerEl = document.getElementById('transactions-pager');
  if (!pagerEl) {
    pagerEl = document.createElement('div');
    pagerEl.id = 'transactions-pager';
    pagerEl.className = 'pager';
    listEl.parentNode && listEl.parentNode.appendChild(pagerEl);
  }
  const hasMore = (list || []).length >= TRANSACTIONS_LIMIT;
  pagerEl.innerHTML = `
    <div class="pager-inner">
      <button id="tx-prev" class="btn" ${transactionsPage <= 1 ? 'disabled' : ''} aria-label="Anterior">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
</button>
<span class="pager-info">Página ${transactionsPage}</span>
<button id="tx-next" class="btn" ${!hasMore ? 'disabled' : ''} aria-label="Próxima">
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
</button>
    </div>
  `;
  const prevBtn = document.getElementById('tx-prev');
  const nextBtn = document.getElementById('tx-next');
  prevBtn && prevBtn.addEventListener('click', (e) => { e.preventDefault(); if (transactionsPage > 1) loadTransactionsPage(transactionsPage - 1); });
  nextBtn && nextBtn.addEventListener('click', (e) => { e.preventDefault(); if (hasMore) loadTransactionsPage(transactionsPage + 1); });
}

// Inicialização da UI de autenticação
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
});