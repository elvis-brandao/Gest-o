/* StateMonitor service: detects inconsistencies between local cache and DB,
   triggers automatic refresh on writes, app start, and detected mismatch.
   Provides visual feedback hooks via custom events.
*/

(function(){
  const STATE_KEY = 'app:last_refresh_at';
  const SIG_KEY = 'app:last_remote_signature';

  function nowTs(){ return Date.now(); }

  function safeParse(json, fallback){
    try { return JSON.parse(json); } catch(e){ return fallback; }
  }

  function readLocal(key, def){
    const v = localStorage.getItem(key);
    return v == null ? def : v;
  }

  function writeLocal(key, val){
    localStorage.setItem(key, val);
  }

  function setLastRefresh(){ writeLocal(STATE_KEY, String(nowTs())); }
  function getLastRefresh(){ return Number(readLocal(STATE_KEY, '0')); }

  function setRemoteSignature(sig){ writeLocal(SIG_KEY, JSON.stringify(sig || {})); }
  function getRemoteSignature(){ return safeParse(readLocal(SIG_KEY, '{}'), {}); }

  // Compute lightweight signatures: count + max timestamp per entity
  async function computeRemoteSignature(){
    const sig = { banks: {count:0, ts:0}, categories: {count:0, ts:0}, transactions: {count:0, ts:0} };
    const supabase = window.getSupabase ? window.getSupabase() : null;
    const userId = window.getUserId ? window.getUserId() : null;
    const enabled = window.isSupabaseEnabled ? window.isSupabaseEnabled() : !!supabase;
    if(!enabled || !supabase || !userId){
      // Fallback to local signature
      const lb = window.BanksService?.getLocalBanks?.() || [];
      const lc = window.CategoriesService?.getLocalCategories?.() || [];
      const lt = window.TransactionsService?.getLocalTransactions?.() || [];
      sig.banks.count = lb.length; sig.categories.count = lc.length; sig.transactions.count = lt.length;
      sig.banks.ts = Math.max(0, ...lb.map(b => Number(new Date(b.updated_at || b.created_at || 0))));
      sig.categories.ts = Math.max(0, ...lc.map(c => Number(new Date(c.updated_at || c.created_at || 0))));
      sig.transactions.ts = Math.max(0, ...lt.map(t => Number(new Date(t.updated_at || t.created_at || 0))));
      return sig;
    }
    try {
      // banks
      const rb = await supabase.from('banks').select('id, updated_at, created_at').eq('user_id', userId);
      const banks = rb.data || [];
      sig.banks.count = banks.length;
      sig.banks.ts = Math.max(0, ...banks.map(b => Number(new Date(b.updated_at || b.created_at || 0))));
      // categories
      const rc = await supabase.from('categories').select('id, updated_at, created_at').eq('user_id', userId);
      const cats = rc.data || [];
      sig.categories.count = cats.length;
      sig.categories.ts = Math.max(0, ...cats.map(c => Number(new Date(c.updated_at || c.created_at || 0))));
      // transactions
      const rt = await supabase.from('transactions').select('id, updated_at, created_at').eq('user_id', userId);
      const txs = rt.data || [];
      sig.transactions.count = txs.length;
      sig.transactions.ts = Math.max(0, ...txs.map(t => Number(new Date(t.updated_at || t.created_at || 0))));
    } catch(err){
      // network error: fallback to local
      const lb = window.BanksService?.getLocalBanks?.() || [];
      const lc = window.CategoriesService?.getLocalCategories?.() || [];
      const lt = window.TransactionsService?.getLocalTransactions?.() || [];
      sig.banks.count = lb.length; sig.categories.count = lc.length; sig.transactions.count = lt.length;
      sig.banks.ts = Math.max(0, ...lb.map(b => Number(new Date(b.updated_at || b.created_at || 0))));
      sig.categories.ts = Math.max(0, ...lc.map(c => Number(new Date(c.updated_at || c.created_at || 0))));
      sig.transactions.ts = Math.max(0, ...lt.map(t => Number(new Date(t.updated_at || t.created_at || 0))));
    }
    return sig;
  }

  function signaturesDiffer(a, b){
    if(!a || !b) return true;
    const keys = ['banks','categories','transactions'];
    return keys.some(k => (a[k]?.count !== b[k]?.count) || (a[k]?.ts !== b[k]?.ts));
  }

  async function refreshAllCaches(){
    window.dispatchEvent(new CustomEvent('sync:refresh-start'));
    try {
      const bs = window.BanksService; const cs = window.CategoriesService; const ts = window.TransactionsService;
      if(bs?.fetchBanks) await bs.fetchBanks();
      if(cs?.fetchCategories) await cs.fetchCategories();
      if(ts?.fetchTransactions) await ts.fetchTransactions();
      setLastRefresh();
      const sig = await computeRemoteSignature();
      setRemoteSignature(sig);
      window.dispatchEvent(new CustomEvent('sync:refresh-done', { detail: { ok:true } }));
    } catch(err){
      window.dispatchEvent(new CustomEvent('sync:refresh-done', { detail: { ok:false, error: String(err) } }));
    }
  }

  async function checkConsistencyAndRefresh(){
    const prevSig = getRemoteSignature();
    const currentSig = await computeRemoteSignature();
    if(signaturesDiffer(prevSig, currentSig)){
      await refreshAllCaches();
    } else {
      // still update remote signature baseline
      setRemoteSignature(currentSig);
    }
  }

  function markWrite(entity){
    // Called after any CRUD write: triggers refresh
    window.dispatchEvent(new CustomEvent('sync:write', { detail: { entity } }));
    refreshAllCaches();
  }

  function init(){
    // On app start or reload
    window.addEventListener('load', () => { checkConsistencyAndRefresh(); });
    // On visibility change (app updated or revisited)
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') checkConsistencyAndRefresh();
    });
    // Network resilience: when back online, re-check
    window.addEventListener('online', () => { checkConsistencyAndRefresh(); });
  }

  window.StateMonitor = { init, refreshAllCaches, checkConsistencyAndRefresh, markWrite, getLastRefresh, getRemoteSignature };
})();
