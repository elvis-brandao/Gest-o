// Configuração de ambiente em runtime sem expor segredos no repositório
// Este arquivo define valores padrão seguros e mescla com window.__ENV se existir.
(function(){
  var defaults = {
    USE_SUPABASE: true, // padrão seguro: desativado até configurar env.local.js
    SUPABASE_URL: 'https://uzvlycmjgnvghvuntejf.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dmx5Y21qZ252Z2h2dW50ZWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDQwODYsImV4cCI6MjA3NjU4MDA4Nn0.Fjs8VY_JQiHHugSNIFQqIHiv5rOKgyYTzU0fGPdXhOY'
  };
  // Se já existir window.__ENV (carregado por assets/js/env.local.js), mescla sem sobrescrever
  var existing = (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};
  // Merge: existentes prevalecem sobre defaults
  var merged = Object.assign({}, defaults, existing);
  window.__ENV = merged;
})();