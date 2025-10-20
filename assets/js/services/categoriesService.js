import { getSupabase } from '../core/supabaseClient.js';

export async function fetchCategories() {
  const s = getSupabase();
  if (!s) return [];
  const { data, error } = await s.from('categories').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createCategory(payload) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('categories').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, changes) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('categories').update(changes).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { error } = await s.from('categories').delete().eq('id', id);
  if (error) throw error;
  return true;
}