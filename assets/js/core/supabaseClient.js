// Carrega Supabase via ESM CDN e inicializa de forma segura
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;

export function initSupabase(url, anonKey) {
  if (!url || !anonKey) {
    supabase = null;
    return null;
  }
  supabase = createClient(url, anonKey);
  // Expor globalmente apenas para facilitar debugging/uso futuro
  window.Supabase = supabase;
  return supabase;
}

export function getSupabase() {
  return supabase;
}

// Inicialização automática com window.__ENV (se habilitado)
(function autoInit(){
  const cfg = window.__ENV || {};
  if (cfg.USE_SUPABASE && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    initSupabase(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  } else {
    window.Supabase = null;
  }
})();