import { EventStatus, Role } from './models';

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  Draft: 'Brouillon',
  Published: 'Publié',
  Postponed: 'Reporté',
  Cancelled: 'Annulé',
  Completed: 'Terminé',
};

export const ROLE_LABELS: Record<Role, string> = {
  Participant: 'Participant',
  Organizer: 'Organisateur',
  Staff: 'Staff',
  Admin: 'Administrateur',
};