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
let selectedMonth = getCurrentMonthKey();
let monthlyGoalsMap = storage.get('monthlyGoals', {});
const getSelectedMonthlyGoalAmount = () => Number(monthlyGoalsMap[selectedMonth] ?? 0);

// Hidratação central de dados: sincroniza bancos do serviço (Supabase quando disponível)
async function hydrateAllData() {
  try {
    if (window.BanksService?.fetchBanks) {
      const items = await window.BanksService.fetchBanks();
      if (Array.isArray(items)) {
        banks = items.map(b => ({ id: b.id, name: b.name, icon: b.icon ?? null, color: b.color ?? null }));
        storage.set('banks', banks);
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
        storage.set('categories', categories);
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
        storage.set('transactions', transactions);
      }
    } else if (window.TransactionsService?.fetchTransactions) {
      const rows = await window.TransactionsService.fetchTransactions();
      if (Array.isArray(rows)) {
        transactions = rows.map(mapDbTransactionToLocal);
        storage.set('transactions', transactions);
      }
    }
  } catch (e) {
    console.warn('hydrateAllData(transactions) error:', e);
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
  try {
    const row = await window.CategoriesService?.createCategory?.({ name, color });
    // Após criar, preferir refetch remoto para garantir consistência
    try {
      const refreshed = await window.CategoriesService?.fetchCategories?.();
      categories = Array.isArray(refreshed) ? refreshed : [row, ...categories];
    } catch {
      categories = [row, ...categories];
    }
    storage.set('categories', categories);
  } catch (err) { console.warn('createCategory error:', err); }
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
    const saved = await window.GoalsService?.saveMonthlyGoalFor?.(selectedMonth, amount);
    const finalAmount = Number(saved?.target_amount ?? amount) || 0;
    monthlyGoalsMap[selectedMonth] = finalAmount;
    storage.set('monthlyGoals', monthlyGoalsMap);
    renderGoals();
    renderSummary();
    showGoalsFeedback('Meta atualizada com sucesso', 'success');
    try { window.StateMonitor?.markWrite?.('goals'); } catch {}
  } catch (err) {
    console.warn('saveMonthlyGoalFor error:', err);
    showGoalsFeedback('Falha ao atualizar meta', 'error');
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

  const income = monthlyIncome();
  const expense = monthlyExpenses();
  const max = Math.max(income, expense, 1);
  const barW = Math.min(80, Math.floor(w / 4));
  const gap = Math.floor(w / 6);
  const baseY = h - 20;
  const scale = (h - 40) / max;
  const incomeH = Math.round(income * scale);
  const expenseH = Math.round(expense * scale);

  // Barra de receitas (verde)
  const incomeX = Math.floor(w / 2 - gap);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(incomeX, baseY - incomeH, barW, incomeH);

  // Barra de despesas (vermelho)
  const expenseX = Math.floor(w / 2 + gap - barW);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(expenseX, baseY - expenseH, barW, expenseH);

  // Rótulos
  ctx.fillStyle = '#0f172a';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Receitas: ${formatCurrency(income)}`, incomeX + barW / 2, baseY - incomeH - 6);
  ctx.fillText(`Despesas: ${formatCurrency(expense)}`, expenseX + barW / 2, baseY - expenseH - 6);
}

function drawPieFromMap(canvasId, map, colorGetter) {
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
  let start = -Math.PI / 2;
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 10;
  entries.forEach(([key, val], idx) => {
    const frac = Number(val) / total;
    const end = start + frac * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    const color = colorGetter(key, idx);
    ctx.fillStyle = color;
    ctx.fill();
    start = end;
  });
}

function drawPieExpensesByCategory() {
  const map = expensesByCat();
  const colorGetter = (key, idx) => {
    const cat = categories.find(c => String(c.id) === String(key));
    const base = cat?.color || ['#3b82f6','#f59e0b','#10b981','#ef4444','#6366f1','#14b8a6','#f43f5e','#84cc16'][idx % 8];
    return hexToRgba(base, 0.8);
  };
  drawPieFromMap('pie-expenses-by-category', map, colorGetter);
}

function drawPieExpensesByBank() {
  const map = expensesByBank();
  const colorGetter = (_key, idx) => {
    const palette = ['#0ea5e9','#f97316','#22c55e','#eab308','#a855f7','#06b6d4','#ef4444','#84cc16'];
    return hexToRgba(palette[idx % palette.length], 0.8);
  };
  drawPieFromMap('pie-expenses-by-bank', map, colorGetter);
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
      storage.set('categories', categories);
      if (!stillExists) {
        // Limpa metas associadas à categoria excluída
        categoryGoals = categoryGoals.filter(g => String(g.categoryId) !== String(c.id));
        storage.set('categoryGoals', categoryGoals);
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
      storage.set('banks', banks);
      renderBanks();
      showBanksFeedback(stillExists ? `Falha ao excluir banco "${bankName}"` : `Banco "${bankName}" excluído com sucesso`, stillExists ? 'error' : 'success');
      try { window.StateMonitor?.markWrite?.('banks'); } catch {}
      btnDelete.disabled = false;
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
      storage.set('banks', banks);
    } else {
      // modo offline/local
      const row = { id: Date.now(), name };
      banks = [row, ...banks];
      storage.set('banks', banks);
    }
  } catch (err) { console.warn('createBank error:', err); }
  if (bankNameEl) bankNameEl.value = '';
  renderAll();
  showBanksFeedback(`Banco "${name}" adicionado com sucesso`, 'success');
  try { window.StateMonitor?.markWrite?.('banks'); } catch {}
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
      let created = null;
      if (window.TransactionsService?.createTransaction && canUseSupabase()) {
        created = await window.TransactionsService.createTransaction(mapLocalTransactionToDb(localTx));
      } else if (window.TransactionsService?.createTransaction) {
        // Mesmo sem supabase, o serviço persiste local/outbox
        created = await window.TransactionsService.createTransaction(mapLocalTransactionToDb(localTx));
      }
      const newLocal = created ? mapDbTransactionToLocal(created) : localTx;
      transactions.unshift(newLocal);
      storage.set('transactions', transactions);
      showTransactionsFeedback('Transação adicionada com sucesso', 'success');
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

// Inicialização da UI de autenticação
document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
});