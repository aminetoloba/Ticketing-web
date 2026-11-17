import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

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
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./orders/order-list/order-list').then((m) => m.OrderList),
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./orders/order-detail/order-detail').then((m) => m.OrderDetail),
  },
  {
    path: 'tickets',
    canActivate: [roleGuard('Participant', 'Organizer')],
    loadComponent: () => import('./tickets/ticket-list/ticket-list').then((m) => m.TicketList),
  },
  {
    path: 'organizer',
    canActivate: [roleGuard('Organizer', 'Admin')],
    loadComponent: () =>
      import('./organizer/organizer-events/organizer-events').then((m) => m.OrganizerEvents),
  },
  {
    path: 'organizer/events/new',
    canActivate: [roleGuard('Organizer', 'Admin')],
    loadComponent: () => import('./organizer/event-editor/event-editor').then((m) => m.EventEditor),
  },
  {
    path: 'organizer/events/:id',
    canActivate: [roleGuard('Organizer', 'Admin')],
    loadComponent: () => import('./organizer/event-editor/event-editor').then((m) => m.EventEditor),
  },
  {
    path: 'scan',
    canActivate: [roleGuard('Staff', 'Admin')],
    loadComponent: () => import('./staff/scan/scan').then((m) => m.Scan),
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