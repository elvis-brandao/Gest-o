import { getSupabase } from '../core/supabaseClient.js';

// Offline-first helpers (usar storage dedicado do serviço)
const localKey = 'banks_service';
const outboxKey = 'banks_outbox';

function readLocal(){ try { const raw = localStorage.getItem(localKey); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeLocal(items){ try { localStorage.setItem(localKey, JSON.stringify(items || [])); } catch {} }
function readOutbox(){ try { const raw = localStorage.getItem(outboxKey); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeOutbox(items){ try { localStorage.setItem(outboxKey, JSON.stringify(items || [])); } catch {} }

function isSupabaseEnabled(){
  try { const env = window.__ENV || {}; const s = getSupabase(); return !!env.USE_SUPABASE && !!s && !!s.auth; } catch { return false; }
}
async function getUserId(){ const s = getSupabase(); if (!s) return null; const { data: { user } } = await s.auth.getUser(); return user?.id || null; }

export async function syncOutbox(){
  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) return false;
  const uid = await getUserId();
  if (!uid) return false;
  const pending = readOutbox();
  if (!pending.length) return true;
  const still = [];
  for (const item of pending) {
    try {
      if (item.op === 'create') {
        const payload = { ...item.payload, user_id: uid };
        const { error } = await s.from('banks').insert(payload);
        if (error) throw error;
      } else if (item.op === 'delete') {
        const { id } = item;
        const { error } = await s.from('banks').delete().eq('id', id).eq('user_id', uid);
        if (error) throw error;
      } else {
        still.push(item);
      }
    } catch(e){ console.warn('syncOutbox banks error:', e); still.push(item); }
  }
  writeOutbox(still);
  // Espelhar remoto em local
  try {
    const { data } = await s.from('banks').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    writeLocal(data || []);
  } catch {}
  return true;
}

export async function fetchBanks(){
  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) return readLocal();
  const uid = await getUserId();
  if (!uid) return readLocal();
  try { await syncOutbox(); } catch {}
  const { data, error } = await s
    .from('banks')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) return readLocal();
  writeLocal(data || []);
  return data || [];
}

export async function createBank(payload){
  const s = getSupabase();
  if (isSupabaseEnabled() && s){
    const uid = await getUserId();
    if (uid){
      try {
        const toInsert = { ...payload, user_id: uid };
        const { data, error } = await s.from('banks').insert(toInsert).select('*').single();
        if (error) throw error;
        const items = readLocal(); items.unshift(data); writeLocal(items);
        return data;
      } catch(err){
        console.warn('createBank supabase error:', err);
        const out = readOutbox(); out.unshift({ op: 'create', payload, ts: Date.now() }); writeOutbox(out);
        const localRow = { id: crypto.randomUUID(), name: String(payload?.name||''), created_at: new Date().toISOString(), user_id: 'local' };
        const items = readLocal(); items.unshift(localRow); writeLocal(items);
        return localRow;
      }
    }
  }
  const out = readOutbox(); out.unshift({ op: 'create', payload, ts: Date.now() }); writeOutbox(out);
  const localRow = { id: crypto.randomUUID(), name: String(payload?.name||''), created_at: new Date().toISOString(), user_id: 'local' };
  const items = readLocal(); items.unshift(localRow); writeLocal(items);
  return localRow;
}

export async function deleteBank(id){
  const s = getSupabase();
  if (isSupabaseEnabled() && s){
    const uid = await getUserId();
    if (uid){
      try {
        const { error } = await s.from('banks').delete().eq('id', id).eq('user_id', uid);
        if (error) throw error;
      } catch(err){
        console.warn('deleteBank supabase error:', err);
        const out = readOutbox(); out.unshift({ op: 'delete', id, ts: Date.now() }); writeOutbox(out);
      }
    }
  } else {
    const out = readOutbox(); out.unshift({ op: 'delete', id, ts: Date.now() }); writeOutbox(out);
  }
  const items = readLocal().filter(b => String(b.id) !== String(id)); writeLocal(items);
  return true;
}