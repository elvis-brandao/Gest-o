export class Router {
  constructor(options = {}) {
    this.routes = new Map();
    this.notFound = options.notFound || (() => {});
    this.onChange = options.onChange || (() => {});
  }
  register(path, handler) {
    this.routes.set(path, handler);
  }
  navigate(path) {
    const targetHash = `#${path}`;
    if (location.hash !== targetHash) {
      location.hash = targetHash;
    }
    this.resolve();
  }
  resolve() {
    const hash = location.hash || '#/dashboard';
    const path = hash.replace(/^#/, '');
    const handler = this.routes.get(path);
    if (handler) handler(); else this.notFound(path);
    this.onChange(path);
  }
  start() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }
}