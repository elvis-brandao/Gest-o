import { getSupabase } from '../core/supabaseClient.js';

export async function fetchBanks() {
  const s = getSupabase();
  if (!s) return [];
  const { data, error } = await s.from('banks').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

export async function createBank(payload) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('banks').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateBank(id, changes) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { data, error } = await s.from('banks').update(changes).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteBank(id) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const { error } = await s.from('banks').delete().eq('id', id);
  if (error) throw error;
  return true;
}