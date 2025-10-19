export function mount() {
  window.App?.showPage('banks');
  const input = document.getElementById('bank-name');
  input?.focus();
}