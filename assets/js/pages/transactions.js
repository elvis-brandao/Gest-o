export function mount() {
  window.App?.showPage('transactions');
  const input = document.getElementById('tx-description');
  input?.focus();
}