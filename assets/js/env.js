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
  function parseDotEnv(text){
    function clean(v){
      try {
        var s = String(v || '').trim();
        // Primeiro remova aspas/backticks nas pontas
        s = s.replace(/^['"`]+|['"`]+$/g, '');
        // Depois remova vírgula/; finais
        s = s.replace(/[;,]$/,'').trim();
        return s;
      } catch { return ''; }
    }
    var out = {};
    try {
      (text||'').split(/\r?\n/).forEach(function(line){
        if (!line || /^\s*#/.test(line)) return; // ignore comments
        var m = line.match(/^([A-Za-z0-9_]+)\s*(?:=|:)\s*(.*)$/);
        if (!m) return;
        var key = m[1];
        var val = clean(m[2]);
        if (key === 'USE_SUPABASE') out.USE_SUPABASE = asBool(val);
        else if (key === 'SUPABASE_URL') out.SUPABASE_URL = val;
        else if (key === 'SUPABASE_ANON_KEY') out.SUPABASE_ANON_KEY = val;
        else if (key === 'USE_DOTENV') out.USE_DOTENV = asBool(val);
      });
    } catch {}
    return out;
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
    SUPABASE_ANON_KEY: readMeta('ENV_SUPABASE_ANON_KEY'),
    USE_DOTENV: asBool(readMeta('ENV_USE_DOTENV'))
  };

  // Defaults seguros
  var defaults = {
    USE_SUPABASE: false,
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    USE_DOTENV: false
  };

  // Se já existir window.__ENV (carregado por snippet ou outro), mescla
  var existing = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};

  // Merge inicial (prioridade: process.env > meta tags > existentes > defaults)
  var merged = Object.assign({}, defaults, existing, fromMeta, fromProcess);
  window.__ENV = merged;

  // Opcional: leitura de .env no localhost, controlada por flag
  var useDotEnv = !!window.__ENV.USE_DOTENV;
  if (useDotEnv) {
    try {
      fetch('/.env', { cache: 'no-store' })
        .then(function(resp){ return resp.ok ? resp.text() : ''; })
        .then(function(text){
          if (!text) return;
          var parsed = parseDotEnv(text);
          var next = Object.assign({}, window.__ENV, parsed);
          window.__ENV = next;
          // Avisar interessados (ex.: Supabase auto-init)
          try { window.dispatchEvent(new Event('env:ready')); } catch {}
        })
        .catch(function(){ /* ignore */ });
    } catch(e) { /* ignore */ }
  }
})();