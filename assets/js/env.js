// Configuração de ambiente em runtime sem expor segredos no repositório
// Este arquivo define valores padrão seguros e mescla com window.__ENV se existir.
(function(){
  function readMeta(name){
    try {
      var el = document.querySelector('meta[name="'+name+'"]');
      return el ? el.getAttribute('content') : undefined;
    } catch(e) { return undefined; }
  }
  function asBool(val){
    if (val == null) return false;
    var s = String(val).trim().toLowerCase();
    return s === 'true' || s === '1';
  }

  // Valores vindos do ambiente (bundlers/Netlify com injeção de env)
  var fromProcess = (typeof process !== 'undefined' && process.env) ? {
    USE_SUPABASE: asBool(process.env.USE_SUPABASE || process.env.VITE_USE_SUPABASE),
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  } : {};

  // Alternativa: ler de meta tags (pode ser injetado via Snippet no Netlify)
  var fromMeta = {
    USE_SUPABASE: asBool(readMeta('ENV_USE_SUPABASE')),
    SUPABASE_URL: readMeta('ENV_SUPABASE_URL'),
    SUPABASE_ANON_KEY: readMeta('ENV_SUPABASE_ANON_KEY')
  };

  // Defaults seguros
  var defaults = {
    USE_SUPABASE: false,
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
  };

  // Se já existir window.__ENV (carregado por assets/js/env.local.js), mescla sem sobrescrever
  var existing = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};

  // Merge (prioridade: process.env > meta tags > existentes > defaults)
  var merged = Object.assign({}, defaults, existing, fromMeta, fromProcess);
  window.__ENV = merged;
})();