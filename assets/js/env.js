// Configuração de ambiente em runtime sem expor segredos no repositório
// Este arquivo define valores padrão seguros e mescla com window.__ENV se existir.
(function(){
  var defaults = {
    USE_SUPABASE: false, // padrão seguro: desativado até configurar env.local.js
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: ''
  };
  // Se já existir window.__ENV (carregado por assets/js/env.local.js), mescla sem sobrescrever
  var existing = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};
  // Merge: existentes prevalecem sobre defaults
  var merged = Object.assign({}, defaults, existing);
  window.__ENV = merged;
})();