import { getSupabase } from '../core/supabaseClient.js';

function assertSupabase() {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  return s;
}

function getCurrentUserId() {
  try { return window.AuthService?.getUser?.()?.id || null; } catch { return null; }
}

export async function fetchTransactions({ page = 1, limit = 20, filters = {} } = {}) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const from = Math.max(0, (page - 1) * limit);
  const to = from + limit - 1;
  let query = s.from('transactions').select('*');
  if (uid) query = query.eq('user_id', uid);
  // filtros opcionais
  if (filters.bank_id) query = query.eq('bank_id', filters.bank_id);
  if (filters.category_id) query = query.eq('category_id', filters.category_id);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.date_from) query = query.gte('occurred_at', filters.date_from);
  if (filters.date_to) query = query.lt('occurred_at', filters.date_to);
  const { data, error } = await query.order('occurred_at', { ascending: false }).range(from, to);
  if (error) throw error;
  return data || [];
}

// Busca transações por mês com paginação
export async function fetchTransactionsByMonth(monthKey, { page = 1, limit = 20 } = {}) {
  const [y, m] = String(monthKey).split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, (m || 1), 1);
  const startISO = start.toISOString();
  const endISO = end.toISOString();
  return fetchTransactions({ page, limit, filters: { date_from: startISO, date_to: endISO } });
}

export async function createTransaction(payload) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const toInsert = {
    user_id: uid,
    description: String(payload?.description || '').trim(),
    amount: Number(payload?.amount || 0),
    occurred_at: payload?.occurred_at || new Date().toISOString(),
    type: String(payload?.type || 'expense'),
    category_id: payload?.category_id || null,
    bank_id: payload?.bank_id || null,
  };
  const { data, error } = await s
    .from('transactions')
    .insert(toInsert)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, changes) {
  const s = assertSupabase();
  const { data, error } = await s
    .from('transactions')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const s = assertSupabase();
  const { error } = await s
    .from('transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function subscribeTransactions(handler) {
  const s = assertSupabase();
  const channel = s
    .channel('transactions-ch')
    .on('postgres_changes', { schema: 'public', table: 'transactions', event: '*' }, (payload) => {
      try {
        handler && handler(payload);
        window.dispatchEvent(new CustomEvent('db:change', { detail: { table: 'transactions', payload } }));
      } catch {}
    })
    .subscribe();
  return channel;
}

window.TransactionsService = {
  fetchTransactions,
  fetchTransactionsByMonth,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  subscribeTransactions,
};