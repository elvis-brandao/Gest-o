import { getSupabase } from '../core/supabaseClient.js';

async function getUserId() {
  const s = getSupabase();
  if (!s) return null;
  const { data: { user } } = await s.auth.getUser();
  return user?.id || null;
}

export async function fetchProfile() {
  const s = getSupabase();
  if (!s) return null;
  const uid = await getUserId();
  if (!uid) return null;
  
  const { data, error } = await s
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();
    
  if (error) {
    console.warn('fetchProfile error:', error);
    return null;
  }
  return data;
}

export async function updateProfile(changes) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  
  const { data, error } = await s
    .from('profiles')
    .update(changes)
    .eq('id', uid)
    .select('*')
    .single();
    
  if (error) throw error;
  return data;
}

export async function createProfile(profileData) {
  const s = getSupabase();
  if (!s) throw new Error('Supabase não configurado');
  const uid = await getUserId();
  if (!uid) throw new Error('Usuário não autenticado');
  
  const toInsert = { ...profileData, id: uid };
  const { data, error } = await s
    .from('profiles')
    .insert(toInsert)
    .select('*')
    .single();
    
  if (error) throw error;
  return data;
}