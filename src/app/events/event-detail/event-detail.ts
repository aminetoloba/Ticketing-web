import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CURRENCY } from '../../core/api-config';
import { apiErrorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth-service';
import { EventsApi } from '../../core/events-api';
import { EventDto, Role, TicketTypeDto } from '../../core/models';
import { OrdersApi } from '../../core/orders-api';

// Même limite que l'API
const MAX_TICKETS_PER_ORDER = 10;
const BUYER_ROLES: Role[] = ['Participant', 'Organizer'];

@Component({
  selector: 'app-event-detail',
  imports: [DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsApi = inject(EventsApi);
  private readonly ordersApi = inject(OrdersApi);

  protected readonly auth = inject(AuthService);
  protected readonly currency = CURRENCY;
  protected readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly event = signal<EventDto | null>(null);
  protected readonly ticketTypes = signal<TicketTypeDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly submitting = signal(false);
  protected readonly orderError = signal<string | null>(null);

  protected readonly totalTickets = computed(() =>
    Object.values(this.quantities()).reduce((sum, q) => sum + q, 0),
  );

  protected readonly totalPrice = computed(() =>
    this.ticketTypes().reduce((sum, t) => sum + t.price * (this.quantities()[t.id] ?? 0), 0),
  );

  protected readonly isBuyer = computed(() => {
    const role = this.auth.role();
    return role !== null && BUYER_ROLES.includes(role);
  });

  protected readonly onSale = computed(() => {
    const e = this.event();
    return (
      !!e &&
      (e.status === 'Published' || e.status === 'Postponed') &&
      Date.parse(e.endDate) > Date.now()
    );
  });

  constructor() {
    forkJoin({
      event: this.eventsApi.get(this.eventId),
      ticketTypes: this.eventsApi.ticketTypes(this.eventId),
    }).subscribe({
      next: ({ event, ticketTypes }) => {
        this.event.set(event);
        this.ticketTypes.set(ticketTypes);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        const notFound = error instanceof HttpErrorResponse && error.status === 404;
        this.loadError.set(notFound ? 'Événement introuvable.' : apiErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected quantity(ticketType: TicketTypeDto): number {
    return this.quantities()[ticketType.id] ?? 0;
  }

  protected canIncrease(ticketType: TicketTypeDto): boolean {
    return this.quantity(ticketType) < ticketType.remaining && this.totalTickets() < MAX_TICKETS_PER_ORDER;
  }

  protected change(ticketType: TicketTypeDto, delta: 1 | -1): void {
    if (delta > 0 && !this.canIncrease(ticketType)) return;

    const next = this.quantity(ticketType) + delta;
    if (next < 0) return;

    this.quantities.update((q) => ({ ...q, [ticketType.id]: next }));
  }

  protected reserve(): void {
    const lines = this.ticketTypes()
      .filter((t) => this.quantity(t) > 0)
      .map((t) => ({ ticketTypeId: t.id, quantity: this.quantity(t) }));

    // Le bouton est désactivé pendant l'envoi : pas de double commande au double clic
    if (lines.length === 0 || this.submitting()) return;

    this.submitting.set(true);
    this.orderError.set(null);

    this.ordersApi.create({ eventId: this.eventId, lines }).subscribe({
      next: (order) => void this.router.navigate(['/orders', order.id]),
      error: (error: unknown) => {
        this.orderError.set(apiErrorMessage(error));
        this.submitting.set(false);

        // 409 : le stock a changé entre l'affichage et l'achat. On relit les places restantes.
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.refreshTicketTypes();
        }
      },
    });
  }

  private refreshTicketTypes(): void {
    this.eventsApi.ticketTypes(this.eventId).subscribe((ticketTypes) => {
      this.ticketTypes.set(ticketTypes);

      // On ramène les quantités choisies à ce qui reste réellement
      this.quantities.update((q) => {
        const next: Record<string, number> = {};
        for (const t of ticketTypes) next[t.id] = Math.min(q[t.id] ?? 0, t.remaining);
        return next;
      });
    });
  }
}