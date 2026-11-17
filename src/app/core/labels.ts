import { EventStatus } from './models';

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Draft: 'Brouillon',
  Published: 'Publié',
  Postponed: 'Reporté',
  Cancelled: 'Annulé',
  Completed: 'Terminé',
};