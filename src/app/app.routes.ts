import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'events' },
  {
    path: 'events',
    // Chargement différé : la page n'est téléchargée que lorsqu'on la visite
    loadComponent: () => import('./events/event-list/event-list').then((m) => m.EventList),
  },
  { path: '**', redirectTo: 'events' },
];