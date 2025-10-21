import { Router } from './core/router.js';
import { mount as mountDashboard } from './pages/dashboard.js';
import { mount as mountTransactions } from './pages/transactions.js';
import { mount as mountCategories } from './pages/categories.js';
import { mount as mountBanks } from './pages/banks.js';
import { mount as mountGoals } from './pages/goals.js';
import { mount as mountAuth } from './pages/auth.js';

const router = new Router({
  onChange: (path) => {
    document.querySelectorAll('.nav-link').forEach((a) => {
      const href = a.getAttribute('href');
      const active = href === `#/${path.split('/')[1]}`;
      a.classList.toggle('active', active);
    });
  },
});

router.register('/auth', mountAuth);
router.register('/dashboard', mountDashboard);
router.register('/transactions', mountTransactions);
router.register('/categories', mountCategories);
router.register('/banks', mountBanks);
router.register('/goals', mountGoals);
router.start();

const fabMain = document.querySelector('.fab-main');
fabMain?.addEventListener('click', (e) => {
  e.stopPropagation();
  router.navigate('/transactions');
});

const btnMenu = document.getElementById('btn-menu');
btnMenu?.addEventListener('click', () => {
  // lógica do drawer já está em app.js
});