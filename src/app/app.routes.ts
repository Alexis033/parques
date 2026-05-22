import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/demo').then((m) => m.DemoComponent),
  },
  {
    path: 'lobby',
    loadComponent: () => import('./pages/lobby').then((m) => m.LobbyComponent),
  },
  {
    path: 'game/:id',
    loadComponent: () => import('./pages/game').then((m) => m.GameComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings').then((m) => m.SettingsComponent),
  },
  {
    path: 'auth',
    loadComponent: () => import('./pages/auth').then((m) => m.AuthComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
