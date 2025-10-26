// Carrega Supabase via ESM CDN e inicializa de forma segura
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;

function extractProjectRef(url) {
  try {
    const u = String(url || '');
    const m = u.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
    return m ? m[1] : '';
  } catch { return ''; }
}

function cleanupStaleAuth(url) {
  try {
    const ref = extractProjectRef(url);
    if (!ref) return;
    const prefixCurrent = `sb-${ref}-`;
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith('sb-') && !k.startsWith(prefixCurrent)) {
        try { localStorage.removeItem(k); } catch {}
      }
    }
  } catch {}
}

export function initSupabase(url, anonKey) {
  if (!url || !anonKey) {
    supabase = null;
    return null;
  }
  // Limpar possíveis tokens de projetos antigos para evitar refresh inválido
  cleanupStaleAuth(url);

  supabase = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    }
  });
  // Expor globalmente apenas para facilitar debugging/uso futuro
  window.Supabase = supabase;
  // Pré-aquecer leitura de sessão, ignorando falhas
  try { supabase.auth.getSession().catch(() => {}); } catch {}
  return supabase;
}

export function getSupabase() {
  return supabase;
}

// Helpers de realtime para mudar UI imediatamente quando o banco atualizar
export function subscribeToChanges(tables = []) {
  if (!supabase || !Array.isArray(tables) || tables.length === 0) return null;
  const channel = supabase.channel('db-changes');
  tables.forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      try {
        window.dispatchEvent(new CustomEvent('db:change', { detail: { table, payload } }));
      } catch {}
    });
  });
  channel.subscribe((status) => {
    try {
      window.dispatchEvent(new CustomEvent('db:subscription', { detail: { status } }));
    } catch {}
  });
  return channel;
}

// Limpa todos os tokens locais do projeto atual (útil após sessão inválida)
export function resetAuthStorage() {
  try {
    const cfg = window.__ENV || {};
    const ref = extractProjectRef(cfg.SUPABASE_URL);
    const prefix = ref ? `sb-${ref}-` : 'sb-';
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(prefix)) {
        try { localStorage.removeItem(k); } catch {}
      }
    }
  } catch {}
}

function ensureRealtimeSubscriptions() {
  try {
    const cfg = window.__ENV || {};
    if (!(cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)) return;
    if (!supabase) return;
    if (window.__SUB_CHANNEL__) return; // evitar duplicações
    const defaultTables = ['banks', 'categories', 'transactions', 'monthly_goals', 'profiles'];
    window.__SUB_CHANNEL__ = subscribeToChanges(defaultTables);
  } catch {}
}

// Inicialização automática com window.__ENV (se habilitado)
(function autoInit(){
  const cfg = window.__ENV || {};
  if (cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    initSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    ensureRealtimeSubscriptions();
  } else {
    window.Supabase = null;
  }
  // expor utilitário de reset para uso global
  try { window.resetSupabaseAuthStorage = resetAuthStorage; } catch {}
})();

// Re-inicializar quando o ambiente ficar pronto (ex.: .env carregado)
window.addEventListener('env:ready', () => {
  const cfg = window.__ENV || {};
  if (cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    initSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    ensureRealtimeSubscriptions();
  }
});