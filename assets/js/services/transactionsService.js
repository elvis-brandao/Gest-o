import { getSupabase } from '../core/supabaseClient.js';

export async function fetchTransactions() {
  const s = getSupabase();
  if (!s) return [];
  const { data, error } = await s.from('transactions').select('*').order('date', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createTransaction(payload) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('transactions').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(id, changes) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('transactions').update(changes).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { error } = await s.from('transactions').delete().eq('id', id);
  if (error) throw error;
  return true;
}