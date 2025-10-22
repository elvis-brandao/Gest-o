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
  // novo: meta por mês específico
  const localSaveMonthlyGoalFor = (monthKey, amount) => {
    const items = readLocal();
    const targetName = `monthly:${monthKey}`;
    const idx = items.findIndex(g => (g.name || '').toLowerCase() === targetName.toLowerCase());
    if (idx >= 0) {
      items[idx] = { ...items[idx], target_amount: amount };
    } else {
      items.unshift({ id: crypto.randomUUID(), name: targetName, target_amount: amount, created_at: new Date().toISOString() });
    }
    writeLocal(items);
    return items.find(g => (g.name || '').toLowerCase() === targetName.toLowerCase());
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

  const fetchMonthlyGoalFor = async (monthKey) => {
    const items = await fetchGoals();
    const name = `monthly:${monthKey}`;
    const monthly = items.find(g => (g.name || '').toLowerCase() === name.toLowerCase()) || null;
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

  const saveMonthlyGoalFor = async (monthKey, amount) => {
    const name = `monthly:${monthKey}`;
    if (!isSupabaseEnabled()) {
      return localSaveMonthlyGoalFor(monthKey, amount);
    }
    const uid = await getUserId();
    if (!uid) return localSaveMonthlyGoalFor(monthKey, amount);

    const { data: existing } = await window.Supabase
      .from(supabaseTable)
      .select('*')
      .eq('name', name)
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
      if (error) { console.warn('saveMonthlyGoalFor update error:', error); }
      const items = readLocal();
      const idx = items.findIndex(g => g.id === existing.id);
      if (idx >= 0) items[idx] = data; else items.unshift(data);
      writeLocal(items);
      return data;
    } else {
      const toInsert = { name, target_amount: amount, user_id: uid };
      const { data, error } = await window.Supabase
        .from(supabaseTable)
        .insert(toInsert)
        .select('*')
        .single();
      if (error) { console.warn('saveMonthlyGoalFor insert error:', error); return localSaveMonthlyGoalFor(monthKey, amount); }
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
    fetchMonthlyGoalFor,
    saveMonthlyGoalFor,
  };
})();
(function(){
  const LS_PREFIX = 'goalsService:';
  function lsGet(key, fallback){
    try { const raw = localStorage.getItem(LS_PREFIX+key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function lsSet(key, val){ localStorage.setItem(LS_PREFIX+key, JSON.stringify(val)); }

  async function localSaveMonthlyGoalFor(monthKey, amount){
    const map = lsGet('monthlyGoalsMap', {});
    map[monthKey] = Number(amount)||0;
    lsSet('monthlyGoalsMap', map);
    // Espelhar também no storage do app para consistência
    try {
      const appMapRaw = localStorage.getItem('monthlyGoals');
      const appMap = appMapRaw ? JSON.parse(appMapRaw) : {};
      appMap[monthKey] = Number(amount)||0;
      localStorage.setItem('monthlyGoals', JSON.stringify(appMap));
    } catch {}
    return { month_key: monthKey, target_amount: Number(amount)||0 };
  }
  async function fetchMonthlyGoalFor(monthKey){
    try {
      const env = window.__ENV || {};
      const sup = window.Supabase;
      const supEnabled = !!env.USE_SUPABASE && !!sup && !!sup.auth;
      if (supEnabled) {
        const { data: { user } } = await sup.auth.getUser();
        const userId = user?.id || null;
        if (!userId) throw new Error('No authenticated user');
        const { data, error } = await sup
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .eq('name', `monthly:${monthKey}`)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data ? { month_key: monthKey, target_amount: Number(data.target_amount)||0 } : null;
      }
    } catch (e) {
      // Fallback para storage local do app (mensal)
      try {
        const appMapRaw = localStorage.getItem('monthlyGoals');
        const appMap = appMapRaw ? JSON.parse(appMapRaw) : {};
        if (appMap && appMap[monthKey] != null) {
          return { month_key: monthKey, target_amount: Number(appMap[monthKey])||0 };
        }
      } catch {}
      // Fallback secundário para storage do serviço
      const map = lsGet('monthlyGoalsMap', {});
      return map[monthKey] != null ? { month_key: monthKey, target_amount: Number(map[monthKey])||0 } : null;
    }
    // Se Supabase desativado, usar storage do app primeiro
    try {
      const appMapRaw = localStorage.getItem('monthlyGoals');
      const appMap = appMapRaw ? JSON.parse(appMapRaw) : {};
      if (appMap && appMap[monthKey] != null) {
        return { month_key: monthKey, target_amount: Number(appMap[monthKey])||0 };
      }
    } catch {}
    const map = lsGet('monthlyGoalsMap', {});
    return map[monthKey] != null ? { month_key: monthKey, target_amount: Number(map[monthKey])||0 } : null;
  }
  async function saveMonthlyGoalFor(monthKey, amount){
    if (window.__ENV?.USE_SUPABASE) {
      try {
        const sup = window.Supabase;
        const userId = window.AuthService?.getUser()?.id;
        if (!sup || !userId) return localSaveMonthlyGoalFor(monthKey, amount);
        const name = `monthly:${monthKey}`;
        const { data: existing } = await sup
          .from('goals')
          .select('*')
          .eq('user_id', userId)
          .eq('name', name)
          .limit(1)
          .maybeSingle();

        let data, error;
        if (existing && existing.id) {
          ({ data, error } = await sup
            .from('goals')
            .update({ target_amount: Number(amount)||0 })
            .eq('id', existing.id)
            .select('*')
            .single());
        } else {
          const toInsert = { user_id: userId, name, target_amount: Number(amount)||0 };
          ({ data, error } = await sup
            .from('goals')
            .insert(toInsert)
            .select('*')
            .single());
        }
        if (error) throw error;
        await localSaveMonthlyGoalFor(monthKey, Number(amount)||0);
        return { month_key: monthKey, target_amount: Number(data.target_amount)||0 };
      } catch (e) {
        return localSaveMonthlyGoalFor(monthKey, Number(amount)||0);
      }
    } else {
      return localSaveMonthlyGoalFor(monthKey, Number(amount)||0);
    }
  }

  // Legacy single goal helpers
  async function fetchMonthlyGoal(){
    const map = lsGet('monthlyGoalsMap', {});
    const currentKey = new Date().toISOString().slice(0,7);
    const amount = map[currentKey] ?? lsGet('legacyMonthlyGoal', 2000);
    return { month_key: currentKey, target_amount: Number(amount)||0 };
  }
  async function saveMonthlyGoal(amount){
    lsSet('legacyMonthlyGoal', Number(amount)||0);
    const currentKey = new Date().toISOString().slice(0,7);
    await localSaveMonthlyGoalFor(currentKey, Number(amount)||0);
    return { month_key: currentKey, target_amount: Number(amount)||0 };
  }

  window.GoalsService = window.GoalsService || {};
  window.GoalsService.fetchMonthlyGoalFor = fetchMonthlyGoalFor;
  window.GoalsService.saveMonthlyGoalFor = saveMonthlyGoalFor;
  window.GoalsService.fetchMonthlyGoal = fetchMonthlyGoal;
  window.GoalsService.saveMonthlyGoal = saveMonthlyGoal;
})();