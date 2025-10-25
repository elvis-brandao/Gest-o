// Expor serviços ESM no escopo global para uso pelo app.js
import * as CategoriesService from './categoriesService.js';
import * as BanksService from './banksService.js';
import * as TransactionsService from './transactionsService.js';
import * as ProfileService from './profileService.js';
import './stateMonitor.js';

window.CategoriesService = CategoriesService;
window.BanksService = BanksService;
window.TransactionsService = TransactionsService;
window.ProfileService = ProfileService;