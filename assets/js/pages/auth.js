export function mount() {
  window.App?.showPage('auth');
  const input = document.getElementById('login-email') || document.getElementById('reg-name');
  input?.focus();
}