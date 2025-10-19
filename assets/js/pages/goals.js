export function mount() {
  window.App?.showPage('goals');
  const input = document.getElementById('goal-amount');
  input?.focus();
}