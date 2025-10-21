(function(){
  // use window.Supabase dynamically

  let currentUser = null;
  let initialized = false;

  const isSupabaseEnabled = () => {
    try {
      const env = window.__ENV || {};
      return !!env.USE_SUPABASE && !!window.Supabase && !!window.Supabase.auth;
    } catch(e){ return false; }
  };

  const dispatchAuthChange = (user) => {
    try {
      window.dispatchEvent(new CustomEvent('auth:change', { detail: { user } }));
    } catch {}
  };

  const init = async () => {
    if (initialized) return;
    initialized = true;
    if (!isSupabaseEnabled()) return;

    try {
      const { data: { user } } = await window.Supabase.auth.getUser();
      currentUser = user || null;
    } catch { currentUser = null; }

    try {
      window.Supabase.auth.onAuthStateChange((_event, session) => {
        currentUser = session?.user || null;
        dispatchAuthChange(currentUser);
      });
    } catch {}
  };

  const getUser = () => currentUser;
  const isAuthenticated = () => !!currentUser;

  const getDisplayName = () => {
    const user = getUser();
    if (!user) return '';
    const name = user.user_metadata?.name;
    if (name && typeof name === 'string') return name;
    const email = user.email || '';
    return email.split('@')[0] || 'Usuário';
  };

  const signUp = async ({ name, email, password }) => {
    if (!isSupabaseEnabled()) throw new Error('Supabase não configurado');
    const { data, error } = await window.Supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw error;
    // Atualiza cache se já houver sessão (depende da config de confirmação de email)
    currentUser = data?.user || null;
    dispatchAuthChange(currentUser);
    return data;
  };

  const signIn = async ({ email, password }) => {
    if (!isSupabaseEnabled()) throw new Error('Supabase não configurado');
    const { data, error } = await window.Supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data?.user || null;
    dispatchAuthChange(currentUser);
    return data;
  };

  const signOut = async () => {
    if (!isSupabaseEnabled()) return;
    await window.Supabase.auth.signOut();
    currentUser = null;
    dispatchAuthChange(currentUser);
  };

  // Inicializa imediatamente para garantir leitura da sessão antes de roteamento
  init();

  window.AuthService = {
    init,
    isSupabaseEnabled,
    getUser,
    isAuthenticated,
    getDisplayName,
    signUp,
    signIn,
    signOut,
  };
})();