import { getSupabase } from '../core/supabaseClient.js';

async function getUserId() {
  const s = getSupabase();
  if (!s) return null;
  const { data: { user } } = await s.auth.getUser();
  return user?.id || null;
}

export async function fetchCategories() {
  const s = getSupabase();
  if (!s) return [];
  const uid = await getUserId();
  if (!uid) return [];
  const { data, error } = await s
    .from('categories')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createCategory(payload) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const toInsert = { ...payload, user_id: uid };
  const { data, error } = await s
    .from('categories')
    .insert(toInsert)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, changes) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const { data, error } = await s
    .from('categories')
    .update(changes)
    .eq('id', id)
    .eq('user_id', uid)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const { error } = await s
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);
  if (error) throw error;
  return true;
}