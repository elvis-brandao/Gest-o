import { getSupabase } from '../core/supabaseClient.js';

// Offline-first helpers (usar storage dedicado do serviço para não conflitar com app.js)
const localKey = 'transactions_service';
const outboxKey = 'transactions_outbox';

function readLocal() {
  try { const raw = localStorage.getItem(localKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function writeLocal(items) {
  try { localStorage.setItem(localKey, JSON.stringify(items || [])); } catch {}
}
function readOutbox() {
  try { const raw = localStorage.getItem(outboxKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function writeOutbox(items) {
  try { localStorage.setItem(outboxKey, JSON.stringify(items || [])); } catch {}
}

function isSupabaseEnabled() {
  try {
    const env = window.__ENV || {};
    const s = getSupabase();
    return !!env.USE_SUPABASE && !!s && !!s.auth;
  } catch { return false; }
}

async function getUserId() {
  const s = getSupabase();
  if (!s) return null;
  const { data: { user } } = await s.auth.getUser();
  return user?.id || null;
}

export async function syncOutbox() {
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
        const { error } = await s.from('transactions').insert(payload);
        if (error) throw error;
      } else if (item.op === 'update') {
        const { id, changes } = item;
        const { error } = await s
          .from('transactions')
          .update(changes)
          .eq('id', id)
          .eq('user_id', uid);
        if (error) throw error;
      } else if (item.op === 'delete') {
        const { id } = item;
        const { error } = await s
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', uid);
        if (error) throw error;
      } else {
        // desconhecido: manter para próxima tentativa
        still.push(item);
      }
    } catch (e) {
      console.warn('syncOutbox transaction error:', e);
      still.push(item);
    }
  }
  writeOutbox(still);
  // Após sincronizar, espelhar remoto para local para consistência
  try {
    const { data } = await s
      .from('transactions')
      .select('*')
      .eq('user_id', uid)
      .order('occurred_at', { ascending: false });
    writeLocal(data || []);
  } catch {}
  return true;
}

export async function fetchTransactions() {
  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) return readLocal();
  const uid = await getUserId();
  if (!uid) return readLocal();
  try { await syncOutbox(); } catch {}
  const { data, error } = await s
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .order('occurred_at', { ascending: false });
  if (error) return readLocal();
  writeLocal(data || []);
  return data || [];
}

// Busca transações por mês (occurred_at)
export async function fetchTransactionsByMonth(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, (m || 1), 1);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) {
    // Offline: filtrar do cache local do serviço
    return readLocal().filter((row) => {
      const d = new Date(row.occurred_at);
      return d >= start && d < end;
    });
  }
  const uid = await getUserId();
  if (!uid) {
    return readLocal().filter((row) => {
      const d = new Date(row.occurred_at);
      return d >= start && d < end;
    });
  }
  try { await syncOutbox(); } catch {}
  const { data, error } = await s
    .from('transactions')
    .select('*')
    .eq('user_id', uid)
    .gte('occurred_at', startISO)
    .lt('occurred_at', endISO)
    .order('occurred_at', { ascending: false });
  if (error) return readLocal().filter((row) => {
    const d = new Date(row.occurred_at);
    return d >= start && d < end;
  });
  // Atualiza cache local incremental (adiciona/atualiza registros do mês)
  const current = readLocal();
  const mapById = new Map(current.map(r => [r.id, r]));
  for (const r of (data || [])) mapById.set(r.id, r);
  writeLocal(Array.from(mapById.values()));
  return data || [];
}

export async function createTransaction(payload) {
  // payload: { description, amount, occurred_at, type, category_id, bank_id }
  const s = getSupabase();
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const toInsert = { ...payload, user_id: uid };
        const { data, error } = await s
          .from('transactions')
          .insert(toInsert)
          .select('*')
          .single();
        if (error) throw error;
        // Atualiza cache local
        const items = readLocal();
        items.unshift(data);
        writeLocal(items);
        return data;
      } catch (err) {
        console.warn('createTransaction supabase error:', err);
        // Enfileirar para sincronização e espelhar local
        const out = readOutbox();
        out.unshift({ op: 'create', payload, ts: Date.now() });
        writeOutbox(out);
        const localRow = { id: crypto.randomUUID(), ...payload, user_id: 'local' };
        const items = readLocal();
        items.unshift(localRow);
        writeLocal(items);
        return localRow;
      }
    }
  }
  // Supabase não disponível: apenas outbox + local
  const out = readOutbox();
  out.unshift({ op: 'create', payload, ts: Date.now() });
  writeOutbox(out);
  const localRow = { id: crypto.randomUUID(), ...payload, user_id: 'local' };
  const items = readLocal();
  items.unshift(localRow);
  writeLocal(items);
  return localRow;
}

export async function updateTransaction(id, changes) {
  const s = getSupabase();
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const { data, error } = await s
          .from('transactions')
          .update(changes)
          .eq('id', id)
          .eq('user_id', uid)
          .select('*')
          .single();
        if (error) throw error;
        // Espelhar local
        const items = readLocal();
        const idx = items.findIndex(r => r.id === id);
        if (idx >= 0) items[idx] = data;
        writeLocal(items);
        return data;
      } catch (err) {
        console.warn('updateTransaction supabase error:', err);
        const out = readOutbox();
        out.unshift({ op: 'update', id, changes, ts: Date.now() });
        writeOutbox(out);
        // Atualiza local
        const items = readLocal();
        const idx = items.findIndex(r => r.id === id);
        if (idx >= 0) items[idx] = { ...items[idx], ...changes };
        writeLocal(items);
        return items.find(r => r.id === id) || null;
      }
    }
  }
  // Local + outbox
  const out = readOutbox();
  out.unshift({ op: 'update', id, changes, ts: Date.now() });
  writeOutbox(out);
  const items = readLocal();
  const idx = items.findIndex(r => r.id === id);
  if (idx >= 0) items[idx] = { ...items[idx], ...changes };
  writeLocal(items);
  return items.find(r => r.id === id) || null;
}

export async function deleteTransaction(id) {
  const s = getSupabase();
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const { error } = await s
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', uid);
        if (error) throw error;
      } catch (err) {
        console.warn('deleteTransaction supabase error:', err);
        const out = readOutbox();
        out.unshift({ op: 'delete', id, ts: Date.now() });
        writeOutbox(out);
      }
    }
  } else {
    const out = readOutbox();
    out.unshift({ op: 'delete', id, ts: Date.now() });
    writeOutbox(out);
  }
  // Sempre refletir local
  const items = readLocal().filter(r => String(r.id) !== String(id));
  writeLocal(items);
  return true;
}