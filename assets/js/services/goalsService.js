(function(){
  // use window.Supabase dynamically

  const isSupabaseEnabled = () => {
    try {
      const env = window.__ENV || {};
      return !!env.USE_SUPABASE && !!window.Supabase && !!window.Supabase.auth;
    } catch (e) { return false; }
  };

  const getUserId = async () => {
    if (!isSupabaseEnabled()) return null;
    const { data: { user } } = await window.Supabase.auth.getUser();
    return user?.id || null;
  };

  const localKey = 'goals';
  const readLocal = () => {
    try {
      const raw = localStorage.getItem(localKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };
  const writeLocal = (items) => {
    try { localStorage.setItem(localKey, JSON.stringify(items || [])); } catch {}
  };

  // helpers de fallback local
  const localCreate = (payload) => {
    const items = readLocal();
    const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload };
    items.unshift(item);
    writeLocal(items);
    return item;
  };
  const localUpdate = (id, changes) => {
    const items = readLocal();
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) items[idx] = { ...items[idx], ...changes };
    writeLocal(items);
    return items[idx] || null;
  };
  const localDelete = (id) => {
    const items = readLocal().filter(i => i.id !== id);
    writeLocal(items);
    return { id };
  };
  const localSaveMonthlyGoal = (amount) => {
    const items = readLocal();
    const idx = items.findIndex(g => (g.name || '').toLowerCase() === 'monthly');
    if (idx >= 0) {
      items[idx] = { ...items[idx], target_amount: amount };
    } else {
      items.unshift({ id: crypto.randomUUID(), name: 'monthly', target_amount: amount, created_at: new Date().toISOString() });
    }
    writeLocal(items);
    return items.find(g => (g.name || '').toLowerCase() === 'monthly');
  };

  const supabaseTable = 'goals';

  const fetchGoals = async () => {
    if (!isSupabaseEnabled()) return readLocal();
    const uid = await getUserId();
    if (!uid) return readLocal();

    const { data, error } = await window.Supabase
      .from(supabaseTable)
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('fetchGoals supabase error:', error);
      return readLocal();
    }
    writeLocal(data);
    return data;
  };

  const createGoal = async (payload) => {
    // payload: { name, target_amount, current_amount?, due_date?, category_id? }
    if (!isSupabaseEnabled()) return localCreate(payload);
    const uid = await getUserId();
    if (!uid) return localCreate(payload);

    const toInsert = { ...payload, user_id: uid };
    const { data, error } = await window.Supabase
      .from(supabaseTable)
      .insert(toInsert)
      .select('*')
      .single();
    if (error) {
      console.warn('createGoal supabase error:', error);
      return localCreate(payload);
    }
    const items = readLocal();
    items.unshift(data);
    writeLocal(items);
    return data;
  };

  const updateGoal = async (id, changes) => {
    if (!isSupabaseEnabled()) return localUpdate(id, changes);
    const uid = await getUserId();
    if (!uid) return localUpdate(id, changes);

    const { data, error } = await window.Supabase
      .from(supabaseTable)
      .update(changes)
      .eq('id', id)
      .eq('user_id', uid)
      .select('*')
      .single();
    if (error) {
      console.warn('updateGoal supabase error:', error);
      return localUpdate(id, changes);
    }
    const items = readLocal();
    const idx = items.findIndex(i => i.id === id);
    if (idx >= 0) items[idx] = data; else items.unshift(data);
    writeLocal(items);
    return data;
  };

  const deleteGoal = async (id) => {
    if (!isSupabaseEnabled()) return localDelete(id);
    const uid = await getUserId();
    if (!uid) return localDelete(id);

    const { error } = await window.Supabase
      .from(supabaseTable)
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) {
      console.warn('deleteGoal supabase error:', error);
      return localDelete(id);
    }
    return localDelete(id);
  };

  const fetchMonthlyGoal = async () => {
    const items = await fetchGoals();
    const monthly = items.find(g => (g.name || '').toLowerCase() === 'monthly') || null;
    return monthly;
  };

  const saveMonthlyGoal = async (amount) => {
    if (!isSupabaseEnabled()) {
      return localSaveMonthlyGoal(amount);
    }
    const uid = await getUserId();
    if (!uid) return localSaveMonthlyGoal(amount);

    const { data: existing } = await window.Supabase
      .from(supabaseTable)
      .select('*')
      .eq('name', 'monthly')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      const { data, error } = await window.Supabase
        .from(supabaseTable)
        .update({ target_amount: amount })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) { console.warn('saveMonthlyGoal update error:', error); }
      const items = readLocal();
      const idx = items.findIndex(g => g.id === existing.id);
      if (idx >= 0) items[idx] = data; else items.unshift(data);
      writeLocal(items);
      return data;
    } else {
      const toInsert = { name: 'monthly', target_amount: amount, user_id: uid };
      const { data, error } = await window.Supabase
        .from(supabaseTable)
        .insert(toInsert)
        .select('*')
        .single();
      if (error) { console.warn('saveMonthlyGoal insert error:', error); return localSaveMonthlyGoal(amount); }
      const items = readLocal();
      items.unshift(data);
      writeLocal(items);
      return data;
    }
  };

  window.GoalsService = {
    fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    isSupabaseEnabled,
    fetchMonthlyGoal,
    saveMonthlyGoal,
  };
})();