import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'events' },
  {
    path: 'events',
    // Chargement différé : la page n'est téléchargée que lorsqu'on la visite
    loadComponent: () => import('./events/event-list/event-list').then((m) => m.EventList),
  },
  {
    path: 'events/:id',
    loadComponent: () => import('./events/event-detail/event-detail').then((m) => m.EventDetail),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./orders/order-detail/order-detail').then((m) => m.OrderDetail),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register').then((m) => m.Register),
  },
  { path: '**', redirectTo: 'events' },
];