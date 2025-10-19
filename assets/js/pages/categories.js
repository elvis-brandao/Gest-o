export function mount() {
  window.App?.showPage('categories');
  const input = document.getElementById('cat-name');
  input?.focus();
}