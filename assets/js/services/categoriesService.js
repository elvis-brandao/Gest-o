import { getSupabase } from '../core/supabaseClient.js';

function assertSupabase() {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  return s;
}

function getCurrentUserId() {
  try { return window.AuthService?.getUser?.()?.id || null; } catch { return null; }
}

export async function fetchCategories() {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const q = s
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false });
  if (uid) q.eq('user_id', uid);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createCategory(payload) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const cleaned = {
    user_id: uid,
    name: String(payload?.name || '').trim(),
    color: String(payload?.color || '#6200ee'),
    type: String(payload?.type || 'expense'),
  };
  const { data, error } = await s
    .from('categories')
    .insert(cleaned)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, changes) {
  const s = assertSupabase();
  const { data, error } = await s
    .from('categories')
    .update({
      name: changes?.name,
      color: changes?.color,
      type: changes?.type
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const s = assertSupabase();
  const { error } = await s
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function subscribeCategories(handler) {
  const s = assertSupabase();
  const channel = s
    .channel('categories-ch')
    .on('postgres_changes', { schema: 'public', table: 'categories', event: '*' }, (payload) => {
      try {
        handler && handler(payload);
        window.dispatchEvent(new CustomEvent('db:change', { detail: { table: 'categories', payload } }));
      } catch {}
    })
    .subscribe();
  return channel;
}

// Expor para app.js
window.CategoriesService = { fetchCategories, createCategory, updateCategory, deleteCategory, subscribeCategories };