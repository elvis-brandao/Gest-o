import { getSupabase } from '../core/supabaseClient.js';

function assertSupabase() {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  return s;
}

const TABLE = 'goals';

function getCurrentUserId() {
  try { return window.AuthService?.getUser?.()?.id || null; } catch { return null; }
}

export async function fetchGoals() {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const q = s.from(TABLE).select('*');
  if (uid) q.eq('user_id', uid);
  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchMonthlyGoalFor(monthKey) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const name = `monthly:${monthKey}`;
  let q = s.from(TABLE).select('*').eq('name', name).limit(1);
  if (uid) q = q.eq('user_id', uid);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveMonthlyGoalFor(monthKey, amount) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const name = `monthly:${monthKey}`;
  // Tenta buscar existente
  const existing = await fetchMonthlyGoalFor(monthKey);
  if (existing?.id) {
    const changes = { target_amount: Number(amount) || 0 };
    const { data, error } = await s
      .from(TABLE)
      .update(changes)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
  // Se não existir, insere novo
  const payload = {
    user_id: uid,
    name,
    target_amount: Number(amount) || 0,
    current_amount: 0,
    due_date: null,
  };
  const { data, error } = await s
    .from(TABLE)
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function createGoal(payload) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const { data, error } = await s
    .from(TABLE)
    .insert({ ...payload, user_id: uid || payload.user_id })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id, changes) {
  const s = assertSupabase();
  const { data, error } = await s
    .from(TABLE)
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id) {
  const s = assertSupabase();
  const { error } = await s
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function subscribeMonthlyGoals(handler) {
  const s = assertSupabase();
  const channel = s
    .channel('goals-ch')
    .on('postgres_changes', { schema: 'public', table: TABLE, event: '*' }, (payload) => {
      try {
        handler && handler(payload);
        window.dispatchEvent(new CustomEvent('db:change', { detail: { table: TABLE, payload } }));
      } catch {}
    })
    .subscribe();
  return channel;
}

window.GoalsService = {
  fetchGoals,
  fetchMonthlyGoalFor,
  saveMonthlyGoalFor,
  createGoal,
  updateGoal,
  deleteGoal,
  subscribeMonthlyGoals,
};
