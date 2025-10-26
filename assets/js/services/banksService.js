import { getSupabase } from '../core/supabaseClient.js';

function assertSupabase() {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  return s;
}

function getCurrentUserId() {
  try { return window.AuthService?.getUser?.()?.id || null; } catch { return null; }
}

export async function fetchBanks() {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  const q = s
    .from('banks')
    .select('*')
    .order('name', { ascending: true });
  if (uid) q.eq('user_id', uid);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function createBank({ name }) {
  const s = assertSupabase();
  const uid = getCurrentUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  const payload = { user_id: uid, name, balance: 0 };
  const { data, error } = await s
    .from('banks')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateBank(id, changes) {
  const s = assertSupabase();
  const { data, error } = await s
    .from('banks')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBank(id) {
  const s = assertSupabase();
  const { error } = await s
    .from('banks')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function subscribeBanks(handler) {
  const s = assertSupabase();
  const channel = s
    .channel('banks-ch')
    .on('postgres_changes', { schema: 'public', table: 'banks', event: '*' }, (payload) => {
      try {
        handler && handler(payload);
        window.dispatchEvent(new CustomEvent('db:change', { detail: { table: 'banks', payload } }));
      } catch {}
    })
    .subscribe();
  return channel;
}

// Expor para app.js
window.BanksService = { fetchBanks, createBank, updateBank, deleteBank, subscribeBanks };