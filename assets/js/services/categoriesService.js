import { getSupabase } from '../core/supabaseClient.js';

// Offline-first helpers
const localKey = 'categories';
const outboxKey = 'categories_outbox';

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

export async function fetchCategories() {
  // If Supabase available and authenticated, prefer server; mirror to local
  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) return readLocal();
  const uid = await getUserId();
  if (!uid) return readLocal();

  // Before fetching, attempt to sync any pending local items
  try { await syncOutbox(); } catch {}

  const { data, error } = await s
    .from('categories')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('fetchCategories supabase error:', error);
    return readLocal();
  }
  // Mirror remote to local for offline use
  writeLocal(data);
  return data || [];
}

export async function createCategory(payload) {
  // payload: { name, color, type? }
  const cleaned = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    name: String(payload?.name || '').trim(),
    color: String(payload?.color || '#6200ee'),
    type: String(payload?.type || 'expense'),
  };

  // If Supabase is available and user authenticated, try remote first
  const s = getSupabase();
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const toInsert = { name: cleaned.name, color: cleaned.color, type: cleaned.type, user_id: uid };
        const { data, error } = await s
          .from('categories')
          .insert(toInsert)
          .select('*')
          .single();
        if (error) throw error;
        // Mirror to local
        const items = readLocal();
        items.unshift({ id: data.id, name: data.name, color: data.color });
        writeLocal(items);
        return data;
      } catch (err) {
        console.warn('createCategory supabase error:', err);
        // Queue to outbox for later sync
        const out = readOutbox();
        out.unshift(cleaned);
        writeOutbox(out);
        // Also write to local for immediate UI
        const items = readLocal();
        items.unshift({ id: cleaned.id, name: cleaned.name, color: cleaned.color });
        writeLocal(items);
        return cleaned;
      }
    }
  }
  // Supabase disabled or no auth: local create + queue for later sync
  const out = readOutbox();
  out.unshift(cleaned);
  writeOutbox(out);
  const items = readLocal();
  items.unshift({ id: cleaned.id, name: cleaned.name, color: cleaned.color });
  writeLocal(items);
  return cleaned;
}

export async function updateCategory(id, changes) {
  const s = getSupabase();
  const updated = { name: changes?.name, color: changes?.color, type: changes?.type };
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const { data, error } = await s
          .from('categories')
          .update(updated)
          .eq('id', id)
          .eq('user_id', uid)
          .select('*')
          .single();
        if (error) throw error;
        // Mirror local
        const items = readLocal();
        const idx = items.findIndex(c => c.id === id);
        if (idx >= 0) items[idx] = { id: data.id, name: data.name, color: data.color };
        writeLocal(items);
        return data;
      } catch (err) {
        console.warn('updateCategory supabase error:', err);
        // Local fallback only
      }
    }
  }
  // Local update
  const items = readLocal();
  const idx = items.findIndex(c => c.id === id);
  if (idx >= 0) items[idx] = { ...items[idx], ...{ name: updated.name, color: updated.color } };
  writeLocal(items);
  return items[idx] || null;
}

export async function deleteCategory(id) {
  const s = getSupabase();
  if (isSupabaseEnabled() && s) {
    const uid = await getUserId();
    if (uid) {
      try {
        const { error } = await s
          .from('categories')
          .delete()
          .eq('id', id)
          .eq('user_id', uid);
        if (error) throw error;
      } catch (err) {
        console.warn('deleteCategory supabase error:', err);
        // Proceed with local delete regardless
      }
    }
  }
  // Local delete
  const items = readLocal().filter(c => String(c.id) !== String(id));
  writeLocal(items);
  return true;
}

export async function syncOutbox() {
  const s = getSupabase();
  if (!isSupabaseEnabled() || !s) return false;
  const uid = await getUserId();
  if (!uid) return false;

  const pending = readOutbox();
  if (!pending.length) return true;

  // Build set of existing names (case-insensitive) to ignore duplicates
  const { data: existing, error } = await s
    .from('categories')
    .select('id,name')
    .eq('user_id', uid);
  if (error) {
    console.warn('syncOutbox fetch existing error:', error);
    return false;
  }
  const existingNames = new Set((existing || []).map(r => String(r.name || '').toLowerCase()));

  const stillPending = [];
  for (const item of pending) {
    const nameLc = String(item.name || '').toLowerCase();
    if (!nameLc) continue;
    if (existingNames.has(nameLc)) {
      // Already exists, ignore
      continue;
    }
    try {
      const toInsert = { name: item.name, color: item.color, type: item.type || 'expense', user_id: uid };
      const { data, error: insErr } = await s
        .from('categories')
        .insert(toInsert)
        .select('*')
        .single();
      if (insErr) throw insErr;
      existingNames.add(nameLc);
    } catch (e) {
      console.warn('syncOutbox insert error:', e);
      // Keep in outbox for next attempt
      stillPending.push(item);
    }
  }
  writeOutbox(stillPending);
  // After syncing, mirror remote to local for consistency
  try {
    const { data } = await s
      .from('categories')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    writeLocal(data || []);
  } catch {}
  return true;
}

export { isSupabaseEnabled };